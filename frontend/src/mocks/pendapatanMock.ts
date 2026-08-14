// CLAUDE.md aturan #3: modul Pendapatan tetap isDummy = true (data belum nyata).
// Watermark UI "CONTOH DATA DUMMY" dihapus atas keputusan Arthuro (lihat CLAUDE.md).

export type StatusTransaksi = 'TERVERIFIKASI' | 'MENUNGGU';
export type JenisTransaksi = 'OPERASI' | 'KONSUL';

/**
 * Satu baris jasa medis. **Tidak ada satu pun identitas pasien di sini** —
 * bukan nama, bukan No. RM (bahkan yang tersamar), bukan diagnosis (keputusan
 * Arthuro, 14 Ags 2026).
 *
 * Untuk memverifikasi klaimnya sendiri, dokter butuh tahu pelayanan mana —
 * bukan siapa pasiennya; tanggal + jenis + penjamin + nominal sudah cukup buat
 * dicocokkan ke SIMRS. Bentuk mock ini sengaja sama dengan bentuk response yang
 * nanti dipakai: menyensor di UI sementara API tetap mengirim datanya itu
 * dekorasi, bukan privasi. Model `Pendapatan` di schema.prisma memang tidak
 * punya relasi ke `Pasien`, jadi endpoint-nya cukup tidak join ke sana.
 */
export type TransaksiPendapatan = {
  id: string;
  /** ISO `YYYY-MM-DD`. Bulan & urutan diturunkan dari sini, bukan dari string berformat. */
  tanggal: string;
  sumber: string;
  jenis: JenisTransaksi;
  nominal: number;
  status: StatusTransaksi;
};

/**
 * Satu-satunya sumber kebenaran modul ini: total diterima, uang menunggu, dan
 * komposisi penjamin semuanya dijumlah dari array ini di screen-nya.
 *
 * Versi sebelumnya punya objek `ringkasanPendapatan` terpisah yang angkanya
 * tidak nyambung ke daftar transaksinya (45,25 jt vs 21,85 jt kalau daftarnya
 * dijumlah). Selama tidak ada yang menjumlahkan, selisih itu tidak kelihatan —
 * begitu komposisi penjamin digambar dari daftar, langsung ketahuan.
 *
 * Utang yang menunggu endpoint: `nominal` di sini menggabungkan dua kolom yang
 * di `schema.prisma` terpisah — `tarifTotal` dan `jumlahDiterimaDokter`. Yang
 * boleh sampai ke layar dokter cuma yang kedua.
 */
export const transaksiPendapatan: TransaksiPendapatan[] = [
  // Agustus 2026
  { id: 'trx-1', tanggal: '2026-08-15', sumber: 'BPJS', jenis: 'OPERASI', nominal: 12_000_000, status: 'TERVERIFIKASI' },
  { id: 'trx-2', tanggal: '2026-08-14', sumber: 'Mandiri Inhealth', jenis: 'KONSUL', nominal: 500_000, status: 'MENUNGGU' },
  { id: 'trx-3', tanggal: '2026-08-12', sumber: 'Asuransi Swasta', jenis: 'OPERASI', nominal: 8_500_000, status: 'TERVERIFIKASI' },
  { id: 'trx-4', tanggal: '2026-08-11', sumber: 'BPJS', jenis: 'OPERASI', nominal: 7_500_000, status: 'TERVERIFIKASI' },
  { id: 'trx-5', tanggal: '2026-08-10', sumber: 'BPJS', jenis: 'KONSUL', nominal: 350_000, status: 'TERVERIFIKASI' },
  { id: 'trx-6', tanggal: '2026-08-08', sumber: 'Mandiri Inhealth', jenis: 'KONSUL', nominal: 1_250_000, status: 'TERVERIFIKASI' },
  { id: 'trx-7', tanggal: '2026-08-07', sumber: 'Asuransi Swasta', jenis: 'KONSUL', nominal: 750_000, status: 'TERVERIFIKASI' },
  { id: 'trx-8', tanggal: '2026-08-05', sumber: 'BPJS', jenis: 'OPERASI', nominal: 6_250_000, status: 'MENUNGGU' },
  { id: 'trx-9', tanggal: '2026-08-03', sumber: 'BPJS', jenis: 'KONSUL', nominal: 350_000, status: 'TERVERIFIKASI' },

  // Juli 2026
  { id: 'trx-10', tanggal: '2026-07-28', sumber: 'BPJS', jenis: 'OPERASI', nominal: 11_000_000, status: 'TERVERIFIKASI' },
  { id: 'trx-11', tanggal: '2026-07-22', sumber: 'Asuransi Swasta', jenis: 'OPERASI', nominal: 9_500_000, status: 'TERVERIFIKASI' },
  { id: 'trx-12', tanggal: '2026-07-18', sumber: 'BPJS', jenis: 'KONSUL', nominal: 350_000, status: 'TERVERIFIKASI' },
  { id: 'trx-13', tanggal: '2026-07-15', sumber: 'Mandiri Inhealth', jenis: 'KONSUL', nominal: 700_000, status: 'TERVERIFIKASI' },
  { id: 'trx-14', tanggal: '2026-07-09', sumber: 'BPJS', jenis: 'OPERASI', nominal: 4_250_000, status: 'TERVERIFIKASI' },
  { id: 'trx-15', tanggal: '2026-07-04', sumber: 'BPJS', jenis: 'KONSUL', nominal: 500_000, status: 'TERVERIFIKASI' },

  // Juni 2026
  { id: 'trx-16', tanggal: '2026-06-26', sumber: 'BPJS', jenis: 'OPERASI', nominal: 8_000_000, status: 'TERVERIFIKASI' },
  { id: 'trx-17', tanggal: '2026-06-19', sumber: 'Mandiri Inhealth', jenis: 'KONSUL', nominal: 700_000, status: 'TERVERIFIKASI' },
  { id: 'trx-18', tanggal: '2026-06-11', sumber: 'Asuransi Swasta', jenis: 'OPERASI', nominal: 6_750_000, status: 'TERVERIFIKASI' },
  { id: 'trx-19', tanggal: '2026-06-05', sumber: 'BPJS', jenis: 'KONSUL', nominal: 350_000, status: 'TERVERIFIKASI' },
];
