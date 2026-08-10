import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  PasienTab: NavigatorScreenParams<PasienStackParamList> | undefined;
  OperasiTab: undefined;
  NotifikasiTab: undefined;
  ProfilTab: NavigatorScreenParams<ProfilStackParamList> | undefined;
};

export type PasienStackParamList = {
  PasienList: undefined;
  PasienDetail: { pasienId: string; nama: string };
  PilihPasienHasilLab: undefined;
  HasilLabList: { pasienId: string; nama: string };
  HasilLabDetail: { pemeriksaanLabId: string };
  LihatPdfLab: { namaLaporan: string; tanggal: string };
};

export type OperasiStackParamList = {
  JadwalOperasiKonsul: undefined;
  DetailJadwalOperasi: { operasiId: string };
  DetailKonsul: { kunjunganId: string };
};

export type NotifikasiStackParamList = {
  NotifikasiList: undefined;
  DetailLaporanLab: undefined;
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
  DataPendapatan: undefined;
  CatatanKalender: undefined;
};
