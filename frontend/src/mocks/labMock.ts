// Data dummy buat fitur Cari Hasil Lab (lihat docs/prompts/fitur-cari-hasil-lab.md).
// `laboratorium` di bawah DUMMY MURNI ("Laboratorium A/B/C") — belum ada konfirmasi
// daftar unit lab asli RS Dharmais dari supervisor, jangan dikira nama resmi.
// Belum dipakai di layar manapun hari ini; konsumennya (CariHasilLabScreen) baru
// dibuat Hari 17. Entry pasien pertama reuse teks dari notifikasiMock.ts →
// laporanLabDetail (dipecah jadi 2 kelompok) biar gak dobel karang teks lab.

export type HasilLabItem = {
  id: string;
  namaLaporan: string;
  tanggal: string;
};

export type KelompokHasilLab = {
  laboratorium: string; // nama unit lab, DUMMY MURNI — belum ada data asli dari supervisor
  items: HasilLabItem[];
};

export type HasilLabPasien = {
  norm: string;
  pasienNama: string;
  pasienInfo: string; // "Laki-laki, 58 Tahun"
  kelompok: KelompokHasilLab[];
};

export const hasilLabByNorm: Record<string, HasilLabPasien> = {
  '9821140512': {
    norm: '9821140512',
    pasienNama: 'Tn. Ahmad Subarjo',
    pasienInfo: 'Laki-laki, 58 Tahun',
    kelompok: [
      {
        laboratorium: 'Laboratorium A',
        items: [
          { id: 'lab-1', namaLaporan: 'Hasil Hematologi', tanggal: '12 Okt 2023' },
          { id: 'lab-2', namaLaporan: 'Profil Lipid', tanggal: '12 Okt 2023' },
        ],
      },
      {
        laboratorium: 'Laboratorium B',
        items: [
          { id: 'lab-3', namaLaporan: 'Hasil Swab Antigen', tanggal: '10 Okt 2023' },
          { id: 'lab-4', namaLaporan: 'Urinalisis Lengkap', tanggal: '08 Okt 2023' },
        ],
      },
    ],
  },
  '7734209981': {
    norm: '7734209981',
    pasienNama: 'Ny. Siti Marlina',
    pasienInfo: 'Perempuan, 45 Tahun',
    kelompok: [
      {
        laboratorium: 'Laboratorium A',
        items: [
          { id: 'lab-5', namaLaporan: 'Hasil Gula Darah Puasa', tanggal: '20 Jul 2026' },
        ],
      },
      {
        laboratorium: 'Laboratorium C',
        items: [
          { id: 'lab-6', namaLaporan: 'Fungsi Ginjal', tanggal: '18 Jul 2026' },
          { id: 'lab-7', namaLaporan: 'Fungsi Hati', tanggal: '18 Jul 2026' },
        ],
      },
    ],
  },
  '5512667023': {
    norm: '5512667023',
    pasienNama: 'Tn. Budi Santoso',
    pasienInfo: 'Laki-laki, 62 Tahun',
    kelompok: [
      {
        laboratorium: 'Laboratorium B',
        items: [
          { id: 'lab-8', namaLaporan: 'Elektrolit Lengkap', tanggal: '25 Jul 2026' },
        ],
      },
      {
        laboratorium: 'Laboratorium C',
        items: [
          { id: 'lab-9', namaLaporan: 'Hasil Rontgen Toraks', tanggal: '24 Jul 2026' },
          { id: 'lab-10', namaLaporan: 'EKG Istirahat', tanggal: '24 Jul 2026' },
          { id: 'lab-11', namaLaporan: 'Kultur Darah', tanggal: '23 Jul 2026' },
        ],
      },
    ],
  },
};
