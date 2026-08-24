const express = require("express");
const prisma = require("../lib/prisma");
const { WIB_OFFSET_MS, rentangDariTengahMalamWIB, rentangHariWIB } = require("../utils/wib");

const router = express.Router();

const HARI_LABEL = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

// Rentang "hari ini" menurut kalender WIB.
function getRentangHariIniWIB() {
  return rentangHariWIB(new Date());
}

// 7 rentang harian (Senin..Minggu) untuk minggu kalender WIB berjalan —
// dipakai chart "Statistik Pasien Mingguan" di Home. `wib.getUTCDay()` di
// sini membaca angka hari (0=Minggu..6=Sabtu) dari waktu yang SUDAH digeser
// ke WIB, jadi hasilnya adalah hari-dalam-minggu WIB, bukan UTC — konsisten
// dengan pola getRentangHariIniWIB di atas. `Date.UTC(y, m, dSenin + i)`
// aman dipakai walau dSenin+i "meluber" ke bulan sebelum/sesudahnya (mis.
// Senin minggu ini jatuh di bulan lalu) karena JS Date menormalisasi
// overflow tanggal secara otomatis.
function getRentangMingguIniWIB() {
  const now = new Date();
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const hariKe = wib.getUTCDay(); // 0=Minggu..6=Sabtu
  const jarakDariSenin = (hariKe + 6) % 7; // Senin=0, Selasa=1, ..., Minggu=6
  const y = wib.getUTCFullYear();
  const m = wib.getUTCMonth();
  const dSenin = wib.getUTCDate() - jarakDariSenin;

  return HARI_LABEL.map((label, i) => ({
    label,
    ...rentangDariTengahMalamWIB(Date.UTC(y, m, dSenin + i)),
  }));
}

function hitungDalamRentang(waktuList, mulai, akhir) {
  const mulaiMs = mulai.getTime();
  const akhirMs = akhir.getTime();
  return waktuList.filter((waktu) => {
    const ms = waktu.getTime();
    return ms >= mulaiMs && ms <= akhirMs;
  }).length;
}

const JUMLAH_PASIEN_PRIORITAS = 3;

// 3 jadwal (Operasi/Kunjungan) TERDEKAT ke depan buat "Pasien Prioritas" di
// Home. Cuma status SCHEDULED yang dihitung "jadwal mendatang" — sengaja
// tidak ikutkan ONGOING (kunjungan yang sudah berjalan tapi tanggalMasuk-nya
// di masa lalu, belum ada preseden gimana itu harus diprioritaskan relatif
// ke SCHEDULED lain) supaya urutannya konsisten cuma berdasar "makin dekat
// makin prioritas". Ambil top-N dari MASING-MASING tabel dulu (bukan top-N
// gabungan langsung di query), baru digabung+diurut+dipotong di JS — supaya
// tetap benar walau top-N gabungan ternyata semuanya dari 1 tabel saja.
async function getPasienPrioritas(terlibat) {
  const now = new Date();

  const [kunjunganMendatang, operasiMendatang] = await Promise.all([
    prisma.kunjungan.findMany({
      where: { tanggalMasuk: { gte: now }, statusKunjungan: "SCHEDULED", ...terlibat },
      orderBy: { tanggalMasuk: "asc" },
      take: JUMLAH_PASIEN_PRIORITAS,
      select: {
        id: true,
        tanggalMasuk: true,
        pasien: { select: { nama: true } },
        ruangan: { select: { nama: true } },
      },
    }),
    prisma.operasi.findMany({
      where: { tanggalOperasi: { gte: now }, status: "SCHEDULED", kunjungan: terlibat },
      orderBy: { tanggalOperasi: "asc" },
      take: JUMLAH_PASIEN_PRIORITAS,
      select: {
        id: true,
        tanggalOperasi: true,
        ruangan: { select: { nama: true } },
        kunjungan: { select: { pasien: { select: { nama: true } } } },
      },
    }),
  ]);

  const kandidat = [
    ...kunjunganMendatang.map((k) => ({
      id: k.id,
      jenis: "KUNJUNGAN",
      nama: k.pasien.nama,
      lokasi: `${k.ruangan.nama} — Kunjungan`,
      waktu: k.tanggalMasuk,
    })),
    ...operasiMendatang.map((o) => ({
      id: o.id,
      jenis: "OPERASI",
      nama: o.kunjungan.pasien.nama,
      lokasi: `${o.ruangan.nama} — Operasi`,
      waktu: o.tanggalOperasi,
    })),
  ];

  kandidat.sort((a, b) => a.waktu.getTime() - b.waktu.getTime());

  return kandidat.slice(0, JUMLAH_PASIEN_PRIORITAS).map(({ waktu, ...rest }) => ({
    ...rest,
    waktu: waktu.toISOString(),
  }));
}

