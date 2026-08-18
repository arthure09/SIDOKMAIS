# Rencana Revisi Modul Klinis — SIDOKMAIS

**Konteks:** Revisi ini disusun setelah menerima referensi bentuk asli dokumen SIMRS RS Dharmais (Lembar Konsultasi, Laporan Operasi) dan screenshot dashboard jasa medis (SIREMDIS). Revisi mengoreksi beberapa asumsi awal di `rencana-pengembangan-aplikasi-dokter.md`, terutama pada modul Konsultasi. Berlaku untuk periode buffer pasca-jadwal 4 minggu formal.

**Prinsip yang tetap berlaku:** `dokterId`/`dokterTujuanId` selalu dari JWT server-side, tidak pernah dari client. Semua modul di dokumen ini tetap **view-only** (data disimulasikan sync dari SIMRS via Admin).

---

## Ringkasan 4 Tahap

| Tahap | Modul | Sifat Perubahan | Prioritas |
|---|---|---|---|
| 1 | Kategori Kunjungan | Additive (field baru nullable) | Fondasi — dikerjakan lebih dulu |
| 2 | Model Konsultasi | Restrukturisasi total (model baru) | Tinggi — paling berisiko |
| 3 | Ekspansi Operasi | Additive (field baru nullable) | Menengah |
| 4 | Pendapatan/Jasa Medis | Kemungkinan restrukturisasi (tergantung state saat ini) | Rendah — buffer |

**Keputusan yang sudah dikunci:**
- Konsultasi: dokter yang login hanya melihat konsul yang **ditujukan kepadanya** (`dokterTujuanId`), bukan yang dia ajukan.
- Operasi: field laporan lengkap tampil **hanya saat status Selesai**; status terjadwal/berlangsung hanya menampilkan info jadwal.

---

## Tahap 1: Kategori Kunjungan (Rawat Jalan / IGD / Rawat Inap)

### Sebelum
`Kunjungan` tidak membedakan jenis kunjungan pasien — generic visit record.

### Sesudah
Tiga field baru pada `Kunjungan`, semua additive:

| Field | Tipe | Keterangan |
|---|---|---|
| `jenisKunjungan` | enum | `RAWAT_JALAN`, `IGD`, `RAWAT_INAP` |
| `ruangan` | String, nullable | Nama bangsal, hanya terisi untuk `RAWAT_INAP` |
| `nomorKamar` | String, nullable | Nomor kamar spesifik — **belum ada contoh di referensi, perlu konfirmasi Mas Fauzi** |

### Perubahan Backend
- Endpoint list pasien/kunjungan: tambah filter `jenisKunjungan`.
- Tidak ada perubahan pada logic akses (tetap ikut `DokterPasienAssignment`).

### Perubahan Frontend
- List pasien: badge jenis kunjungan.
- Detail pasien: tampilkan `ruangan` + `nomorKamar` kondisional (hanya jika Rawat Inap).

### Dependency
Tidak bergantung pada tahap lain. Jadi fondasi kontekstual untuk Tahap 2 (Konsultasi juga punya field status rawat + ruangan).

### Item Terbuka
- Format `nomorKamar` (apakah perlu bed/tempat tidur juga, atau nomor kamar saja cukup) — belum dikonfirmasi.

---

## Tahap 2: Model Konsultasi Baru

### Sebelum
Konsultasi tidak punya model sendiri — didekati sebagai derived dari `Kunjungan`, mengikuti asumsi awal bahwa "Konsultasi" = jadwal appointment (mirip modul Operasi lama).

### Sesudah — koreksi konsep
Referensi `Lembar Konsultasi` menunjukkan bentuk aslinya: surat konsul antar-dokter, bukan jadwal. Satu dokter meminta pendapat dokter lain soal satu pasien; ada dua pihak (pengirim, tujuan) dan dua state (menunggu jawaban, sudah dijawab).

**Model `Konsultasi` baru (berdiri sendiri):**

