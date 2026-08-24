// Kode pendek modalitas untuk penanda kiri di daftar radiologi.
//
// Nama modalitas datang apa adanya dari `master.tindakan_klp_radiologi` dan
// ejaannya tidak seragam: huruf kecil semua ("konvensional"), huruf besar semua
// ("MOBIL MAMMOGRAFI"), sampai gabungan dua modalitas ("PET CT DAN CT BRAIN").
// Karena itu pencocokannya per POTONGAN KATA dan berurutan, bukan tabel padanan
// persis — tabel persis akan meleset tiap kali tim SIMRS menambah satu
// kelompok baru, dan yang muncul di layar dokter jadi potongan nama acak.
const ATURAN: [RegExp, string][] = [
  // "PET CT DAN CT BRAIN" harus jadi PET, bukan CT — makanya PET diperiksa duluan.
  [/\bpet\b/i, 'PET'],
  [/mammograf/i, 'MMG'],
  [/\bct\b|tomograf/i, 'CT'],
  [/\bmri\b|magnetic/i, 'MRI'],
  [/\busg\b|ultraso/i, 'USG'],
  [/flou?roscop|fluorosk/i, 'FLR'],
  [/gamma|nuklir/i, 'NUK'],
  [/intervensi/i, 'INT'],
  [/konvensional|rontgen|röntgen|x-?ray/i, 'RO'],
];

/** Maksimal 3 huruf supaya lebar bloknya tetap. Null/kosong -> "RAD". */
export function kodeModalitas(modalitas: string | null | undefined): string {
  const nama = (modalitas ?? '').trim();
  if (!nama) return 'RAD';

  for (const [pola, kode] of ATURAN) {
    if (pola.test(nama)) return kode;
  }

  // Kelompok baru yang belum dikenali: pakai tiga huruf pertamanya. Lebih baik
  // daripada "RAD" untuk semua — dokter tetap bisa membedakan dua modalitas
  // asing di daftar yang sama.
  return nama.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'RAD';
}
