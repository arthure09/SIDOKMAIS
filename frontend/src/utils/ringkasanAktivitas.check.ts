// Self-check ringkasanAktivitas — frontend belum punya Jest, dan menambahkannya
// cuma buat satu fungsi murni tidak sepadan. Jalankan manual:
//   node src/utils/ringkasanAktivitas.check.ts
// File ini tidak pernah di-import app, jadi tidak ikut masuk bundle.
import assert from 'node:assert';
import { ringkasanAktivitas } from './ringkasanAktivitas.ts';

const hari = (label: string, jumlah: number, highlight = false) => ({ label, jumlah, highlight });

assert.equal(ringkasanAktivitas([]), 'Belum ada aktivitas tercatat minggu ini.');

// Semua hari nol — bukan cuma array kosong.
assert.equal(
  ringkasanAktivitas([hari('Senin', 0), hari('Selasa', 0, true)]),
  'Belum ada aktivitas tercatat minggu ini.',
);

// Tanpa hari yang di-highlight (mis. minggu yang dilihat bukan minggu berjalan):
// kalimat ketiga dilewati, bukan menampilkan "undefined".
assert.equal(
  ringkasanAktivitas([hari('Senin', 2), hari('Selasa', 4)]),
  'Minggu ini tercatat 6 kunjungan & operasi. Selasa jadi hari tersibuk (4 pasien).',
);

// Kasus utama: hari ini di atas rata-rata (5 vs 4.0).
assert.equal(
  ringkasanAktivitas([hari('Senin', 3), hari('Selasa', 5, true), hari('Rabu', 4)]),
  'Minggu ini tercatat 12 kunjungan & operasi. Selasa jadi hari tersibuk (5 pasien). ' +
    'Aktivitas hari ini (5) di atas rata-rata harian (4.0).',
);

// Di bawah rata-rata.
assert.ok(
  ringkasanAktivitas([hari('Senin', 9), hari('Selasa', 1, true)]).endsWith(
    'Aktivitas hari ini (1) di bawah rata-rata harian (5.0).',
  ),
);

// Persis rata-rata.
assert.ok(
  ringkasanAktivitas([hari('Senin', 4), hari('Selasa', 4, true)]).endsWith(
    'Aktivitas hari ini (4) sama dengan rata-rata harian (4.0).',
  ),
);

// Seri di hari tersibuk: ambil yang pertama, jangan sampai berubah-ubah.
assert.ok(
  ringkasanAktivitas([hari('Senin', 7), hari('Selasa', 7)]).includes('Senin jadi hari tersibuk'),
);

console.log('ringkasanAktivitas: semua check lolos');
