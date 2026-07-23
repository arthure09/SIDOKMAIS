// Model Notifikasi & seed data-nya sudah ada di backend/prisma/seed.js, tapi endpoint
// GET-nya belum ada — teks di bawah mengikuti pola pesan yang sama (lihat seedNotifikasi)
// supaya konsisten sama nada aplikasi, ditambah 1 item bertipe "Lab" dari desain Figma
// yang jadi entry point ke DetailLaporanLabScreen.

export type NotifikasiKategori = 'Lab' | 'Jadwal' | 'Pasien Baru' | 'Sistem';

export type NotifikasiItem = {
  id: string;
  kategori: NotifikasiKategori;
  judul: string;
  pesan: string;
  waktu: string;
  isRead: boolean;
  icon: string;
  /** Kalau ada, item ini bisa di-tap untuk buka detail (satu-satunya drill-down di batch ini). */
  bukaLaporanLab?: boolean;
};

export const notifikasiList: NotifikasiItem[] = [
  {
    id: 'notif-1',
    kategori: 'Lab',
    judul: 'Hasil lab Tn. Ahmad sudah tersedia',
    pesan:
      'Hasil tes darah lengkap dan profil lipid untuk pasien Tn. Ahmad Riyadi (RM-88291) telah diunggah oleh laboratorium pusat.',
    waktu: '10 menit lalu',
    isRead: false,
    icon: 'science',
    bukaLaporanLab: true,
  },
  {
    id: 'notif-2',
    kategori: 'Jadwal',
    judul: 'Pembatalan Operasi Ny. Siti',
    pesan:
      'Operasi pengangkatan kista (09:00 WIB) dibatalkan karena kondisi pasien menurun. Silakan tinjau rekam medis terbaru.',
    waktu: '1 jam lalu',
    isRead: false,
    icon: 'event-busy',
  },
  {
    id: 'notif-3',
    kategori: 'Pasien Baru',
    judul: 'Konsultasi Rujukan: Tn. Budi Santoso',
    pesan:
      'Rujukan dari Dr. Hermawan untuk evaluasi onkologi lanjutan. Jadwal konsultasi besok pukul 10:00 WIB.',
    waktu: 'Kemarin, 14:30',
    isRead: true,
    icon: 'person-add',
  },
  {
    id: 'notif-4',
    kategori: 'Sistem',
    judul: 'Pembaruan Protokol Perawatan 2024',
    pesan:
      'Dokumen pedoman klinis terbaru untuk penanganan kemoterapi lini pertama telah diperbarui dalam sistem.',
    waktu: '2 Hari Lalu',
    isRead: true,
    icon: 'description',
  },
];

export type LaporanLabItem = {
  id: string;
  namaLaporan: string;
  tanggal: string;
};

export type LaporanLabDetail = {
  pasienNama: string;
  pasienInfo: string;
  tanggalPengambilan: string;
  jenisPemeriksaan: string;
  laporan: LaporanLabItem[];
};

export const laporanLabDetail: LaporanLabDetail = {
  pasienNama: 'Tn. Ahmad Subarjo',
  pasienInfo: 'Laki-laki, 58 Tahun • RM: 982-114-05',
  tanggalPengambilan: '12 Okt 2023, 08:30 WIB',
  jenisPemeriksaan: 'Hematologi & Lipid',
  laporan: [
    { id: 'lab-1', namaLaporan: 'Hasil Hematologi', tanggal: '12 Okt 2023' },
    { id: 'lab-2', namaLaporan: 'Profil Lipid', tanggal: '12 Okt 2023' },
    { id: 'lab-3', namaLaporan: 'Hasil Swab Antigen', tanggal: '10 Okt 2023' },
    { id: 'lab-4', namaLaporan: 'Urinalisis Lengkap', tanggal: '08 Okt 2023' },
  ],
};
