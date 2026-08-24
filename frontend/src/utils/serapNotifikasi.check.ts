// Self-check serapNotifikasi — pola sama dengan ringkasanAktivitas.check.ts.
// Jalankan manual:
//   node src/utils/serapNotifikasi.check.ts
// File ini tidak pernah di-import app, jadi tidak ikut masuk bundle.
import assert from 'node:assert';
import { serapNotifikasi } from './serapNotifikasi.ts';

const n = (id: string) => ({ id });

// Poll pertama (baseline): tidak ada yang dinotifikasi, tapi semua dicatat.
const sudahDilihat = new Set<string>();
assert.deepEqual(serapNotifikasi([n('a'), n('b')], sudahDilihat, true), []);
assert.deepEqual([...sudahDilihat], ['a', 'b']);

// Poll kedua: cuma yang benar-benar baru.
assert.deepEqual(serapNotifikasi([n('a'), n('b'), n('c')], sudahDilihat, false), [n('c')]);

// Poll ketiga tanpa perubahan: tidak ada notifikasi dobel.
assert.deepEqual(serapNotifikasi([n('a'), n('b'), n('c')], sudahDilihat, false), []);

// Set kosong + bukan baseline (mis. login setelah logout): semua dianggap baru.
assert.deepEqual(serapNotifikasi([n('x')], new Set<string>(), false), [n('x')]);

console.log('serapNotifikasi: semua check lolos');
