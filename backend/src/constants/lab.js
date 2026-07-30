// Satu sumber kebenaran daftar kategori lab. `PemeriksaanLab.kategori` bertipe
// String (bukan enum) karena daftar resmi RS Dharmais belum dikonfirmasi
// supervisor — dipakai seed sekarang, nanti dipakai validasi endpoint juga.
const LAB_KATEGORI = [
  "Hematologi",
  "Kimia Klinik",
  "Mikrobiologi",
  "Patologi Anatomi",
  "Imunologi",
  "Urinalisis",
];

module.exports = { LAB_KATEGORI };
