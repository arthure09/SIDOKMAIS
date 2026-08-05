export type NavigasiCard = {
  id: string;
  label: string;
  icon: string;
};

// Teks label 4 kartu awal gak ke-extract lengkap dari metadata Figma ("Button - Card 1..4");
// diisi berdasarkan ikon + kesamaan dengan bottom tab (lihat catatan mikro-copy di
// docs/prompts/frontend-screens-figma-batch.md). 2 kartu tambahan (pendapatan, hasillab)
// menyusul saat quick action diperluas jadi 6 (formasi 3x2).
export const navigasiCards: NavigasiCard[] = [
  { id: 'pasien', label: 'Pasien Saya', icon: 'person-search' },
  { id: 'operasi', label: 'Jadwal Operasi', icon: 'medical-services' },
  { id: 'notifikasi', label: 'Notifikasi', icon: 'notifications' },
  { id: 'pendapatan', label: 'Data Pendapatan', icon: 'payments' },
  { id: 'hasillab', label: 'Cari Hasil Lab', icon: 'biotech' },
  { id: 'chatbot', label: 'Chatbot', icon: 'smart-toy' },
];
