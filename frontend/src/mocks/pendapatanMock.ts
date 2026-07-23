// CLAUDE.md aturan #3: modul Pendapatan wajib isDummy + watermark "CONTOH DATA DUMMY"
// selama belum ada keputusan lain dari supervisor.

export type RingkasanPendapatan = {
  totalBulanIni: number;
  totalOperasi: number;
  totalKonsul: number;
  labelBulan: string;
};

export const ringkasanPendapatan: RingkasanPendapatan = {
  totalBulanIni: 45_250_000,
  totalOperasi: 32_500_000,
  totalKonsul: 12_750_000,
  labelBulan: 'Agustus',
};

export type StatusTransaksi = 'TERVERIFIKASI' | 'MENUNGGU';
export type JenisTransaksi = 'OPERASI' | 'KONSUL';

export type TransaksiPendapatan = {
  id: string;
  pasienNama: string;
  tanggal: string;
  sumber: string;
  jenis: JenisTransaksi;
  nominal: number;
  status: StatusTransaksi;
};

export const transaksiPendapatan: TransaksiPendapatan[] = [
  {
    id: 'trx-1',
    pasienNama: 'Budi Santoso',
    tanggal: '15 Agustus 2023',
    sumber: 'BPJS',
    jenis: 'OPERASI',
    nominal: 12_000_000,
    status: 'TERVERIFIKASI',
  },
  {
    id: 'trx-2',
    pasienNama: 'Siti Aminah',
    tanggal: '14 Agustus 2023',
    sumber: 'Mandiri',
    jenis: 'KONSUL',
    nominal: 500_000,
    status: 'MENUNGGU',
  },
  {
    id: 'trx-3',
    pasienNama: 'Andi Wijaya',
    tanggal: '12 Agustus 2023',
    sumber: 'Asuransi',
    jenis: 'OPERASI',
    nominal: 8_500_000,
    status: 'TERVERIFIKASI',
  },
  {
    id: 'trx-4',
    pasienNama: 'Rina Melati',
    tanggal: '10 Agustus 2023',
    sumber: 'BPJS',
    jenis: 'KONSUL',
    nominal: 350_000,
    status: 'TERVERIFIKASI',
  },
  {
    id: 'trx-5',
    pasienNama: 'Dewi Lestari',
    tanggal: '08 Agustus 2023',
    sumber: 'Mandiri',
    jenis: 'KONSUL',
    nominal: 500_000,
    status: 'MENUNGGU',
  },
];
