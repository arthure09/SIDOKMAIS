export type RingkasanAktivitas = {
  pasienAktif: number;
  operasiHariIni: number;
  konsulHariIni: number;
};

export const ringkasanAktivitas: RingkasanAktivitas = {
  pasienAktif: 42,
  operasiHariIni: 3,
  konsulHariIni: 12,
};

export type StatistikHarian = {
  label: string;
  persen: number;
  highlight?: boolean;
};

export const statistikMingguan: StatistikHarian[] = [
  { label: 'S', persen: 40 },
  { label: 'S', persen: 60 },
  { label: 'R', persen: 85, highlight: true },
  { label: 'K', persen: 55 },
  { label: 'J', persen: 70 },
  { label: 'S', persen: 30 },
  { label: 'M', persen: 20 },
];

export type PasienPrioritas = {
  id: string;
  nama: string;
  lokasi: string;
  waktu: string;
};

export const pasienPrioritas: PasienPrioritas[] = [
  { id: 'pp-1', nama: 'Tn. Ahmad Subarjo', lokasi: 'Ruang ICU - Bed 04', waktu: '09:45' },
  { id: 'pp-2', nama: 'Ny. Siti Aminah', lokasi: 'Ruang OK 2 - Pre-Op', waktu: '11:00' },
  { id: 'pp-3', nama: 'Tn. Budi Santoso', lokasi: 'Ruang OK 1 - In-Progress', waktu: '08:00' },
];

export type NavigasiCard = {
  id: string;
  label: string;
  icon: string;
};

// Teks label 4 kartu ini gak ke-extract lengkap dari metadata Figma ("Button - Card 1..4");
// diisi berdasarkan ikon + kesamaan dengan bottom tab (lihat catatan mikro-copy di
// docs/prompts/frontend-screens-figma-batch.md).
export const navigasiCards: NavigasiCard[] = [
  { id: 'pasien', label: 'Pasien Saya', icon: 'person-search' },
  { id: 'operasi', label: 'Jadwal Operasi', icon: 'medical-services' },
  { id: 'notifikasi', label: 'Notifikasi', icon: 'notifications' },
  { id: 'chatbot', label: 'Chatbot', icon: 'smart-toy' },
];
