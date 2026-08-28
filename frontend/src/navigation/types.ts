import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  PasienTab: NavigatorScreenParams<PasienStackParamList> | undefined;
  OperasiTab: NavigatorScreenParams<OperasiStackParamList> | undefined;
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
  // Satu layar = satu TANGGAL, bukan satu pemeriksaan — SIMRS memecah order lab per tindakan (Hematologi,
  // Kimia Darah, Urinalisa jadi baris terpisah walau dari sampel yang sama), tapi dokter membacanya
  // sebagai satu lembar hasil. Pengelompokan dilakukan di HasilLabListScreen.
  HasilLabDetail: { pemeriksaanLabIds: string[]; tanggal: string };
};

/**
 * Radiologi ikut pola dua-pintu yang sama dengan Lab. Bedanya satu layar detail
 * = satu laporan, bukan satu tanggal: hasil radiologi berupa narasi utuh yang
 * dibaca sendiri-sendiri, tidak digabung seperti parameter lab dari satu sampel.
 */
type RadiologiRoutes = {
  RadiologiList: { pasienId: string; nama: string };
  RadiologiDetail: { radiologiId: string };
};

/**
 * Screen yang dibuka dari tile Menu di Home tinggal di stack HomeTab sendiri, bukan menumpang stack tab
 * lain — supaya "kembali" (tombol header, back Android, gestur swipe iOS) selalu pop ke Home apa adanya,
 * tanpa param `fromHome` atau hook khusus.
 */
export type HomeStackParamList = {
  Home: undefined;
  DataPendapatan: undefined;
  // `buatBaru` dikirim tombol "Tambah Pengingat" di Home — form catatan langsung terbuka begitu
  // screen-nya muncul, bukan mendarat di kalender kosong.
  CatatanKalender: { buatBaru?: boolean } | undefined;
  // Dipakai dua tile Home (Hasil Lab & Radiologi) — `tujuan` menentukan layar berikutnya, tanpa ini tile
  // Radiologi mendarat di Hasil Lab.
  PilihPasienHasilLab: { tujuan?: 'lab' | 'radiologi' } | undefined;
} & LabRoutes &
  RadiologiRoutes;

export type PasienStackParamList = {
  PasienList: undefined;
  PasienDetail: { pasienId: string; nama: string };
} & LabRoutes &
  RadiologiRoutes;

export type OperasiStackParamList = {
  // `tab` dipakai tile ringkasan di Home biar lompat langsung ke sub-tab yang sesuai (lihat TABS di
  // JadwalOperasiKonsulScreen) — undefined = default, screen buka di tab Poliklinik lewat tab bar.
  JadwalOperasiKonsul: { tab?: 'POLI' | 'OPERASI' | 'KONSUL' } | undefined;
  DetailJadwalOperasi: { operasiId: string };
  DetailKonsul: { konsultasiId: string };
  DetailKunjungan: { kunjunganId: string };
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
