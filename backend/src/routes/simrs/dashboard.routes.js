const express = require("express");
const { q } = require("../../lib/simrs");
const { simrsDokterId } = require("../../utils/simrsAkses");
const { WIB_OFFSET_MS, rentangDariTengahMalamWIB, rentangHariWIB } = require("../../utils/wib");
const {
  keWaktuSimrs,
  tanggalWIB,
  tanggalJamWIB,
  teks,
  SQL_KUNJUNGAN_KLINIS,
} = require("../../utils/simrsBentuk");

const router = express.Router();

// Dashboard versi SIMRS — sumber "Aktivitas Hari Ini", "Statistik Pasien
// Mingguan", dan "Pasien Prioritas" di HomeScreen. Bentuk response identik
// dengan routes/dummy/dashboard.routes.js.
//
// Lingkupnya "saya terlibat", bukan "pasien saya": penyaringnya keterlibatan
// langsung (klausa yang sama dipakai `?lingkup=saya` di kunjungan/operasi),
// bukan himpunan akses DPJP se-riwayat pasien — dokter senior bisa terkait
// belasan ribu pasien unik se-riwayat, dan itu angka rumah sakit, bukan
// agenda pribadi hari ini.
//
// Kalau replika SIMRS berhenti tersinkronisasi, "hari ini" dan minggu
// berjalan bisa bernilai 0 — bukan karena query salah, datanya belum sampai.
// Grafik terisi lagi begitu replikasi jalan.

const HARI_LABEL = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const JUMLAH_PASIEN_PRIORITAS = 3;

// Dokter terlibat di KUNJUNGAN ini — sama persis dengan TERLIBAT_KUNJUNGAN di
// simrs/kunjungan.routes.js. Ketiga peran DPJP dihitung. Butuh 3 parameter.
const TERLIBAT_KUNJUNGAN = `(
  tp.DOKTER = ?
  OR EXISTS (SELECT 1 FROM pendaftaran.dpjp_bersama db
              WHERE db.NOPEN = k.NOPEN AND db.DOKTER = ?)
  OR EXISTS (SELECT 1 FROM pendaftaran.dpjp_pendamping dp
              WHERE dp.NOPEN = k.NOPEN AND dp.DOKTER = ?)
)`;

// Dokter terlibat di OPERASI ini — sama dengan simrs/operasi.routes.js:
// pengaju waiting list belum tentu yang mengoperasi. Butuh 2 parameter.
const TERLIBAT_OPERASI = "(wl.id_dokter = ? OR pd.dokter_bedah = ?)";

// Operasi batal bukan kegiatan. Penyaring yang sama sudah dipakai daftar
// jadwal & pasienPrioritas; tanpa ini "Operasi hari ini: 2" bisa berisi dua
// operasi yang sudah dibatalkan kemarin.
const OPERASI_TIDAK_BATAL = `
  NULLIF(TRIM(wl.alasan_batal), '') IS NULL
  AND NOT (po.status <=> 5)
`;

const SUMBER_OPERASI = `
  FROM medis.tb_waiting_list_operasi wl
  LEFT JOIN medis.tb_pendaftaran_operasi pd ON pd.id = wl.id_pendaftaran_operasi
  LEFT JOIN perjanjian.penjadwalan_operasi po ON po.id_waiting_list_operasi = wl.id
`;

// `master.ruangan` ikut di-join bukan untuk menampilkan nama, tapi untuk
// MENYARING: satu pendaftaran menghasilkan banyak baris kunjungan (poliklinik,
// farmasi, lab, radiologi) dan hanya sebagian yang pertemuan dokter-pasien.
// Tanpa ini "Kunjungan hari ini" untuk satu dokter terbaca 421, padahal
// pertemuan sebenarnya 194 — sisanya pengambilan obat dan cek penunjang.
const SUMBER_KUNJUNGAN = `
  FROM pendaftaran.kunjungan k
  JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
  JOIN master.ruangan r ON r.ID = k.RUANGAN
  LEFT JOIN pendaftaran.tujuan_pasien tp ON tp.NOPEN = k.NOPEN
`;

// Sama persis dengan versi dummy — disalin apa adanya supaya kedua mode
// memotong minggu di batas yang identik.
function getRentangMingguIniWIB() {
  const now = new Date();
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const hariKe = wib.getUTCDay();
  const jarakDariSenin = (hariKe + 6) % 7;
  const y = wib.getUTCFullYear();
  const m = wib.getUTCMonth();
  const dSenin = wib.getUTCDate() - jarakDariSenin;

  return HARI_LABEL.map((label, i) => ({
    label,
    ...rentangDariTengahMalamWIB(Date.UTC(y, m, dSenin + i)),
  }));
}

