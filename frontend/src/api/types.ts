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

export type LoginResponse = {
  token: string;
  pengguna: {
    id: string;
    username: string;
    role: 'DOKTER' | 'ADMIN';
    dokter: { id: string; nama: string; spesialisasi: string | null } | null;
  };
};
