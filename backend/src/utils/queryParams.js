const { parseTanggalAwalWIB, parseTanggalAkhirWIB } = require("./wib");

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// Parsing rentang tanggal "YYYY-MM-DD" (kalender WIB, batas inklusif di kedua
// ujung). Nama paramnya beda-beda antar modul — lab pakai
// dariTanggal/sampaiTanggal, sisanya dari/sampai — jadi diterima sebagai
// argumen, bukan dipatok. Blok ini tadinya diketik ulang identik di
// lab/kalender/kunjungan; pesan errornya sengaja dipertahankan sama persis
// supaya kontrak API-nya tidak berubah.
function parseRentangTanggal(query, awal = "dari", akhir = "sampai") {
  const errors = [];
  let dari;
  let sampai;

  if (query[awal] !== undefined && query[awal] !== "") {
    dari = parseTanggalAwalWIB(query[awal]);
    if (!dari) errors.push(`${awal} harus tanggal yang valid (format YYYY-MM-DD)`);
  }

  if (query[akhir] !== undefined && query[akhir] !== "") {
    sampai = parseTanggalAkhirWIB(query[akhir]);
    if (!sampai) errors.push(`${akhir} harus tanggal yang valid (format YYYY-MM-DD)`);
  }

  if (dari && sampai && dari > sampai) {
    errors.push(`${awal} tidak boleh setelah ${akhir}`);
  }

  return { errors, dari, sampai };
}

// Cakupan layar Jadwal: "saya" atau "pasien". Hanya dipakai route SIMRS.
//
// Dua pertanyaan yang berbeda, dan sebelumnya dijawab dengan satu query yang
// sama:
//   saya   -> kunjungan/operasi yang dokter ini TERLIBAT di dalamnya
//   pasien -> semua kunjungan/operasi milik pasien yang pernah dia tangani,
//             termasuk yang ditangani dokter lain sepenuhnya
//
// Aturan lama selalu memakai bentuk "pasien". Itu benar untuk AKSES (dokter
// memang boleh membuka riwayat pasiennya) tapi salah sebagai isi JADWAL, dan
// dengan data asli selisihnya bukan detail: untuk satu dokter penyakit dalam,
// 692 kunjungan tampil di layar jadwal padahal cuma 103 yang melibatkan dia.
// Di tab Operasi bahkan 46 dari 46 milik dokter lain, karena dia bukan dokter
// bedah.
//
// Default "saya" — yang ditanyakan layar Jadwal adalah "apa pekerjaan saya".
// Yang lebih luas tetap tersedia lewat ?lingkup=pasien.
function parseLingkupJadwal(query) {
  return query.lingkup === "pasien" ? "pasien" : "saya";
}

// Apakah klien benar-benar butuh jumlah total baris.
//
// Default MATI, dan itu keputusan yang diukur bukan selera. Pada dokter dengan
// 8.726 pasien, COUNT lewat derived table akses DPJP makan 1,7 detik — hampir
// dua kali biaya mengambil datanya sendiri (0,9 detik). Sementara per 24 Ags
// 2026 tidak ada SATU PUN layar di frontend yang membaca `pagination.total`
// atau `totalPages`; keduanya dihitung mahal lalu dibuang.
//
// Tetap bisa diminta lewat `?hitungTotal=1` supaya alat bantu (Postman, skrip
// audit) dan layar bernomor halaman di kemudian hari tidak kehilangan jalannya.
// Kalau nanti ada layar yang butuh, kirim param itu — jangan balikkan
// defaultnya, karena yang mahal tetap mahal.
function parseHitungTotal(query) {
  return query.hitungTotal === "1" || query.hitungTotal === "true";
}

// Parsing & validasi page/limit, dipakai semua endpoint list yang paginated
// (pasien/kunjungan/lab/notifikasi/operasi routes) — pola sebelumnya
// diketik ulang identik di tiap file.
function parsePagination(query) {
  const errors = [];

  let page = 1;
  if (query.page !== undefined) {
    page = Number(query.page);
    if (!Number.isInteger(page) || page < 1) {
      errors.push("page harus bilangan bulat >= 1");
    }
  }

  let limit = DEFAULT_LIMIT;
  if (query.limit !== undefined) {
    limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      errors.push(`limit harus bilangan bulat antara 1 dan ${MAX_LIMIT}`);
    }
  }

  return { errors, page, limit };
}

// `dokterId` cuma diterima kalau role ADMIN (dipakai buat filter lintas
// dokter) — DOKTER tidak pernah boleh nge-override filter kepemilikannya
// sendiri lewat query. Dipakai pasien/kunjungan/notifikasi/operasi routes.
function parseDokterIdFilter(query, role) {
  if (role === "ADMIN" && typeof query.dokterId === "string" && query.dokterId.trim() !== "") {
    return query.dokterId.trim();
  }
  return undefined;
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parsePagination,
  parseDokterIdFilter,
  parseRentangTanggal,
  parseHitungTotal,
  parseLingkupJadwal,
};