// Satu query per metrik, semuanya COUNT/agregat — tidak ada baris pasien yang
// ditarik ke aplikasi untuk kebutuhan angka.
async function statistikDokter(dokterId) {
  const { mulai, akhir } = rentangHariWIB(new Date());
  const minggu = getRentangMingguIniWIB();
  const mingguMulai = keWaktuSimrs(minggu[0].mulai);
  const mingguAkhir = keWaktuSimrs(minggu[minggu.length - 1].akhir);
  const hariMulai = keWaktuSimrs(mulai);
  const hariAkhir = keWaktuSimrs(akhir);
  const hariTanggal = hariMulai.slice(0, 10);

  // Paralel lagi (dulu berurutan): kelima query ini tidak membangun himpunan
  // akses DPJP se-riwayat, jadi tidak ada derived table mahal yang diperebutkan.
  // Semuanya EXISTS/kesetaraan per baris di atas kolom ber-index.
  const [pasienHariIni, operasiHariIni, kunjunganHariIni, kunjunganMinggu, operasiMinggu] =
    await Promise.all([
      // Pasien yang SAYA tangani hari ini — kunjungan dan operasi digabung
      // UNION supaya pasien yang hari ini punya keduanya dihitung sekali.
      // Bukan "pasien aktif" se-riwayat: itu angka rumah sakit, bukan agenda.
      q(
        `SELECT COUNT(*) AS n FROM (
           SELECT pd.NORM AS norm
             ${SUMBER_KUNJUNGAN}
            WHERE ${TERLIBAT_KUNJUNGAN}
              AND ${SQL_KUNJUNGAN_KLINIS}
              AND k.MASUK >= ? AND k.MASUK <= ?
           UNION
           SELECT wl.norm AS norm
             ${SUMBER_OPERASI}
            WHERE ${TERLIBAT_OPERASI}
              AND ${OPERASI_TIDAK_BATAL}
              AND COALESCE(pd.tanggal_operasi, wl.tanggal) = ?
         ) x`,
        [dokterId, dokterId, dokterId, hariMulai, hariAkhir, dokterId, dokterId, hariTanggal]
      ),

      q(
        `SELECT COUNT(*) AS n
           ${SUMBER_OPERASI}
          WHERE ${TERLIBAT_OPERASI}
            AND ${OPERASI_TIDAK_BATAL}
            AND COALESCE(pd.tanggal_operasi, wl.tanggal) = ?`,
        [dokterId, dokterId, hariTanggal]
      ),

      q(
        `SELECT COUNT(*) AS n
           ${SUMBER_KUNJUNGAN}
          WHERE ${TERLIBAT_KUNJUNGAN}
            AND ${SQL_KUNJUNGAN_KLINIS}
            AND k.MASUK >= ? AND k.MASUK <= ?`,
        [dokterId, dokterId, dokterId, hariMulai, hariAkhir]
      ),

      // Dikelompokkan per tanggal DI DATABASE (GROUP BY DATE), bukan menarik
      // tiap baris lalu dihitung di JS seperti versi dummy.
      q(
        `SELECT DATE(k.MASUK) AS tgl, COUNT(*) AS n
           ${SUMBER_KUNJUNGAN}
          WHERE ${TERLIBAT_KUNJUNGAN}
            AND ${SQL_KUNJUNGAN_KLINIS}
            AND k.MASUK >= ? AND k.MASUK <= ?
          GROUP BY DATE(k.MASUK)`,
        [dokterId, dokterId, dokterId, mingguMulai, mingguAkhir]
      ),

      q(
        `SELECT COALESCE(pd.tanggal_operasi, wl.tanggal) AS tgl, COUNT(*) AS n
           ${SUMBER_OPERASI}
          WHERE ${TERLIBAT_OPERASI}
            AND ${OPERASI_TIDAK_BATAL}
            AND COALESCE(pd.tanggal_operasi, wl.tanggal) >= ?
            AND COALESCE(pd.tanggal_operasi, wl.tanggal) <= ?
          GROUP BY COALESCE(pd.tanggal_operasi, wl.tanggal)`,
        [dokterId, dokterId, mingguMulai.slice(0, 10), mingguAkhir.slice(0, 10)]
      ),
    ]);

  // Peta "YYYY-MM-DD" -> jumlah, dari kedua sumber.
  const perHari = new Map();
  for (const baris of [...kunjunganMinggu, ...operasiMinggu]) {
    const kunci = String(baris.tgl).slice(0, 10);
    perHari.set(kunci, (perHari.get(kunci) ?? 0) + Number(baris.n));
  }

  const aktivitasMingguan = minggu.map(({ label, mulai: mulaiHari }) => ({
    label,
    jumlah: perHari.get(keWaktuSimrs(mulaiHari).slice(0, 10)) ?? 0,
    highlight: mulaiHari.getTime() === mulai.getTime(),
  }));

  return {
    pasienHariIni: Number(pasienHariIni[0]?.n ?? 0),
    operasiHariIni: Number(operasiHariIni[0]?.n ?? 0),
    kunjunganHariIni: Number(kunjunganHariIni[0]?.n ?? 0),
    aktivitasMingguan,
  };
}

