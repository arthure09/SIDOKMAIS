import type { JenisKunjungan } from '../api/types';

// Label tampilan untuk kategori kunjungan — backend mengirim kategori,
// bukan jenis ruangan mentah.
export const JENIS_KUNJUNGAN_LABEL: Record<JenisKunjungan, string> = {
  RAWAT_JALAN: 'Rawat Jalan',
  IGD: 'IGD',
  RAWAT_INAP: 'Rawat Inap',
};

export function labelJenisKunjungan(jenis: JenisKunjungan | null) {
  return jenis ? JENIS_KUNJUNGAN_LABEL[jenis] : null;
}
