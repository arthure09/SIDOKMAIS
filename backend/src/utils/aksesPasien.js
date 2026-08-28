const prisma = require("../lib/prisma");

// Sumber kebenaran akses dokter->pasien di seluruh backend: dokter dianggap
// berhak lihat data pasien kalau ada baris DokterPasienAssignment yang
// menghubungkan keduanya (status apa pun, ACTIVE maupun COMPLETED — bukan
// cuma assignment "dokterId" yang kebetulan tercatat di satu baris
// Kunjungan/Operasi tertentu). Dipakai konsisten di pasien/lab/kunjungan/operasi
// supaya dokter yang di-assign ke pasien tetap bisa lihat kunjungan/operasinya
// meskipun baris itu sendiri tercatat dokterId dokter lain.
async function dokterPunyaAksesPasien(dokterId, pasienId) {
  const assignment = await prisma.dokterPasienAssignment.findFirst({
    where: { dokterId, pasienId },
  });
  return Boolean(assignment);
}

module.exports = { dokterPunyaAksesPasien };
