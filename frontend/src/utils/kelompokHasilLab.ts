import type { HasilLabRingkasan } from '../api/types';

export type GrupHasilLab = {
  /** Kunci tanggal kalender lokal, mis. "Mon Aug 24 2026". Cuma untuk Map/list key. */
  key: string;
  /** ISO datetime item pertama pada tanggal itu — dipakai buat tampilan. */
  tanggal: string;
  ids: string[];
  labs: string[];
  pemeriksaan: string[];
  jumlahParameter: number;
  jumlahAbnormal: number;
};

// Satu baris daftar hasil lab = satu TANGGAL, bukan satu pemeriksaan. Sumbernya
// (SIMRS maupun dummy) memecah order lab per tindakan, jadi satu kali ambil
// darah bisa muncul sebagai 3-8 baris "Hematologi Lengkap", "Kimia Darah",
// "Urinalisa" bertanggal persis sama — dokter membacanya sebagai satu lembar
// hasil. Digabung di frontend, bukan backend, supaya kedua mode ikut tanpa
// mengubah endpoint; konsekuensinya grup hanya seluas satu halaman (limit 50) —
// layar itu memang tidak paginasi.
export function kelompokkanPerTanggal(items: HasilLabRingkasan[]): GrupHasilLab[] {
  const peta = new Map<string, GrupHasilLab>();

  for (const item of items) {
    // Kunci pakai tanggal kalender LOKAL device (toDateString), bukan potongan
    // string ISO — ISO-nya UTC, jadi hasil lab jam 07.00 WIB akan jatuh ke hari
    // sebelumnya kalau dipotong mentah. Kunci ini tidak pernah ditampilkan atau
    // dikirim ke backend, jadi bentuknya bebas.
    const key = new Date(item.tanggalPermintaan).toDateString();
    const grup = peta.get(key) ?? {
      key,
      tanggal: item.tanggalPermintaan,
      ids: [],
      labs: [],
      pemeriksaan: [],
      jumlahParameter: 0,
      jumlahAbnormal: 0,
    };

    grup.ids.push(item.id);
    grup.jumlahParameter += item.jumlahParameter;
    grup.jumlahAbnormal += item.jumlahAbnormal;
    if (item.laboratorium && !grup.labs.includes(item.laboratorium)) grup.labs.push(item.laboratorium);
    if (!grup.pemeriksaan.includes(item.namaPemeriksaan)) grup.pemeriksaan.push(item.namaPemeriksaan);

    peta.set(key, grup);
  }

  // Urutan Map mengikuti kemunculan pertama, dan daftar dari backend sudah
  // terurut tanggalPermintaan DESC — jadi tidak perlu sort ulang.
  return [...peta.values()];
}
