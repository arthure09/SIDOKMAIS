export type AssignmentStatus = 'ACTIVE' | 'COMPLETED';
export type StatusKunjungan = 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

export type PasienListItem = {
  id: string;
  norm: string;
  nama: string;
  status: AssignmentStatus;
  diagnosaSingkat: string | null;
  tanggalKunjunganTerakhir: string | null;
  tanggalKunjunganBerikutnya: string | null;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PasienListResponse = {
  data: PasienListItem[];
  pagination: Pagination;
};

export type RiwayatKunjungan = {
  id: string;
  tanggalMasuk: string;
  tanggalKeluar: string | null;
  diagnosa: string | null;
  statusKunjungan: StatusKunjungan;
  isPasienBaru: boolean;
  ruangan: { nama: string; jenis: string };
  dokter: { nama: string };
};

export type PasienDetail = {
  id: string;
  norm: string;
  nama: string;
  jenisKelamin: 'L' | 'P';
  tanggalLahir: string | null;
  tempatLahir: string | null;
  alamat: string | null;
  golonganDarah: string | null;
  noRekamMedis: string | null;
  assignment: {
    id: string;
    status: AssignmentStatus;
    tanggalAssign: string;
  };
  riwayatKunjungan: RiwayatKunjungan[];
};

export type OperasiStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type OperasiListItem = {
  id: string;
  tanggalOperasi: string;
  jenisTindakan: string;
  status: OperasiStatus;
  ruangan: { nama: string; jenis: string };
  kunjungan: {
    dokterId: string;
    dokter: { nama: string };
    pasien: { nama: string; norm: string };
  };
};

export type OperasiListResponse = {
  data: OperasiListItem[];
  pagination: Pagination;
};

export type OperasiDetail = {
  id: string;
  kunjunganId: string;
  ruanganId: string;
  tanggalOperasi: string;
  jenisTindakan: string;
  tim: string[];
  status: OperasiStatus;
  catatanPreOp: string | null;
  catatanPostOp: string | null;
  kunjungan: {
    id: string;
    diagnosa: string | null;
    pasien: {
      id: string;
      nama: string;
      norm: string;
      jenisKelamin: 'L' | 'P';
      tanggalLahir: string | null;
    };
    dokter: { id: string; nama: string };
  };
  ruangan: { id: string; nama: string; jenis: string; lantai: number | null };
};

export type KunjunganListItem = {
  id: string;
  tanggalMasuk: string;
  tanggalKeluar: string | null;
  diagnosa: string | null;
  statusKunjungan: StatusKunjungan;
  isPasienBaru: boolean;
  ruangan: { nama: string; jenis: string };
  pasien: { id: string; nama: string; norm: string };
  dokter: { id: string; nama: string };
};

export type KunjunganListResponse = {
  data: KunjunganListItem[];
  pagination: Pagination;
};

export type KunjunganDetail = {
  id: string;
  diagnosa: string | null;
  statusKunjungan: StatusKunjungan;
  isPasienBaru: boolean;
  tanggalMasuk: string;
  tanggalKeluar: string | null;
  pasien: {
    id: string;
    nama: string;
    norm: string;
    jenisKelamin: 'L' | 'P';
    tanggalLahir: string | null;
  };
  dokter: { id: string; nama: string; spesialisasi: string | null };
  ruangan: { id: string; nama: string; jenis: string; lantai: number | null };
  operasi: { id: string; status: OperasiStatus; tanggalOperasi: string }[];
};

export type NotifikasiTipe = 'PASIEN_BARU' | 'REMINDER_OPERASI' | 'PERUBAHAN_JADWAL';

export type NotifikasiItemApi = {
  id: string;
  dokterId: string;
  tipe: NotifikasiTipe;
  pesan: string;
  isRead: boolean;
  createdAt: string;
  dokter: { id: string; nama: string };
};

export type NotifikasiListResponse = {
  data: NotifikasiItemApi[];
  pagination: Pagination;
};

export type StatusPemeriksaanLab = 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type FlagHasilLab = 'RENDAH' | 'NORMAL' | 'TINGGI' | 'ABNORMAL';

export type HasilLabRingkasan = {
  id: string;
  kategori: string;
  namaPemeriksaan: string;
  laboratorium: string | null;
  status: StatusPemeriksaanLab;
  tanggalPermintaan: string;
  tanggalHasil: string | null;
  jumlahParameter: number;
  adaFlagAbnormal: boolean;
};

export type HasilLabListResponse = {
  data: HasilLabRingkasan[];
  pagination: Pagination;
};

export type HasilLabItemApi = {
  id: string;
  namaParameter: string;
  nilai: string;
  satuan: string | null;
  nilaiRujukan: string | null;
  flag: FlagHasilLab;
  urutan: number | null;
};

export type HasilLabDetail = {
  id: string;
  pasienId: string;
  kunjunganId: string | null;
  dokterPemintaId: string | null;
  kategori: string;
  namaPemeriksaan: string;
  laboratorium: string | null;
  tanggalPermintaan: string;
  tanggalHasil: string | null;
  status: StatusPemeriksaanLab;
  catatan: string | null;
  pasien: { id: string; nama: string; norm: string };
  dokterPeminta: { id: string; nama: string; spesialisasi: string | null } | null;
  // Nullable dgn sengaja — backend belum dikonfirmasi apakah SIMRS asli simpan
  // hasil lab terstruktur per-parameter atau cuma dokumen (lihat lab.routes.js).
  hasilLabItem: HasilLabItemApi[] | null;
};

export type AktivitasHarianMingguan = {
  label: string;
  jumlah: number;
  highlight: boolean;
};

export type PasienPrioritasItem = {
  id: string;
  nama: string;
  lokasi: string;
  /** ISO datetime — jadwal Operasi/Kunjungan SCHEDULED, bisa hari ini atau beberapa hari ke depan. */
  waktu: string;
  jenis: 'OPERASI' | 'KONSULTASI';
};

export type StatistikDashboard = {
  pasienAktif: number;
  operasiHariIni: number;
  konsulHariIni: number;
  // Gabungan jumlah Kunjungan + Operasi per hari, Senin-Minggu minggu
  // berjalan WIB — 7 entri, urutan tetap.
  aktivitasMingguan: AktivitasHarianMingguan[];
  // 0-3 jadwal Operasi/Kunjungan SCHEDULED terdekat ke depan, diurutkan
  // makin dekat makin dulu.
  pasienPrioritas: PasienPrioritasItem[];
  // Cuma muncul kalau akun yang login ADMIN — lihat dashboard.routes.js untuk
  // alasan kenapa ADMIN selalu dapat 0 di sini, bukan agregat lintas-dokter.
  adminCatatan?: string;
};

export type TipeCatatanKalender = 'REMINDER' | 'BLOCKING' | 'PRIBADI';

export type CatatanKalenderItem = {
  id: string;
  dokterId: string;
  tanggal: string;
  waktu: string | null;
  judul: string;
  catatan: string | null;
  tipe: TipeCatatanKalender;
  createdAt: string;
  updatedAt: string;
};

export type CatatanKalenderListResponse = {
  data: CatatanKalenderItem[];
  // Cuma muncul kalau akun yang login ADMIN — kalender pribadi tidak
  // berlaku buat akun yang tidak terikat ke satu Dokter, lihat kalender.routes.js.
  adminCatatan?: string;
};

export type LoginResponse = {
  token: string;
  pengguna: {
    id: string;
    username: string;
    role: 'DOKTER' | 'ADMIN';
    dokter: { id: string; nama: string; spesialisasi: string | null } | null;
  };
};
