const { parseTanggalAwalWIB, parseTanggalAkhirWIB } = require("./wib");

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// Parsing rentang tanggal "YYYY-MM-DD" (kalender WIB, batas inklusif di kedua
// ujung). Nama paramnya beda-beda antar modul — lab pakai
// dariTanggal/sampaiTanggal, sisanya dari/sampai — jadi diterima sebagai
// argumen, bukan dipatok. Pesan errornya sengaja sama persis di semua
// pemakainya — bagian dari kontrak API.
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
// Dua pertanyaan berbeda:
//   saya   -> kunjungan/operasi yang dokter ini TERLIBAT di dalamnya
//   pasien -> semua kunjungan/operasi milik pasien yang pernah dia tangani,
//             termasuk yang ditangani dokter lain sepenuhnya
//
// "pasien" benar untuk AKSES (dokter memang boleh membuka riwayat pasiennya)
// tapi salah sebagai isi JADWAL: pada data asli, satu dokter penyakit dalam
// punya 692 kunjungan tampil di layar jadwal padahal cuma 103 yang melibatkan
// dia; di tab Operasi 46 dari 46 malah milik dokter lain karena dia bukan
// dokter bedah.
//
// Default "saya" — yang ditanyakan layar Jadwal adalah "apa pekerjaan saya".
// Cakupan lebih luas tetap tersedia lewat ?lingkup=pasien.
function parseLingkupJadwal(query) {
  return query.lingkup === "pasien" ? "pasien" : "saya";
}

// Apakah klien benar-benar butuh jumlah total baris.
//
// Default MATI — bukan selera, tapi performa: pada dokter dengan 8.726
// pasien, COUNT lewat derived table akses DPJP makan 1,7 detik, hampir dua
// kali biaya mengambil datanya sendiri (0,9 detik), sementara tidak ada satu
// pun layar frontend yang membaca `pagination.total`/`totalPages`.
//
// Tetap bisa diminta lewat `?hitungTotal=1` untuk alat bantu (Postman, skrip
// audit) atau layar bernomor halaman nanti. Kalau ada yang butuh, kirim param
// itu — jangan balikkan defaultnya, karena yang mahal tetap mahal.
function parseHitungTotal(query) {
  return query.hitungTotal === "1" || query.hitungTotal === "true";
}

// Parsing & validasi page/limit, dipakai semua endpoint list yang paginated
// (pasien/kunjungan/lab/notifikasi/operasi routes).
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
