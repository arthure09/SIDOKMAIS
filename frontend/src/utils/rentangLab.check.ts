// Self-check rentangLab — pola sama dengan serapNotifikasi.check.ts.
// Jalankan manual:
//   node src/utils/rentangLab.check.ts
import assert from 'node:assert';
import { angkaLab, hitungRelRujukan, parseRujukan } from './rentangLab.ts';

// --- angka ---
assert.equal(angkaLab('11.4'), 11.4);
assert.equal(angkaLab('11,4'), 11.4); // desimal koma dari SIMRS
assert.equal(angkaLab(' -3 '), -3);
assert.equal(angkaLab('Negatif'), null);
assert.equal(angkaLab('Positif 1+'), null);
assert.equal(angkaLab(''), null);
assert.equal(angkaLab(null), null);

// --- rujukan ---
assert.deepEqual(parseRujukan('13.2 - 17.3'), { bawah: 13.2, atas: 17.3 });
assert.deepEqual(parseRujukan('0-35'), { bawah: 0, atas: 35 });
assert.deepEqual(parseRujukan('13,2 – 17,3'), { bawah: 13.2, atas: 17.3 });
assert.deepEqual(parseRujukan('< 5'), { bawah: null, atas: 5 });
assert.deepEqual(parseRujukan('>10'), { bawah: 10, atas: null });
assert.equal(parseRujukan('Negatif'), null);
assert.equal(parseRujukan('-'), null);
assert.equal(parseRujukan(null), null);
// Rentang terbalik ditolak, bukan digambar terbalik.
assert.equal(parseRujukan('17.3 - 13.2'), null);

// --- rel ---
const tengah = hitungRelRujukan('15', '10 - 20');
assert.ok(tengah);
assert.equal(tengah.diLuar, false);
assert.ok(Math.abs(tengah.posisi - 0.5) < 1e-9, 'nilai di tengah rujukan -> tepat 0,5');
assert.ok(tengah.awal > 0 && tengah.akhir < 1, 'ada napas di kedua ujung rel');

// Di bawah rujukan: penanda tetap di dalam rel, segmen rujukan bergeser ke kanan.
const rendah = hitungRelRujukan('8', '13.2 - 17.3');
assert.ok(rendah);
assert.equal(rendah.diLuar, true);
assert.ok(rendah.posisi >= 0 && rendah.posisi < rendah.awal);

// Nilai jauh di atas batas terbuka: penanda dijepit, tidak keluar rel.
const jauh = hitungRelRujukan('9999', '< 5');
assert.ok(jauh);
assert.equal(jauh.awal, 0);
assert.equal(jauh.diLuar, true);
assert.ok(jauh.posisi <= 1);

// Persis di batas = masih di dalam rujukan.
assert.equal(hitungRelRujukan('35', '0 - 35')?.diLuar, false);

// Rentang nol lebar tidak membuat pembagian nol.
const nol = hitungRelRujukan('5', '5 - 5');
assert.ok(nol && Number.isFinite(nol.posisi));

// Hasil kualitatif tidak punya rel.
assert.equal(hitungRelRujukan('Negatif', 'Negatif'), null);
assert.equal(hitungRelRujukan('11.4', null), null);

console.log('rentangLab: semua check lolos');
