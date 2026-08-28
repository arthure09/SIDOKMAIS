// Self-check kelompokHasilLab. Jalankan manual: node src/utils/kelompokHasilLab.check.ts
// File ini tidak pernah di-import app, jadi tidak ikut masuk bundle.
import assert from 'node:assert';
import { kelompokkanPerTanggal } from './kelompokHasilLab.ts';
import type { HasilLabRingkasan } from '../api/types.ts';

const item = (o: Partial<HasilLabRingkasan> & { id: string; tanggalPermintaan: string }): HasilLabRingkasan => ({
  kategori: 'Hematologi',
  namaPemeriksaan: 'Darah Rutin',
  laboratorium: 'Lab PK',
  status: 'COMPLETED',
  tanggalHasil: o.tanggalPermintaan,
  jumlahParameter: 3,
  jumlahAbnormal: 0,
  ...o,
});

// Tiga pemeriksaan di jam berbeda pada hari yang sama -> satu grup.
const satuHari = kelompokkanPerTanggal([
  item({ id: 'a', tanggalPermintaan: '2026-08-24T01:00:00.000Z', namaPemeriksaan: 'Darah Rutin' }),
  item({ id: 'b', tanggalPermintaan: '2026-08-24T03:30:00.000Z', namaPemeriksaan: 'Kimia Darah', laboratorium: 'Lab PA', jumlahParameter: 5, jumlahAbnormal: 2 }),
  item({ id: 'c', tanggalPermintaan: '2026-08-24T05:00:00.000Z', namaPemeriksaan: 'Darah Rutin' }),
]);
assert.equal(satuHari.length, 1);
assert.deepEqual(satuHari[0].ids, ['a', 'b', 'c']);
assert.equal(satuHari[0].jumlahParameter, 11);
assert.equal(satuHari[0].jumlahAbnormal, 2);
// Nama pemeriksaan & laboratorium dideduplikasi, urutan kemunculan dijaga.
assert.deepEqual(satuHari[0].pemeriksaan, ['Darah Rutin', 'Kimia Darah']);
assert.deepEqual(satuHari[0].labs, ['Lab PK', 'Lab PA']);

// Tanggal berbeda tetap terpisah, urutan dari backend (DESC) dipertahankan.
const duaHari = kelompokkanPerTanggal([
  item({ id: 'a', tanggalPermintaan: '2026-08-24T01:00:00.000Z' }),
  item({ id: 'b', tanggalPermintaan: '2026-08-20T01:00:00.000Z' }),
]);
assert.deepEqual(duaHari.map((g) => g.ids), [['a'], ['b']]);

// Laboratorium null tidak masuk daftar lab (layar menampilkan fallback sendiri).
assert.deepEqual(
  kelompokkanPerTanggal([item({ id: 'a', tanggalPermintaan: '2026-08-24T01:00:00.000Z', laboratorium: null })])[0].labs,
  [],
);

assert.deepEqual(kelompokkanPerTanggal([]), []);

console.log('kelompokHasilLab: semua check lolos');
