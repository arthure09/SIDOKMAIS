export type AssignmentStatus = 'ACTIVE' | 'COMPLETED';
export type StatusKunjungan = 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
// Diturunkan server-side dari Ruangan.jenis, bukan kolom sendiri. Null kalau
// pasien belum punya kunjungan (atau ruangannya di luar 3 kategori ini).
export type JenisKunjungan = 'RAWAT_JALAN' | 'IGD' | 'RAWAT_INAP';

export type PasienListItem = {
  id: string;
  norm: string;
  nama: string;
  status: AssignmentStatus;
  diagnosaSingkat: string | null;
  jenisKunjungan: JenisKunjungan | null;
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
  jenisKunjungan: JenisKunjungan | null;
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

  // Laporan operasi (Tahap 3). Field-nya dihilangkan sepenuhnya dari respons
  // kalau operasinya belum selesai — jadi optional, bukan `| null`.
  dokterOperator?: string | null;
  asistenOperator?: string | null;
  perawatInstrumentator?: string | null;
  perawatSirkuler?: string | null;
  dokterAnestesi?: string | null;
  jenisAnestesi?: string | null;
  kategoriOperasi?: string | null;
  diagnosaPraBedah?: string | null;
  diagnosaPascaBedah?: string | null;
  jamMulaiInsisi?: string | null;
  jamSelesai?: string | null;
  sifatOperasi?: 'ELEKTIF' | 'CITO' | null;
  jenisPembedahan?: 'BERSIH' | 'BERSIH_TERKONTAMINASI' | 'KONTAMINASI' | 'KOTOR' | null;
  antibiotikProfilaksis?: boolean | null;
  teknikAnestesiLokal?: string | null;
  lokasiAnestesi?: string | null;
  obatAnestesi?: string | null;
  responHipersensitivitas?: string | null;
  kejadianToksikasi?: string | null;
  tindakanDilakukan?: string | null;
  deskripsiOperasi?: string | null;
  komplikasi?: string | null;
  jumlahKehilanganDarah?: number | null;
  transfusi?: string | null;
  spesimen?: string | null;
  pemasanganImplan?: string | null;

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
  jenisKunjungan: JenisKunjungan | null;
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
  jenisKunjungan: JenisKunjungan | null;
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

/**
 * Konsultasi = surat konsul antar-dokter (Lembar Konsultasi SIMRS), bukan
 * jadwal appointment. Dokter yang login hanya menerima konsul yang DITUJUKAN
 * kepadanya — scoping-nya di server lewat `dokterTujuanId`, jadi tidak ada
 * field "dokter tujuan" yang perlu dikirim dari sini.
 */
export type PrioritasKonsultasi = 'BIASA' | 'CITO';
export type StatusKonsultasi = 'MENUNGGU_JAWABAN' | 'SUDAH_DIJAWAB';

export type KonsultasiListItem = {
  id: string;
  tanggalPermintaan: string;
  prioritas: PrioritasKonsultasi;
  status: StatusKonsultasi;
  diagnosisKerja: string;
  tanggalJawaban: string | null;
  pasien: { id: string; nama: string; norm: string };
  dokterPengirim: { id: string; nama: string; spesialisasi: string | null };
  jenisKunjungan: JenisKunjungan | null;
};

export type KonsultasiListResponse = {
  data: KonsultasiListItem[];
  pagination: Pagination;
};

export type KonsultasiDetail = {
  id: string;
  kunjunganId: string | null;
  prioritas: PrioritasKonsultasi;
  status: StatusKonsultasi;
  tanggalPermintaan: string;
  diagnosisKerja: string;
  // Ikhtisar klinis — lembar konsul di lapangan sering terisi sebagian.
  kesadaran: string | null;
  tekananDarah: string | null;
  nadi: number | null;
  pernapasan: number | null;
  suhu: number | null;
  tinggiBadan: number | null;
  beratBadan: number | null;
  nyeri: number | null;
  konsulYangDiminta: string;
  // Blok jawaban — semuanya null selama status MENUNGGU_JAWABAN.
  penemuan: string | null;
  diagnosisJawaban: string | null;
  anjuran: string | null;
  setujuUntuk: string | null;
  tanggalJawaban: string | null;
  pasien: {
    id: string;
    nama: string;
    norm: string;
    jenisKelamin: 'L' | 'P';
    tanggalLahir: string | null;
  };
  dokterPengirim: { id: string; nama: string; spesialisasi: string | null };
  dokterTujuan: { id: string; nama: string; spesialisasi: string | null };
  kunjungan: { id: string; tanggalMasuk: string; ruangan: { nama: string; jenis: string } } | null;
  jenisKunjungan: JenisKunjungan | null;
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
  jenis: 'OPERASI' | 'KUNJUNGAN';
};

export type StatistikDashboard = {
  pasienAktif: number;
  operasiHariIni: number;
  kunjunganHariIni: number;
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
    // nip opsional: sesi lama yang tersimpan di SecureStore (login sebelum
    // field ini ada) tidak punya field-nya, dan screen-nya harus tetap jalan
    // tanpa memaksa user login ulang.
    dokter: {
      id: string;
      nama: string;
      spesialisasi: string | null;
      nip?: string;
    } | null;
  };
};
