// Isi tab Operasi. Entity Konsultasi belum ada modelnya di database sama sekali
// (nunggu keputusan supervisor soal ERD v2) — makanya file ini cuma nyimpen data
// Operasi; tab "Konsul" di JadwalOperasiKonsulScreen sengaja ditampilkan sebagai
// state dummy "segera hadir", bukan list beneran.

export type OperasiStatusMock = 'IN_PROGRESS' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export type TimMedisItem = {
  nama: string;
  peran: string;
  andaSendiri?: boolean;
};

export type OperasiJadwalItem = {
  id: string;
  waktuMulai: string;
  waktuSelesai: string;
  tanggal: string;
  pasienNama: string;
  pasienRm: string;
  pasienUmur: number;
  pasienJenisKelamin: 'Laki-laki' | 'Perempuan';
  tindakan: string;
  status: OperasiStatusMock;
  ruangan: string | null;
  dokterUtama: string | null;
  // Hanya dipakai kalau status === 'CANCELLED'
  pembatalan?: {
    alasan: string;
    dibatalkanOleh: string;
    waktuPembatalan: string;
    instruksiTindakLanjut: string;
  };
};

// Tim medis & catatan pra-operasi dari desain "Detail Jadwal Operasi" bersifat
// template dummy, dipakai sama untuk tiap jadwal yang belum dibatalkan (bukan
// per-record — data sedetail itu belum ada di seed manapun).
export const timMedisDefault: TimMedisItem[] = [
  { nama: 'dr. User, Sp.B', peran: 'Operator Utama', andaSendiri: true },
  { nama: 'dr. Andi S.', peran: 'Asisten Bedah' },
  { nama: 'dr. Budi, Sp.An', peran: 'Dokter Anestesi' },
];

export const catatanPraOpDefault: string[] = [
  'Puasa mulai jam 00:00 (H-1).',
  'Cek persediaan darah 2 kantong (PRC).',
  'Persetujuan tindakan medis (Informed Consent) sudah ditandatangani keluarga.',
];

export const operasiJadwalList: OperasiJadwalItem[] = [
  {
    id: 'op-1',
    waktuMulai: '08:00',
    waktuSelesai: '10:30',
    tanggal: 'Senin, 30 Okt 2023',
    pasienNama: 'Tn. Budi Santoso',
    pasienRm: '102-45-89',
    pasienUmur: 45,
    pasienJenisKelamin: 'Laki-laki',
    tindakan: 'Reseksi Tumor Kolon',
    status: 'IN_PROGRESS',
    ruangan: 'Ruang OK 1',
    dokterUtama: 'Dr. Andi',
  },
  {
    id: 'op-2',
    waktuMulai: '11:00',
    waktuSelesai: '13:00',
    tanggal: 'Senin, 30 Okt 2023',
    pasienNama: 'Ny. Siti Aminah',
    pasienRm: '102-46-12',
    pasienUmur: 38,
    pasienJenisKelamin: 'Perempuan',
    tindakan: 'Biopsi Payudara',
    status: 'SCHEDULED',
    ruangan: 'Ruang OK 2',
    dokterUtama: 'Dr. Lina',
  },
  {
    id: 'op-3',
    waktuMulai: '06:00',
    waktuSelesai: '07:30',
    tanggal: 'Senin, 30 Okt 2023',
    pasienNama: 'Tn. Ahmad Dahlan',
    pasienRm: '102-47-30',
    pasienUmur: 52,
    pasienJenisKelamin: 'Laki-laki',
    tindakan: 'Eksisi Kista',
    status: 'COMPLETED',
    ruangan: 'Ruang OK 1',
    dokterUtama: null,
  },
  {
    id: 'op-4',
    waktuMulai: '10:30',
    waktuSelesai: '12:00',
    tanggal: '12 Okt 2023',
    pasienNama: 'Ny. Siti Aminah',
    pasienRm: '882-04-12',
    pasienUmur: 62,
    pasienJenisKelamin: 'Perempuan',
    tindakan: 'Kolesistektomi (Angkat Kandung Empedu)',
    status: 'CANCELLED',
    ruangan: null,
    dokterUtama: null,
    pembatalan: {
      alasan: 'Tekanan darah pasien tidak stabil (Hipertensi urgensi) saat pemeriksaan pre-op.',
      dibatalkanOleh: 'Tim Anestesi (dr. Budi, Sp.An)',
      waktuPembatalan: '12 Okt 2023, 09:45 WIB',
      instruksiTindakLanjut:
        'Pasien dikembalikan ke bangsal untuk stabilisasi tekanan darah. Jadwalkan ulang setelah kondisi optimal.',
    },
  },
];
