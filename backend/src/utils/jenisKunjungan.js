// Kategori kunjungan TIDAK disimpan sebagai kolom sendiri di Kunjungan:
// nilainya sudah ada di Ruangan.jenis, dan `ruanganId` wajib di tiap Kunjungan.
// Kolom terpisah cuma bikin dua sumber kebenaran yang bisa saling bertentangan
// (kunjungan bertipe RAWAT_INAP yang ruangannya poli).
//
// Kosakata publik (API + UI) sengaja beda dari taksonomi Ruangan; `POLI`
// adalah detail internal yang tidak perlu bocor ke query string.
const KE_RUANGAN_JENIS = { RAWAT_JALAN: "POLI", IGD: "IGD", RAWAT_INAP: "RAWAT_INAP" };

const DARI_RUANGAN_JENIS = Object.fromEntries(
  Object.entries(KE_RUANGAN_JENIS).map(([kategori, jenis]) => [jenis, kategori])
);

const JENIS_KUNJUNGAN = Object.keys(KE_RUANGAN_JENIS);

// `OK` sengaja tidak dipetakan: operasi punya `ruanganId` sendiri, jadi
// Kunjungan tidak pernah menunjuk ruang OK. Kalau ada baris lama yang begitu,
// null lebih jujur daripada menebak kategorinya.
function jenisKunjungan(ruangan) {
  if (!ruangan || !Object.hasOwn(DARI_RUANGAN_JENIS, ruangan.jenis)) return null;
  return DARI_RUANGAN_JENIS[ruangan.jenis];
}

// Return { errors, ruanganJenis } — `ruanganJenis` undefined kalau filter tidak
// dipakai. Whitelist, bukan passthrough: nilai ini masuk ke where Prisma.
function parseJenisKunjungan(query) {
  if (query.jenisKunjungan === undefined) return { errors: [] };

  // hasOwn, bukan lookup langsung: `?jenisKunjungan=__proto__` bakal ketemu
  // Object.prototype yang truthy dan lolos ke where Prisma.
  if (!Object.hasOwn(KE_RUANGAN_JENIS, query.jenisKunjungan)) {
    return { errors: [`jenisKunjungan harus salah satu dari: ${JENIS_KUNJUNGAN.join(", ")}`] };
  }
  return { errors: [], ruanganJenis: KE_RUANGAN_JENIS[query.jenisKunjungan] };
}

module.exports = { JENIS_KUNJUNGAN, jenisKunjungan, parseJenisKunjungan };
