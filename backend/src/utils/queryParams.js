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
};
