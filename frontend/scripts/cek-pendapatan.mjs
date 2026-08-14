// Cek data pendapatan: `node scripts/cek-pendapatan.mjs` (Node 23+, TS di-strip
// otomatis). Bukan unit test screen — yang dijaga di sini invarian datanya,
// karena di situ bug sebelumnya bersarang: ringkasan yang tidak nyambung ke
// daftar transaksi. Semua angka di DataPendapatanScreen dijumlah dari array ini.
import assert from 'node:assert/strict';
import { transaksiPendapatan } from '../src/mocks/pendapatanMock.ts';

const ids = new Set(transaksiPendapatan.map((t) => t.id));
assert.equal(ids.size, transaksiPendapatan.length, 'id transaksi duplikat');

for (const t of transaksiPendapatan) {
  // Privasi: baris jasa medis tidak membawa identitas pasien sama sekali —
  // termasuk No. RM tersamar. Menyensor di UI tidak menolong kalau field-nya
  // tetap ikut terkirim, jadi yang dijaga di sini bentuk datanya.
  for (const bocor of ['pasienNama', 'norm', 'pasienId', 'diagnosa', 'diagnosaSingkat']) {
    assert.ok(!(bocor in t), `identitas pasien bocor lewat "${bocor}": ${t.id}`);
  }
  assert.match(t.tanggal, /^\d{4}-\d{2}-\d{2}$/, `tanggal bukan ISO: ${t.id}`);
  assert.ok(Number.isInteger(t.nominal) && t.nominal > 0, `nominal tidak wajar: ${t.id}`);
  // Status di luar dua nilai ini bikin transaksinya lenyap dari dua-duanya:
  // tidak masuk "diterima", tidak masuk "menunggu" — panel diam-diam kurang.
  assert.ok(['TERVERIFIKASI', 'MENUNGGU'].includes(t.status), `status asing: ${t.id}`);
  assert.ok(['OPERASI', 'KONSUL'].includes(t.jenis), `jenis asing: ${t.id}`);
}

const jumlah = (list) => list.reduce((n, t) => n + t.nominal, 0);
const bulan = [...new Set(transaksiPendapatan.map((t) => t.tanggal.slice(0, 7)))];

for (const key of bulan) {
  const isi = transaksiPendapatan.filter((t) => t.tanggal.startsWith(key));
  const diterima = isi.filter((t) => t.status === 'TERVERIFIKASI');
  const menunggu = isi.filter((t) => t.status === 'MENUNGGU');
  assert.equal(jumlah(diterima) + jumlah(menunggu), jumlah(isi), `total ${key} tidak utuh`);

  // Bar komposisi digambar dari transaksi diterima saja, jadi segmen-segmennya
  // harus persis menjumlah ke angka besar di atasnya.
  const perSumber = new Map();
  for (const t of diterima) perSumber.set(t.sumber, (perSumber.get(t.sumber) ?? 0) + t.nominal);
  const totalSegmen = [...perSumber.values()].reduce((a, b) => a + b, 0);
  assert.equal(totalSegmen, jumlah(diterima), `komposisi penjamin ${key} tidak pas`);
}

assert.ok(bulan.length >= 2, 'butuh minimal 2 bulan supaya delta bulan lalu ada isinya');
console.log(`OK — ${transaksiPendapatan.length} transaksi, ${bulan.length} bulan: ${bulan.join(', ')}`);
