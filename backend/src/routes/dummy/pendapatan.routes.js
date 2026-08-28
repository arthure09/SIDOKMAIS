const express = require("express");
const prisma = require("../../lib/prisma");
const { parseDokterIdFilter } = require("../../utils/queryParams");

const router = express.Router();

// Modul Jasa Medis (Pendapatan) — view-only untuk kedua role: angkanya
// mensimulasikan remunerasi dari SIMRS, aplikasi ini tidak pernah menghitung
// atau mengubahnya.
//
// Periodenya rentang tanggal bebas (`?tanggalAwal=&tanggalAkhir=`), mengikuti
// SIREMDIS yang memakai format "01-08-2026 s/d 17-08-2026" — bukan pilihan bulan.
//
// Satu endpoint, bukan dua (ringkasan + detail): layarnya butuh dua-duanya
// sekaligus dan ringkasannya harus dijumlah dari baris yang sama persis
// dengan yang ditampilkan — dipisah jadi dua panggilan, dua angka itu bisa
// berbeda tanpa ada yang sadar.
//
// Ringkasan dihitung saat diminta, tidak disimpan — lihat catatan di
// schema.prisma model Pendapatan.

const BARIS_SELECT = {
  id: true,
  tanggalTindakan: true,
  namaTindakan: true,
  unitPelayanan: true,
  jasa: true,
  pasien: { select: { norm: true, nama: true } },
  penjamin: { select: { nama: true, isJkn: true } },
};

const WIB_OFFSET = 7 * 3_600_000;

/** `YYYY-MM-DD` (WIB) dari sebuah Date. */
function tanggalWIB(tanggal) {
  return new Date(tanggal.getTime() + WIB_OFFSET).toISOString().slice(0, 10);
}

/** Tengah malam WIB pada `YYYY-MM-DD`, sebagai instant UTC. */
function awalHariWIB(ymd) {
  return new Date(`${ymd}T00:00:00.000Z`).getTime() - WIB_OFFSET;
}

function parsePeriode(query) {
  const errors = [];
  const nilai = {};

  for (const key of ["tanggalAwal", "tanggalAkhir"]) {
    if (query[key] === undefined) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query[key]) || Number.isNaN(Date.parse(query[key]))) {
      errors.push(`${key} harus berformat YYYY-MM-DD`);
    } else {
      nilai[key] = query[key];
    }
  }

  if (nilai.tanggalAwal && nilai.tanggalAkhir && nilai.tanggalAwal > nilai.tanggalAkhir) {
    errors.push("tanggalAwal tidak boleh setelah tanggalAkhir");
  }

  return { errors, ...nilai };
}

/**
 * Periode default kalau client tidak menyebutkan: bulan terisi paling baru,
 * dipotong di hari ini kalau bulan itu masih berjalan — bentuk yang sama dengan
 * "01-08-2026 s/d 17-08-2026" di SIREMDIS.
 *
 * Default "bulan berjalan" tanpa melihat isi akan menampilkan layar kosong di
 * bulan yang belum ada pelayanannya, dan itu tidak bisa dibedakan dari gagal
 * memuat.
 */
function periodeDefault(bulanTerbaru, sekarang) {
  const hariIni = tanggalWIB(sekarang);
  if (!bulanTerbaru) return { tanggalAwal: `${hariIni.slice(0, 7)}-01`, tanggalAkhir: hariIni };

  const [tahun, bulan] = bulanTerbaru.split("-").map(Number);
  // Hari terakhir bulan itu: hari ke-0 bulan berikutnya.
  const akhirBulan = tanggalWIB(new Date(Date.UTC(tahun, bulan, 0) - WIB_OFFSET));
  return {
    tanggalAwal: `${bulanTerbaru}-01`,
    tanggalAkhir: akhirBulan < hariIni ? akhirBulan : hariIni,
  };
}

router.get("/", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const periode = parsePeriode(req.query);
  if (periode.errors.length > 0) {
    return res.status(400).json({ message: "Query params tidak valid", errors: periode.errors });
  }

  // dokterId untuk DOKTER selalu dari JWT. `?dokterId=` cuma dihormati untuk
  // ADMIN — parseDokterIdFilter sudah membuangnya kalau pemanggilnya DOKTER.
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
  // dari periode yang sedang dilihat — kalau ikut periode, pintasan bulan di
  // layar cuma akan berisi bulan yang sedang dibuka.
  const semuaTanggal = await prisma.pendapatan.findMany({
    where: { dokterId },
    select: { tanggalTindakan: true },
  });
  const bulanTersedia = [...new Set(semuaTanggal.map((p) => tanggalWIB(p.tanggalTindakan).slice(0, 7)))]
    .sort()
    .reverse();

  const bawaan = periodeDefault(bulanTersedia[0], new Date());
  const tanggalAwal = periode.tanggalAwal ?? bawaan.tanggalAwal;
  const tanggalAkhir = periode.tanggalAkhir ?? bawaan.tanggalAkhir;

  const baris = await prisma.pendapatan.findMany({
    where: {
      dokterId,
      tanggalTindakan: {
        gte: new Date(awalHariWIB(tanggalAwal)),
        // Batas atas inklusif: "s/d 17-08" berarti sepanjang tanggal 17 ikut,
        // jadi yang dipakai awal hari BERIKUTNYA sebagai batas eksklusif.
        lt: new Date(awalHariWIB(tanggalAkhir) + 86_400_000),
      },
    },
    select: BARIS_SELECT,
    orderBy: { tanggalTindakan: "desc" },
  });

  // Decimal Prisma diserialisasi jadi string kalau dibiarkan; frontend
  // menjumlah dan memformatnya sebagai angka, jadi dikonversi di sini sekali.
  const data = baris.map((b) => ({ ...b, jasa: Number(b.jasa) }));

  // Pengelompokan tunggal laporan ini: JKN vs Non-JKN, dijumlah dari seluruh
  // baris periode. Tidak ada pemisahan lain (per penjamin, per status klaim) —
  // total jasa medis cuma dipecah dua.
  const totalJkn = data.filter((b) => b.penjamin.isJkn).reduce((n, b) => n + b.jasa, 0);
  const totalNonJkn = data.filter((b) => !b.penjamin.isJkn).reduce((n, b) => n + b.jasa, 0);

  res.json({
    dokter: { id: dokter.id, nama: dokter.nama, smf: dokter.spesialisasi },
    periode: { tanggalAwal, tanggalAkhir },
    bulanTersedia,
    ringkasan: {
      totalJkn,
      totalNonJkn,
      totalRemunerasiBruto: totalJkn + totalNonJkn,
      jumlahPelayanan: data.length,
    },
    data,
  });
});

module.exports = router;
