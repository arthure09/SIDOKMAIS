import type { JenisKunjungan } from '../api/types';

// Label tampilan buat kategori kunjungan (Tahap 1 rencana revisi). Backend
// mengirim kategori, bukan jenis ruangan mentah — lihat
// backend/src/utils/jenisKunjungan.js.
const JENIS_KUNJUNGAN_LABEL: Record<JenisKunjungan, string> = {
  RAWAT_JALAN: 'Rawat Jalan',
  IGD: 'IGD',
  RAWAT_INAP: 'Rawat Inap',
};

export function labelJenisKunjungan(jenis: JenisKunjungan | null) {
  return jenis ? JENIS_KUNJUNGAN_LABEL[jenis] : null;
}
