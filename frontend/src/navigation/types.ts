export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  PasienTab: undefined;
  OperasiTab: undefined;
  NotifikasiTab: undefined;
  ProfilTab: undefined;
};

export type PasienStackParamList = {
  PasienList: undefined;
  PasienDetail: { pasienId: string; nama: string };
};

export type OperasiStackParamList = {
  JadwalOperasiKonsul: undefined;
  DetailJadwalOperasi: { operasiId: string };
  DetailPembatalanOperasi: { operasiId: string };
};

export type NotifikasiStackParamList = {
  NotifikasiList: undefined;
  DetailLaporanLab: undefined;
};

export type ProfilStackParamList = {
  ProfilDokter: undefined;
  DataPendapatan: undefined;
};
