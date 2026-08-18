import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  PasienTab: NavigatorScreenParams<PasienStackParamList> | undefined;
  OperasiTab: undefined;
  NotifikasiTab: undefined;
  ProfilTab: undefined;
};

/**
 * Alur Hasil Lab punya dua pintu masuk — dari tile Menu di Home (lewat pilih
 * pasien dulu) dan dari PasienDetail — jadi route-nya didaftarkan di dua stack.
 * Bentuknya dishare di sini supaya kalau paramnya berubah, dua-duanya ikut.
 */
type LabRoutes = {
  HasilLabList: { pasienId: string; nama: string };
  HasilLabDetail: { pemeriksaanLabId: string };
  LihatPdfLab: { namaLaporan: string; tanggal: string };
};

/**
 * Screen yang dibuka dari tile Menu di Home tinggal di stack HomeTab sendiri,
 * bukan menumpang stack tab lain. Dengan begitu "kembali" — tombol header,
 * back Android, dan gestur swipe iOS yang jalan di native tanpa lewat JS —
 * ketiganya pop ke Home apa adanya, tanpa param `fromHome` atau hook khusus.
 */
export type HomeStackParamList = {
  Home: undefined;
  DataPendapatan: undefined;
  // `buatBaru` dikirim tombol "Tambah Pengingat" di Home — form catatan langsung
  // terbuka begitu screen-nya muncul, bukan mendarat di kalender kosong.
  CatatanKalender: { buatBaru?: boolean } | undefined;
  PilihPasienHasilLab: undefined;
} & LabRoutes;

export type PasienStackParamList = {
  PasienList: undefined;
  PasienDetail: { pasienId: string; nama: string };
} & LabRoutes;

export type OperasiStackParamList = {
  JadwalOperasiKonsul: undefined;
  DetailJadwalOperasi: { operasiId: string };
  // Konsultasi punya model sendiri sejak Tahap 2 — sebelumnya layar ini
  // membaca Kunjungan, yang ternyata bukan bentuk aslinya (lihat
  // docs/rencana-revisi-modul-dokter.md).
  DetailKonsul: { konsultasiId: string };
};

export type NotifikasiStackParamList = {
  NotifikasiList: undefined;
  DetailNotifikasi: {
    kategori: 'Pasien Baru' | 'Jadwal';
    judul: string;
    pesan: string;
    waktu: string;
    icon: string;
    isRead: boolean;
    /** Cuma diisi kalau yang buka layar ini ADMIN (lintas dokter). */
    dokterNama?: string;
  };
};

export type ProfilStackParamList = {
  ProfilDokter: undefined;
};
