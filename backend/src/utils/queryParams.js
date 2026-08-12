const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

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

module.exports = { DEFAULT_LIMIT, MAX_LIMIT, parsePagination, parseDokterIdFilter };
