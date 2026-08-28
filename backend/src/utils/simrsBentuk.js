// Terjemahan baris mentah SIMRS -> bentuk yang sudah dipakai API SIDOKMAIS.
//
// Tujuannya satu: response endpoint versi SIMRS harus sama persis bentuknya
// dengan versi dummy, supaya frontend tidak perlu tahu sumber datanya yang
// mana. Kalau ada field yang SIMRS memang tidak punya, isinya `null` — bukan
// dihilangkan, bukan ditebak.
//
// Kode-kode di bawah berasal dari COLUMN_COMMENT di skema SIMRS itu sendiri,
// kecuali yang ditandai BELUM DIVERIFIKASI.

const { WIB_OFFSET_MS } = require("./wib");
const { jenisKunjungan } = require("./jenisKunjungan");

// Server SIMRS menyimpan waktu sebagai wall-clock WIB tanpa offset, dan pool
// dikonfigurasi dateStrings:true, jadi yang sampai ke sini berupa
// "YYYY-MM-DD HH:MM:SS" atau "YYYY-MM-DD". Ditandai +07:00 secara eksplisit —
// tanpa itu Date() akan membacanya sebagai waktu lokal proses (container
// biasanya UTC) dan seluruh jadwal meleset 7 jam.
function tanggalWIB(nilai) {
  if (!nilai) return null;
  const teks = String(nilai).trim();
  if (!teks || teks.startsWith("0000-00-00")) return null; // zero-date MySQL
  const iso = teks.includes(" ") ? teks.replace(" ", "T") : `${teks}T00:00:00`;
  const d = new Date(`${iso}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Gabung kolom `date` + kolom `time` terpisah (pola di tb_waiting_list_operasi
// + penjadwalan_operasi) jadi satu instant. Kalau jamnya kosong, jatuh ke
// tengah malam WIB tanggal itu.
function tanggalJamWIB(tanggal, jam) {
  if (!tanggal) return null;
  const hari = String(tanggal).trim().slice(0, 10);
  const waktu = jam ? String(jam).trim() : "00:00:00";
  const d = new Date(`${hari}T${waktu}+07:00`);
  return Number.isNaN(d.getTime()) ? tanggalWIB(tanggal) : d;
}

// Kebalikan tanggalWIB: instant JS -> "YYYY-MM-DD HH:MM:SS" jam dinding WIB,
// bentuk yang dipakai kolom datetime SIMRS. Dipakai untuk filter rentang
// tanggal — tanpa ini `dari`/`sampai` (instant UTC hasil parseTanggalAwalWIB)
// dibandingkan ke kolom WIB dan melenceng 7 jam.
function keWaktuSimrs(instant) {
  if (!instant) return null;
  return new Date(instant.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 19).replace("T", " ");
}

// master.pasien.JENIS_KELAMIN tinyint, default 1.
//
// BELUM DIVERIFIKASI ke master.referensi — 1=L/2=P adalah konvensi umum SIMRS
// dan konsisten dengan default kolomnya, tapi belum dikonfirmasi ke DBA.
// Nilai di luar 1/2 sengaja jadi null, bukan ditebak jadi "L": salah jenis
// kelamin di layar dokter lebih buruk daripada field kosong.
// ponytail: konfirmasi ke master.referensi kalau sudah ada izin baca tabel
// lookup, lalu hapus catatan ini.
const JENIS_KELAMIN = { 1: "L", 2: "P" };

function jenisKelamin(kode) {
  return JENIS_KELAMIN[Number(kode)] ?? null;
}

// master.ruangan.JENIS_KUNJUNGAN — komentar kolomnya: "2 = IGD, 3 = Rawat Inap,
// 15 = tower C, 1 dll = Rawat Jalan". Dipetakan ke enum RuanganJenis milik
// SIDOKMAIS. `OK` tidak pernah keluar dari sini: ruang operasi dipegang modul
// Operasi lewat kolomnya sendiri, sama seperti di versi dummy.
// `master.ruangan.JENIS_KUNJUNGAN` bukan cuma rawat jalan/IGD/rawat inap. Dari
// 435 ruangan aktif ada 11 kode berbeda, dan sebagian besar BUKAN tempat dokter
// menemui pasien:
//
//   1  poliklinik/rawat jalan     2  IGD              3  rawat inap
//   14 Poli Cendana & konsultasi online                15 klinik khusus
//   0  kantor/administrasi (224 ruangan)               4  laboratorium
//   5  radiologi                  6  kamar bedah      11 farmasi/gudang/counter
//   13 radioterapi & pencampuran obat
//
// DAFTAR PUTIH, bukan daftar hitam: memetakan "semua yang bukan 2 atau 3" ke
// POLI membuat pengambilan obat di farmasi, cek lab, dan foto radiologi ikut
// terhitung sebagai kunjungan dokter — untuk satu dokter dalam sehari
// selisihnya 421 vs 194. Kode yang tidak dikenal sengaja jatuh ke null: lebih
// baik satu baris tidak berkategori daripada seluruh unit penunjang mengaku
// poliklinik.
const KODE_RUANGAN = { 1: "POLI", 14: "POLI", 15: "POLI", 2: "IGD", 3: "RAWAT_INAP" };

/** Kode ruangan yang dihitung sebagai pertemuan dokter–pasien. */
const KODE_KUNJUNGAN_KLINIS = Object.keys(KODE_RUANGAN).map(Number);

/** Potongan SQL: baris kunjungan yang benar-benar pertemuan, bukan unit penunjang. */
const SQL_KUNJUNGAN_KLINIS = `r.JENIS_KUNJUNGAN IN (${KODE_KUNJUNGAN_KLINIS.join(", ")})`;

function ruanganJenis(kodeJenisKunjungan) {
  return KODE_RUANGAN[Number(kodeJenisKunjungan)] ?? null;
}

// Kategori kunjungan untuk field `jenisKunjungan` di response API.
//
// BEDA dari ruanganJenis() di atas, dan campur aduk keduanya adalah bug yang
// benar-benar terjadi: mengirim "POLI" (nilai `Ruangan.jenis`) ke field
// `jenisKunjungan` tidak memicu error di mana pun — frontend cuma tidak
// mengenali nilainya, jadi label kategori pasien tampil kosong seolah datanya
// tidak ada. Ada dua kosakata di aplikasi ini:
//   - `Ruangan.jenis`  -> POLI / IGD / RAWAT_INAP / OK   (internal, dipakai
//                          untuk field `ruangan.jenis`)
//   - `jenisKunjungan` -> RAWAT_JALAN / IGD / RAWAT_INAP (publik, dipakai UI
//                          dan query string)
//
// Konversinya menumpang helper yang sudah ada supaya tetap satu sumber
// kebenaran, bukan tabel padanan kedua yang bisa menyimpang.
function kategoriKunjungan(kodeJenisKunjungan) {
  if (kodeJenisKunjungan === null || kodeJenisKunjungan === undefined) return null;
  return jenisKunjungan({ jenis: ruanganJenis(kodeJenisKunjungan) });
}

// medis.tb_konsul.cito — komentar kolomnya: "799: Biasa 800: Cito".
function prioritasKonsul(cito) {
  return Number(cito) === 800 ? "CITO" : "BIASA";
}

// medis.tb_konsul.status — "0: Dibatalkan 1: Konsul sudah dikirim 2: Konsul
// sudah dijawab". SIDOKMAIS hanya punya MENUNGGU_JAWABAN & SUDAH_DIJAWAB, jadi
// status 0 tidak dipetakan sama sekali — konsul batal disaring di query, bukan
// ditampilkan dengan status yang salah.
function statusKonsul(status) {
  return Number(status) === 2 ? "SUDAH_DIJAWAB" : "MENUNGGU_JAWABAN";
}

// medis.tb_konsul_jawab.persetujuan_kasus — "804: tidak ditentukan 805: setuju
// 806: tidak setuju". Model SIDOKMAIS menyimpannya sebagai teks bebas
// (`setujuUntuk`), jadi diterjemahkan ke label, bukan boolean.
const PERSETUJUAN = { 804: null, 805: "Setuju", 806: "Tidak setuju" };

function persetujuanKasus(kode) {
  return PERSETUJUAN[Number(kode)] ?? null;
}

// medis.tb_konsul.penilaian_kasus — "801: tidak ditentukan 802: alih rawat
// 803: rawat bersama".
const PENILAIAN = { 801: null, 802: "Alih rawat", 803: "Rawat bersama" };

function penilaianKasus(kode) {
  return PENILAIAN[Number(kode)] ?? null;
}

// Nama lengkap dokter/pegawai dari master.pegawai (gelar disimpan terpisah).
// Bagian yang kosong dibuang supaya tidak menyisakan spasi ganda.
function namaLengkap({ gelarDepan, nama, gelarBelakang }) {
  return [gelarDepan, nama, gelarBelakang].map((s) => (s || "").trim()).filter(Boolean).join(" ");
}

// SIMRS memakai NOT NULL tanpa default di banyak tabel (mis. seluruh kolom
// medicalrecord.operasi), jadi "tidak diisi" tersimpan sebagai string kosong,
// bukan NULL. Untuk API, keduanya harus jadi null yang sama.
function teks(nilai) {
  if (nilai === null || nilai === undefined) return null;
  const s = String(nilai).trim();
  return s === "" ? null : s;
}

// Teks diagnosa di master.diagnosa_masuk sebagian berupa isian sampah: dari
// 40.845 baris, 618 panjangnya <= 2 karakter dan 76 cuma tanda baca ("." , "-").
// Kelihatan sedikit, tapi kode-kode itu justru sering terpakai — pada sampel
// 10 pasien pertama, 2 dari 3 diagnosa yang muncul berisi ".". Diperlakukan
// sebagai tidak ada, karena kartu pasien bertuliskan "." lebih buruk daripada
// kartu tanpa diagnosa.
function diagnosaBersih(nilai) {
  const s = teks(nilai);
  if (!s) return null;
  if (s.length <= 2) return null;
  if (/^[.,;:\-_/\\|*?()[\]{}\s]+$/.test(s)) return null;
  return s;
}

module.exports = {
  tanggalWIB,
  tanggalJamWIB,
  keWaktuSimrs,
  diagnosaBersih,
  jenisKelamin,
  ruanganJenis,
  kategoriKunjungan,
  KODE_KUNJUNGAN_KLINIS,
  SQL_KUNJUNGAN_KLINIS,
  prioritasKonsul,
  statusKonsul,
  persetujuanKasus,
  penilaianKasus,
  namaLengkap,
  teks,
};
