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
};

export type NotifikasiListResponse = {
  data: NotifikasiItemApi[];
  pagination: Pagination;
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
