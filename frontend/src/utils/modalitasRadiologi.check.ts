// Self-check modalitasRadiologi. Jalankan manual: node src/utils/modalitasRadiologi.check.ts
import assert from 'node:assert';
import { kodeModalitas } from './modalitasRadiologi.ts';

// Nilai yang benar-benar ada di master.tindakan_klp_radiologi.
assert.equal(kodeModalitas('konvensional'), 'RO');
assert.equal(kodeModalitas('MRI'), 'MRI');
assert.equal(kodeModalitas('CT Scan'), 'CT');
assert.equal(kodeModalitas('USG'), 'USG');
assert.equal(kodeModalitas('Flouroscopy'), 'FLR'); // ejaan SIMRS memang salah
assert.equal(kodeModalitas('Gamma Camera'), 'NUK');
assert.equal(kodeModalitas('Kedokteran Nuklir'), 'NUK');
assert.equal(kodeModalitas('Intervensi'), 'INT');
assert.equal(kodeModalitas('Mammografi'), 'MMG');
assert.equal(kodeModalitas('PET CT'), 'PET');
assert.equal(kodeModalitas('MOBIL MAMMOGRAFI'), 'MMG');

// Gabungan dua modalitas: PET menang, bukan CT — urutan aturan yang menjaganya.
assert.equal(kodeModalitas('PET CT DAN CT BRAIN'), 'PET');

// Kelompok yang belum dikenali tetap dapat kode yang bisa dibedakan.
assert.equal(kodeModalitas('Densitometri'), 'DEN');
assert.equal(kodeModalitas('3D Printing'), 'DPR');

// Kosong/null -> penanda generik, bukan string kosong di layar.
assert.equal(kodeModalitas(null), 'RAD');
assert.equal(kodeModalitas(undefined), 'RAD');
assert.equal(kodeModalitas('   '), 'RAD');
assert.equal(kodeModalitas('123'), 'RAD');

console.log('modalitasRadiologi: semua check lolos');
