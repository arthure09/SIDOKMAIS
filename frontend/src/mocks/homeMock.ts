export type NavigasiCard = {
  id: string;
  label: string;
  icon: string;
};

// 'Pasien Saya'/'Jadwal Operasi'/'Notifikasi' sengaja dihapus dari grid ini
// (audit UI-Improvement-Brief-sidokmais.md §1) — 3 tile itu 100% duplikat
// tujuan dengan bottom nav bar (Pasien/Jadwal/Notifikasi), buang-buang ruang
// tanpa nambah kecepatan akses. Sisa 3 di bawah ini satu-satunya yang gak
// punya jalur akses lain dari nav bar.
export const navigasiCards: NavigasiCard[] = [
  { id: 'pendapatan', label: 'Data Pendapatan', icon: 'payments' },
  { id: 'hasillab', label: 'Cari Hasil Lab', icon: 'biotech' },
  { id: 'radiologi', label: 'Cek Hasil Radiologi', icon: 'scanner' },
];