| Field | Tipe | Keterangan |
|---|---|---|
| `pasienId` | FK → Pasien | wajib |
| `kunjunganId` | FK → Kunjungan, nullable | konteks kunjungan terkait |
| `dokterTujuanId` | FK → Dokter | dokter yang dikonsult — **sumber scoping akses** |
| `prioritas` | enum | `BIASA`, `CITO` — dimensi terpisah dari `jenisKunjungan` |
| `diagnosisKerja` | String | |
| `kesadaran`, `tekananDarah`, `nadi`, `pernapasan`, `suhu`, `tinggiBadan`, `beratBadan`, `nyeri` | ikhtisar klinis | dari bagian "Ikhtisar Klinis" |
| `konsulYangDiminta` | Text | isi permintaan spesifik |
| `status` | enum | `MENUNGGU_JAWABAN`, `SUDAH_DIJAWAB` |
| `penemuan` | Text, nullable | bagian jawaban — S/O + hasil penunjang |
| `diagnosisJawaban` | String, nullable | |
| `anjuran` | Text, nullable | |
| `setujuUntuk` | String, nullable | |
| `tanggalJawaban` | DateTime, nullable | |

### Perubahan Backend
- Endpoint baru: list + detail Konsultasi.
- Akses di-scope: `WHERE dokterTujuanId = req.user.dokterId` (dari JWT) — **bukan** lewat `DokterPasienAssignment`, beda pattern dari modul lab.

### Perubahan Frontend
- Layar baru: dua section — Permintaan (selalu tampil) dan Jawaban (kondisional, hanya jika `status = SUDAH_DIJAWAB`).
- List Konsultasi: badge status + prioritas.

### Dependency
Independen dari Tahap 1 secara teknis, tapi referensi field `ruangan`/status rawat di form permintaan sebaiknya konsisten dengan enum `jenisKunjungan` dari Tahap 1.

### Item Terbuka
Tidak ada — akses dan arah tampilan sudah dikunci.

---

## Tahap 3: Ekspansi Field Operasi

### Sebelum
`Operasi` kemungkinan berisi field dasar: tanggal/jam, ruang OK, jenis tindakan, status.

### Sesudah
Field baru (semua nullable — additive, tampil kondisional berdasarkan status):

| Grup | Field |
|---|---|
| Tim | `dokterOperator`, `asistenOperator`, `perawatInstrumentator`, `perawatSirkuler`, `dokterAnestesi`, `jenisAnestesi`, `kategoriOperasi` |
| Diagnosa | `diagnosaPraBedah`, `diagnosaPascaBedah` |
| Waktu | `jamMulaiInsisi`, `jamSelesai` |
| Klasifikasi | `sifatOperasi` (enum: `ELEKTIF`/`CITO`), `jenisPembedahan` (enum: `BERSIH`/`BERSIH_TERKONTAMINASI`/`KONTAMINASI`/`KOTOR`), `antibiotikProfilaksis` (boolean) |
| Anestesi lokal *(kondisional)* | `teknikAnestesiLokal`, `lokasiAnestesi`, `obatAnestesi`, `responHipersensitivitas`, `kejadianToksikasi` |
| Tindakan | `tindakanDilakukan`, `deskripsiOperasi` (Text) |
| Hasil | `komplikasi`, `jumlahKehilanganDarah`, `transfusi`, `spesimen`, `pemasanganImplan` |

### Perubahan Backend
Endpoint detail Operasi: render kondisional —
- `status = SELESAI` → semua field di atas disertakan.
- `status = DIJADWALKAN` / `BERLANGSUNG` → hanya field jadwal dasar (tanggal, jam, ruang OK, jenis tindakan, dokter operator).

### Perubahan Frontend
Section "Laporan Lengkap" muncul kondisional berdasarkan status operasi.

### Dependency
Independen. Tidak breaking terhadap data Operasi yang sudah ada (semua field baru nullable).