// 3 jadwal terdekat ke depan, digabung dari Kunjungan & Operasi — pola sama
// dengan versi dummy: ambil top-N dari masing-masing sumber, gabung, urutkan,
// potong. Kalau digabung langsung di SQL, hasilnya bisa habis diambil satu
// sumber saja sebelum sempat diurutkan.
async function pasienPrioritas(dokterId) {
  const sekarang = keWaktuSimrs(new Date());

  // Lingkupnya sama dengan statistik di atas: jadwal yang SAYA terlibat di
  // dalamnya. "Pasien Prioritas" yang isinya jadwal dokter lain tidak bisa
  // ditindaklanjuti siapa pun yang membacanya.
  const [kunjungan, operasi] = await Promise.all([
    q(
      `SELECT k.NOMOR AS id, k.MASUK AS waktu, pas.NAMA AS nama, r.DESKRIPSI AS ruangan
         ${SUMBER_KUNJUNGAN}
         LEFT JOIN master.pasien pas ON pas.NORM = pd.NORM
        WHERE ${TERLIBAT_KUNJUNGAN}
          AND ${SQL_KUNJUNGAN_KLINIS}
          AND k.MASUK >= ? AND k.KELUAR IS NULL
        ORDER BY k.MASUK ASC LIMIT ${JUMLAH_PASIEN_PRIORITAS}`,
      [dokterId, dokterId, dokterId, sekarang]
    ),
    q(
      `SELECT wl.id AS id, COALESCE(pd.tanggal_operasi, wl.tanggal) AS tgl,
              pd.jam_operasi AS jam, pas.NAMA AS nama,
              COALESCE(r.DESKRIPSI, pd.ruang_tujuan) AS ruangan
         ${SUMBER_OPERASI}
         LEFT JOIN master.pasien pas ON pas.NORM = wl.norm
         LEFT JOIN master.ruangan r ON r.ID = pd.ruang_tujuan
        WHERE ${TERLIBAT_OPERASI}
          AND ${OPERASI_TIDAK_BATAL}
          AND COALESCE(pd.tanggal_operasi, wl.tanggal) >= ?
        ORDER BY COALESCE(pd.tanggal_operasi, wl.tanggal) ASC, wl.id ASC
        LIMIT ${JUMLAH_PASIEN_PRIORITAS}`,
      [dokterId, dokterId, sekarang.slice(0, 10)]
    ),
  ]);

  const kandidat = [
    ...kunjungan.map((k) => ({
      id: k.id,
      jenis: "KUNJUNGAN",
      nama: k.nama ?? null,
      lokasi: `${teks(k.ruangan) ?? "Ruangan"} — Kunjungan`,
      waktu: tanggalWIB(k.waktu),
    })),
    ...operasi.map((o) => ({
      id: String(o.id),
      jenis: "OPERASI",
      nama: o.nama ?? null,
      lokasi: `${teks(o.ruangan) ?? "Ruang operasi"} — Operasi`,
      waktu: tanggalJamWIB(o.tgl, o.jam),
    })),
  ].filter((x) => x.waktu);

  kandidat.sort((a, b) => a.waktu.getTime() - b.waktu.getTime());

  return kandidat.slice(0, JUMLAH_PASIEN_PRIORITAS).map(({ waktu, ...sisa }) => ({
    ...sisa,
    waktu: waktu.toISOString(),
  }));
}

router.get("/statistik", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const minggu = getRentangMingguIniWIB();

  // ADMIN: sama seperti versi dummy — akun ADMIN tidak terikat ke satu Dokter,
  // jadi tidak ada "aku" yang bisa dihitung. Balikin 0 + catatan eksplisit,
  // bukan agregat lintas-dokter yang akan disalahpahami sebagai milik akunnya.
  if (role === "ADMIN") {
    const now = Date.now();
    const idx = minggu.findIndex(({ mulai, akhir }) => now >= mulai.getTime() && now <= akhir.getTime());
    return res.json({
      pasienHariIni: 0,
      operasiHariIni: 0,
      kunjunganHariIni: 0,
      aktivitasMingguan: minggu.map(({ label }, i) => ({ label, jumlah: 0, highlight: i === idx })),
      pasienPrioritas: [],
      adminCatatan:
        "Akun ADMIN tidak terikat ke satu Dokter, jadi statistik ini tidak relevan (selalu 0).",
    });
  }

  const dokterId = await simrsDokterId(ownDokterId);
  if (!dokterId) {
    return res.status(403).json({ message: "Akun dokter ini tidak terdaftar di SIMRS" });
  }

  // Berurutan juga: dua-duanya menembak himpunan akses DPJP yang sama, jadi
  // menjalankannya bersamaan cuma menambah rebutan (lihat catatan di
  // statistikDokter).
  const statistik = await statistikDokter(dokterId);
  const prioritas = await pasienPrioritas(dokterId);

  res.json({ ...statistik, pasienPrioritas: prioritas });
});

module.exports = router;
