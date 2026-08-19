const express = require("express");
const prisma = require("../lib/prisma");
const { parseDokterIdFilter } = require("../utils/queryParams");

const router = express.Router();

// Modul Jasa Medis (Pendapatan) — Tahap 4 docs/rencana-revisi-modul-dokter.md.
// View-only untuk kedua role: angkanya mensimulasikan remunerasi dari SIMRS,
// aplikasi ini tidak pernah menghitung atau mengubahnya.
//
// Satu endpoint, bukan dua (ringkasan + detail) seperti di dokumen rencana:
// layarnya butuh dua-duanya sekaligus dan ringkasannya harus dijumlah dari
// baris yang sama persis dengan yang ditampilkan. Dipisah jadi dua panggilan,
// dua angka itu bisa berbeda tanpa ada yang sadar.
//
// Ringkasan dihitung saat diminta, tidak disimpan — lihat catatan di
// schema.prisma model Pendapatan.

const BARIS_SELECT = {
  id: true,
  tanggalTindakan: true,
  namaTindakan: true,
  unitPelayanan: true,
  jasa: true,
  statusVerifikasi: true,
  penjamin: { select: { nama: true, isJkn: true } },
};

/** `YYYY-MM` dari sebuah Date, dalam WIB. */
function kunciBulan(tanggal) {
  return new Date(tanggal.getTime() + 7 * 3_600_000).toISOString().slice(0, 7);
}

/** Rentang [awal, akhirEksklusif) untuk satu kunci bulan `YYYY-MM`, dalam WIB. */
function rentangBulan(kunci) {
  const [tahun, bulan] = kunci.split("-").map(Number);
  // Date.UTC(...) - 7 jam = tengah malam WIB.
  const awal = new Date(Date.UTC(tahun, bulan - 1, 1) - 7 * 3_600_000);
  const akhir = new Date(Date.UTC(tahun, bulan, 1) - 7 * 3_600_000);
  return { awal, akhir };
}

function parseBulan(query) {
  if (query.bulan === undefined) return { errors: [] };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(query.bulan)) {
    return { errors: ["bulan harus berformat YYYY-MM"] };
  }
  return { errors: [], bulan: query.bulan };
}

router.get("/", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const { errors, bulan: bulanDiminta } = parseBulan(req.query);
  if (errors.length > 0) {
    return res.status(400).json({ message: "Query params tidak valid", errors });
  }

  // dokterId DOKTER selalu dari JWT (CLAUDE.md Aturan #2). `?dokterId=` cuma
  // dihormati untuk ADMIN — parseDokterIdFilter sudah membuangnya kalau
  // pemanggilnya DOKTER.
  const dokterId = role === "DOKTER" ? ownDokterId : parseDokterIdFilter(req.query, role);
  if (!dokterId) {
    return res.status(400).json({ message: "dokterId wajib diisi untuk role ADMIN" });
  }

  const dokter = await prisma.dokter.findUnique({
    where: { id: dokterId },
    select: { id: true, nama: true, spesialisasi: true },
  });
  if (!dokter) {
    return res.status(404).json({ message: "Dokter tidak ditemukan" });
  }

  // Daftar bulan yang ada isinya dihitung dari SELURUH riwayat dokter, bukan
  // dari rentang yang sedang dilihat — kalau ikut rentang, pemilih bulan di
  // layar cuma akan berisi bulan yang sedang dibuka.
  const semuaTanggal = await prisma.pendapatan.findMany({
    where: { dokterId },
    select: { tanggalTindakan: true },
  });
  const bulanTersedia = [...new Set(semuaTanggal.map((p) => kunciBulan(p.tanggalTindakan)))]
    .sort()
    .reverse();

  // Tanpa `?bulan=`, jatuh ke bulan terisi paling baru. Default "bulan
  // berjalan" akan menampilkan layar kosong di bulan yang belum ada
  // pelayanannya, dan itu tidak bisa dibedakan dari gagal memuat.
  const bulan = bulanDiminta ?? bulanTersedia[0] ?? kunciBulan(new Date());
  const { awal, akhir } = rentangBulan(bulan);

  const baris = await prisma.pendapatan.findMany({
    where: { dokterId, tanggalTindakan: { gte: awal, lt: akhir } },
    select: BARIS_SELECT,
    orderBy: { tanggalTindakan: "desc" },
  });

  // Decimal Prisma diserialisasi jadi string kalau dibiarkan; frontend
  // menjumlah dan memformatnya sebagai angka, jadi dikonversi di sini sekali.
  const data = baris.map((b) => ({ ...b, jasa: Number(b.jasa) }));

  const terverifikasi = data.filter((b) => b.statusVerifikasi === "TERVERIFIKASI");
  const totalJkn = terverifikasi
    .filter((b) => b.penjamin.isJkn)
    .reduce((n, b) => n + b.jasa, 0);
  const totalNonJkn = terverifikasi
    .filter((b) => !b.penjamin.isJkn)
    .reduce((n, b) => n + b.jasa, 0);

  res.json({
    dokter: { id: dokter.id, nama: dokter.nama, smf: dokter.spesialisasi },
    bulan,
    bulanTersedia,
    ringkasan: {
      // Ringkasan sengaja cuma menjumlah yang TERVERIFIKASI — angka besar di
      // layar harus sama dengan yang sudah cair, bukan campuran dengan yang
      // masih diproses. Yang menunggu dilaporkan terpisah di bawah.
      totalJkn,
      totalNonJkn,
      totalRemunerasiBruto: totalJkn + totalNonJkn,
      totalMenunggu: data
        .filter((b) => b.statusVerifikasi === "MENUNGGU")
        .reduce((n, b) => n + b.jasa, 0),
      jumlahPelayanan: data.length,
    },
    data,
  });
});

module.exports = router;