### Item Terbuka
- Akses masih diasumsikan via `DokterPasienAssignment` (belum dikonfirmasi eksplisit — beda pattern dari Konsultasi yang pakai named-in-record).
- Seed generator perlu update supaya field naratif (deskripsi operasi, komplikasi) klinis masuk akal, bukan random text — ikuti prinsip yang sama dengan seed lab.

---

## Tahap 4: Restrukturisasi Pendapatan/Jasa Medis

### Sebelum
Modul Pendapatan — skema dummy minimal (sesuai rencana awal: "Next Phase — skema saja").

### Sesudah
Dua layer secara data (ringkasan + detail transaksi). **Frontend tidak perlu meniru layout dashboard SIREMDIS** — cukup ikuti format pengelompokan JKN vs Non-JKN.

**Ringkasan periode:**

| Field | Keterangan |
|---|---|
| `dokterId`, `smf` | identitas + spesialisasi |
| `tanggalAwal`, `tanggalAkhir` | filter periode |
| `totalJkn`, `totalNonJkn` | dua kelompok utama |
| `totalRemunerasiBruto` | total gabungan (JKN + Non-JKN) |

**Detail transaksi (per tindakan):**

| Field | Contoh |
|---|---|
| `norm` | No RM pasien |
| `namaPasien` | |
| `namaTindakan` | contoh: "Konsul Ruang Perawatan" |
| `tanggalTindakan` | |
| `jasa` | nominal Rp |
| `unitPelayanan` | contoh: "Anak" |
| `penjamin` | contoh: "BPJS/JKN" |

### Perubahan Backend
- Endpoint ringkasan (filter tanggal awal-akhir, agregasi JKN/Non-JKN).
- Endpoint detail transaksi per periode.

### Perubahan Frontend
- **Tidak meniru chrome dashboard SIREMDIS** (card besar, progress bar, toggle sembunyikan nominal, style filter tanggal SIREMDIS) — semua itu di-drop.
- Layar cukup menampilkan: total per kelompok (JKN, Non-JKN, Total), lalu list transaksi di bawahnya — mengikuti gaya UI existing app (hand-built `View`/`Pressable`/`Text` + `StyleSheet`, konsisten dengan modul lain, bukan `react-native-paper`).
- List transaksi bisa dikelompokkan (section by `penjamin` kategori JKN/Non-JKN) atau flat dengan kolom `penjamin` — pilih yang konsisten dengan pola list pasien yang sudah ada.

### Dependency
Independen dari tahap lain. Prioritas paling rendah.

### Item Terbuka
- Menu "Pendapatan" terpisah di SIREMDIS (beda dari "Dashboard Remunerasi") belum ada referensinya — **di-skip** untuk sekarang.
- Struktur tabel remunerasi asli sebaiknya dikonfirmasi ke Mas Fauzi kalau memungkinkan — screenshot referensi ini kemungkinan berasal dari sistem produksi, jadi lebih akurat daripada reverse-engineer dari tampilan saja.

---

## Pre-check Wajib Sebelum Eksekusi Tahap Manapun

1. Inspeksi `schema.prisma` aktual — sebagian field mungkin sudah ada dari kerja sebelumnya, jangan double-apply.
2. Cek bug determinism seed di `seed-kunjungan-operasi.js:67,71` — pastikan pola `Math.random()` tanpa `faker.seed()` yang benar tidak ikut tertular ke seed generator baru untuk field-field tahap ini.
3. Untuk Tahap 2 khususnya: cek apakah ada kode/UI lama yang masih mengasumsikan "Konsultasi = jadwal view-only" (sesuai rencana awal) — itu perlu direplace total, bukan di-extend.

## Urutan Eksekusi yang Disarankan

```
Tahap 1 (fondasi)
   ↓
Tahap 2 (paling berisiko, independen secara teknis tapi konsisten dgn Tahap 1)
   ↓
Tahap 3 (independen, additive)
   ↓
Tahap 4 (prioritas rendah, buffer)
```
