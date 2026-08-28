import type { AktivitasHarianMingguan } from '../api/types';

/**
 * Kalimat ringkasan di bawah chart "Statistik Pasien Mingguan".
 *
 * Sengaja rule-based, bukan lewat LLM: seluruh
 * isinya aritmetika biasa atas array yang sama dengan yang menggambar bar-nya,
 * jadi angkanya dijamin konsisten dengan chart, instan, dan tidak bisa
 * "mengarang" seperti model generatif.
 *
 * Tidak ada klaim tren naik/turun vs minggu lalu — GET /api/dashboard/statistik
 * cuma mengirim minggu berjalan (lihat dashboard.routes.js), jadi data
 * pembandingnya memang tidak ada di sini. Kalau nanti mau, backend perlu
 * menambah hitungan rentang -7 hari dulu.
 */
export function ringkasanAktivitas(data: AktivitasHarianMingguan[]): string {
  const total = data.reduce((s, d) => s + d.jumlah, 0);
  // Menangkap dua kondisi sekaligus: array kosong (backend lama / belum
  // termuat) dan minggu yang memang belum ada aktivitasnya.
  if (total === 0) return 'Belum ada aktivitas tercatat minggu ini.';

  const tersibuk = data.reduce((a, b) => (b.jumlah > a.jumlah ? b : a));
  const kalimat = [
    `Minggu ini tercatat ${total} kunjungan & operasi.`,
    `${tersibuk.label} jadi hari tersibuk (${tersibuk.jumlah} pasien).`,
  ];

  const hariIni = data.find((d) => d.highlight);
  if (hariIni) {
    const rata = total / data.length;
    // Dibandingkan ke nilai mentah, bukan yang sudah dibulatkan, supaya kalimat
    // tidak pernah bertabrakan dengan angka rata-rata yang ikut ditampilkan
    // (mis. "5 sama dengan rata-rata 4.9").
    const posisi = hariIni.jumlah > rata ? 'di atas' : hariIni.jumlah < rata ? 'di bawah' : 'sama dengan';
    kalimat.push(
      `Aktivitas hari ini (${hariIni.jumlah}) ${posisi} rata-rata harian (${rata.toFixed(1)}).`,
    );
  }

  return kalimat.join(' ');
}
