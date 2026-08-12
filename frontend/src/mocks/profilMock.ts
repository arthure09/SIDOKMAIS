export type StatsProfil = {
  tahunPengalaman: number;
};

export const statsProfil: StatsProfil = {
  tahunPengalaman: 15,
};

export type SettingsMenuItem = {
  id: string;
  label: string;
  icon: string;
};

// Balik ke 3 item Settings List versi Figma. "Data Pendapatan" sempat ditaruh di
// sini waktu Home belum punya kartu menunya; sekarang sudah ada (navigasiCards di
// homeMock.ts), jadi entri di sini cuma jalan kedua ke screen yang sama.
export const settingsMenu: SettingsMenuItem[] = [
  { id: 'notifikasi', label: 'Pengaturan Notifikasi', icon: 'notifications-active' },
  { id: 'tentang', label: 'Tentang Aplikasi', icon: 'info' },
  { id: 'keamanan', label: 'Keamanan Akun', icon: 'security' },
];
