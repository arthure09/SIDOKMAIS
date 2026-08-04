const prisma = require("../lib/prisma");

// Sumber kebenaran akses dokter->pasien di seluruh backend: dokter dianggap
// berhak lihat data pasien kalau ada baris DokterPasienAssignment yang
// menghubungkan keduanya (status apa pun, ACTIVE maupun COMPLETED — bukan
// cuma assignment "dokterId" yang kebetulan tercatat di satu baris
// Kunjungan/Operasi tertentu). Awalnya cuma dipakai pasien.routes.js &
// lab.routes.js (Day 18, docs/prompts/prompts-day-21-18-19.md — "pasien
// onkologi sering ditangani lintas dokter"), sekarang dipakai juga di
// kunjungan.routes.js & operasi.routes.js (Day 22) supaya dokter yang
// di-assign ke pasien tetap bisa lihat kunjungan/operasinya meskipun
// kunjungan itu sendiri tercatat dokterId dokter lain.
//
// Keputusan sudah dikonfirmasi (Day 22, 2026-08-04) — DokterPasienAssignment
// adalah basis scoping akses dokter->pasien di seluruh backend, dipakai
// konsisten di pasien/lab/kunjungan/operasi.
async function dokterPunyaAksesPasien(dokterId, pasienId) {
  const assignment = await prisma.dokterPasienAssignment.findFirst({
    where: { dokterId, pasienId },
  });
  return Boolean(assignment);
}

module.exports = { dokterPunyaAksesPasien };