// GET /api/dashboard/statistik — ringkasan "Aktivitas Hari Ini" +
// "Statistik Pasien Mingguan" di HomeScreen.
//
// LINGKUPNYA "SAYA TERLIBAT", BUKAN "PASIEN SAYA" (diperbaiki 24 Ags 2026) —
// lihat catatan panjang di simrs/dashboard.routes.js. Dashboard menjawab "apa
// kegiatan SAYA hari ini", jadi penyaringnya `dokterId` langsung di
// Kunjungan/Operasi, bukan `DokterPasienAssignment` yang mencakup seluruh
// riwayat pasien. `pasienHariIni` juga bukan lagi jumlah assignment aktif —
// itu angka se-riwayat yang tidak ada kaitannya dengan hari ini.
//
// `pasienHariIni`/`operasiHariIni`/`kunjunganHariIni` menggantikan mekanisme lama
// di frontend (fetch list dengan RINGKASAN_FETCH_LIMIT=100 lalu filter+hitung
// di client, yang undercounted kalau dokter punya >100 operasi/kunjungan)
// dengan COUNT langsung di DB.
//
// `aktivitasMingguan` (keputusan Arthuro): gabungan jumlah Kunjungan +
// Operasi per hari, Senin-Minggu minggu berjalan WIB — sebelumnya
// statistikMingguan di homeMock.ts murni chart placeholder hardcoded
// (sengaja, lihat docs/prompts/frontend-screens-figma-batch.md), belum
// pernah dipetakan ke data asli.
//
// `pasienPrioritas` (keputusan Arthuro): 3 pasien dengan jadwal Operasi/
// Kunjungan SCHEDULED terdekat ke depan — sebelumnya pasienPrioritas di
// homeMock.ts juga chart placeholder hardcoded (3 nama fiktif).
router.get("/statistik", async (req, res) => {
  const { role, dokterId } = req.user;

  if (role === "DOKTER" && !dokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const mingguRange = getRentangMingguIniWIB();

  // Keputusan desain: endpoint ini scoped ke satu Dokter dari JWT ("statistik
  // SAYA sebagai dokter yang login"). Akun ADMIN tidak terikat ke satu baris
  // Dokter (dokterId selalu null di JWT-nya), jadi tidak ada "aku" yang bisa
  // dihitung statistiknya di sini. Pilihan yang diambil: balikin 0 + catatan
  // eksplisit, BUKAN agregat lintas-semua-dokter — supaya tidak menyesatkan
  // ADMIN yang mengira angka itu "milik" akunnya. Kalau nanti benar-benar
  // perlu laporan lintas-dokter, itu endpoint terpisah dengan semantik
  // sendiri (mis. GET /api/dashboard/statistik-global), bukan overload di sini.
  if (role === "ADMIN") {
    const hariIniIdx = mingguRange.findIndex(({ mulai, akhir }) => {
      const now = Date.now();
      return now >= mulai.getTime() && now <= akhir.getTime();
    });
    return res.json({
      pasienHariIni: 0,
      operasiHariIni: 0,
      kunjunganHariIni: 0,
      aktivitasMingguan: mingguRange.map(({ label }, i) => ({
        label,
        jumlah: 0,
        highlight: i === hariIniIdx,
      })),
      pasienPrioritas: [],
      adminCatatan:
        "Akun ADMIN tidak terikat ke satu Dokter, jadi statistik ini tidak relevan (selalu 0).",
    });
  }

  const { mulai, akhir } = getRentangHariIniWIB();

  // Keterlibatan langsung, bukan akses per-pasien. Ini SENGAJA berbeda dari
  // operasi.routes.js/kunjungan.routes.js yang memakai DokterPasienAssignment:
  // di sana pertanyaannya "boleh lihat apa", di sini "saya ngapain hari ini".
  const terlibat = { dokterId };

  const mingguMulai = mingguRange[0].mulai;
  const mingguAkhir = mingguRange[mingguRange.length - 1].akhir;

  // Operasi batal bukan kegiatan — dikeluarkan dari semua hitungan hari ini
  // maupun grafik mingguan.
  const operasiBerjalan = { not: "CANCELLED" };

  const [pasienKunjunganHariIni, pasienOperasiHariIni, operasiHariIni, kunjunganHariIni, kunjunganMinggu, operasiMinggu, pasienPrioritas] =
    await Promise.all([
      // Pasien yang saya tangani HARI INI, dari dua sumber. Digabung jadi satu
      // himpunan di bawah supaya pasien yang hari ini punya kunjungan sekaligus
      // operasi tidak terhitung dua kali.
      prisma.kunjungan.findMany({
        where: { tanggalMasuk: { gte: mulai, lte: akhir }, ...terlibat },
        select: { pasienId: true },
      }),
      prisma.operasi.findMany({
        where: {
          tanggalOperasi: { gte: mulai, lte: akhir },
          status: operasiBerjalan,
          kunjungan: terlibat,
        },
        select: { kunjungan: { select: { pasienId: true } } },
      }),
      prisma.operasi.count({
        where: {
          tanggalOperasi: { gte: mulai, lte: akhir },
          status: operasiBerjalan,
          kunjungan: terlibat,
        },
      }),
      prisma.kunjungan.count({
        where: {
          tanggalMasuk: { gte: mulai, lte: akhir },
          ...terlibat,
        },
      }),
      // 2 query lintas-minggu (bukan 14 query per-hari) — hasilnya cuma
      // dipakai buat dikelompokkan per hari di JS lewat hitungDalamRentang.
      prisma.kunjungan.findMany({
        where: { tanggalMasuk: { gte: mingguMulai, lte: mingguAkhir }, ...terlibat },
        select: { tanggalMasuk: true },
      }),
      prisma.operasi.findMany({
        where: {
          tanggalOperasi: { gte: mingguMulai, lte: mingguAkhir },
          status: operasiBerjalan,
          kunjungan: terlibat,
        },
        select: { tanggalOperasi: true },
      }),
      getPasienPrioritas(terlibat),
    ]);

  const pasienHariIni = new Set([
    ...pasienKunjunganHariIni.map((k) => k.pasienId),
    ...pasienOperasiHariIni.map((o) => o.kunjungan.pasienId),
  ]).size;

  const waktuKunjungan = kunjunganMinggu.map((k) => k.tanggalMasuk);
  const waktuOperasi = operasiMinggu.map((o) => o.tanggalOperasi);

  const aktivitasMingguan = mingguRange.map(({ label, mulai: mulaiHari, akhir: akhirHari }) => ({
    label,
    jumlah:
      hitungDalamRentang(waktuKunjungan, mulaiHari, akhirHari) +
      hitungDalamRentang(waktuOperasi, mulaiHari, akhirHari),
    highlight: mulaiHari.getTime() === mulai.getTime(),
  }));

  res.json({ pasienHariIni, operasiHariIni, kunjunganHariIni, aktivitasMingguan, pasienPrioritas });
});

module.exports = router;
