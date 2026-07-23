export type StatsProfil = {
  pasienAktif: number;
  tahunPengalaman: number;
};

export const statsProfil: StatsProfil = {
  pasienAktif: 42,
  tahunPengalaman: 15,
};

export type SettingsMenuItem = {
  id: string;
  label: string;
  icon: string;
};

// "Data Pendapatan" gak ada di antara 3 item Settings List versi Figma yang dikirim
// (isinya Pengaturan Notifikasi / Tentang Aplikasi / Keamanan Akun) — tapi Screen 3
// (Data Pendapatan) cuma bisa diakses lewat menu di sini per docs/prompts batch ini,
// jadi ditambahkan sebagai item pertama.
export const settingsMenu: SettingsMenuItem[] = [
  { id: 'pendapatan', label: 'Data Pendapatan', icon: 'payments' },
  { id: 'notifikasi', label: 'Pengaturan Notifikasi', icon: 'notifications-active' },
  { id: 'tentang', label: 'Tentang Aplikasi', icon: 'info' },
  { id: 'keamanan', label: 'Keamanan Akun', icon: 'security' },
];
