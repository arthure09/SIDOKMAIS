# Pemetaan Skema SIMRS RS Dharmais (replika read-only)

**Tanggal pemetaan:** 21 Agustus 2026
**Host:** lihat `SIMRS_HOST` / `SIMRS_USER` di `backend/.env` (tidak ditulis di sini —
berkas ini ikut ter-commit, alamat internal rumah sakit dan nama akun DB tidak perlu
ikut keluar bersamanya).
**Hak akses akun:** `GRANT SELECT` saja, read-only, terverifikasi.
**Metode:** hanya `information_schema` (`columns`, `key_column_usage`, `statistics`,
`tables`, `schemata`). **Nol baris data pasien dibaca.** Tidak ada `SELECT * FROM <tabel>`
dijalankan sama sekali.

Server punya **118 skema**. Yang relevan untuk SIDOKMAIS: `master`, `pendaftaran`,
`medicalrecord`, `perjanjian`, plus `medis`, `remun_medis`, `db_reservasi` yang muncul
sebagai target relasi lintas-skema.

---

## 0. Temuan struktural paling penting

1. **Hampir tidak ada foreign key yang dideklarasikan.** Dari 8 tabel target, **nol**
   punya FK InnoDB. Seluruh server hanya punya 6 FK yang menyentuh keempat skema ini, dan
   cuma 2 di antaranya menyentuh tabel target (keduanya dari skema `medis`). Artinya:
   **semua relasi di bawah adalah konvensi penamaan + kecocokan tipe kolom, bukan constraint
   yang dijamin DB.** Integritas referensial dijaga di layer aplikasi, bukan di database.

2. **`master.dokter` tidak punya kolom `NAMA`.** Identitas dokter (nama, gelar, kelamin,
   alamat) ada di `master.pegawai`, dijoin lewat `NIP`. Setiap query yang butuh nama dokter
   wajib join dua tabel.

3. **Rantai `NOPEN` ↔ `NORM` diperantarai `pendaftaran.pendaftaran`.** Tidak ada kolom
   `NORM` di `pendaftaran.kunjungan`. Untuk dapat pasien dari sebuah kunjungan:
   `kunjungan.NOPEN` → `pendaftaran.pendaftaran.NOMOR` → `.NORM` → `master.pasien.NORM`.

4. **Ada tiga tabel "operasi" yang berbeda peran**, di tiga skema berbeda. Lihat §4.

---

## 1. Tabel + kolom lengkap

Legenda: `PRI` = primary key, `MUL` = ada index non-unik. Komentar kolom diambil apa adanya
dari `COLUMN_COMMENT`.

### 1.1 `master.dokter` (7 kolom)

| # | Kolom | Tipe | Null | Key | Default / Extra | Komentar |
|---|---|---|---|---|---|---|
| 1 | `ID` | smallint(6) | NOT NULL | PRI | auto_increment | |
| 2 | `NIP` | varchar(30) | NOT NULL | MUL | | |
| 3 | `SIP` | varchar(100) | NULL | | | Surat Izin Praktik |
| 4 | `TANGGAL_BERLAKU_SIP` | date | NULL | | | |
| 5 | `TANGGAL_BERAKHIR_SIP` | date | NULL | | | |
| 6 | `HAFIS` | int(9) | NULL | MUL | `0` | |
| 7 | `STATUS` | tinyint(4) | NOT NULL | | `1` | |

> Tabel ini murni atribut ke-dokter-an (SIP + status). Data orangnya di `master.pegawai`.

### 1.2 `master.pegawai` (21 kolom)

| # | Kolom | Tipe | Null | Key | Default / Extra | Komentar |
|---|---|---|---|---|---|---|
| 1 | `NIP` | varchar(30) | NOT NULL | PRI | | Nomor Induk Pegawai / Karyawan |
| 2 | `NAMA` | varchar(75) | NOT NULL | MUL | | |
| 3 | `PANGGILAN` | varchar(15) | NULL | | | |
| 4 | `GELAR_DEPAN` | varchar(25) | NULL | | | |
| 5 | `GELAR_BELAKANG` | varchar(100) | NULL | | | |
| 6 | `TEMPAT_LAHIR` | varchar(35) | NOT NULL | | | |
| 7 | `TANGGAL_LAHIR` | datetime | NULL | | | |
| 8 | `AGAMA` | tinyint(4) | NULL | | | |
| 9 | `JENIS_KELAMIN` | tinyint(4) | NOT NULL | | `1` | |
| 10 | `PROFESI` | mediumint(7) | NOT NULL | | | |
| 11 | `SMF` | mediumint(7) | NOT NULL | | `36` | Satuan Medis Fungsional (≈ spesialisasi) |
| 12 | `KTP` | varchar(16) | NULL | | | |
| 13 | `ALAMAT` | varchar(150) | NOT NULL | | | |
| 14 | `RT` | char(3) | NULL | | | |
| 15 | `RW` | char(3) | NULL | | | |
| 16 | `KODEPOS` | char(5) | NULL | | | |
| 17 | `WILAYAH` | char(10) | NOT NULL | | | |
| 18 | `CREATE` | datetime | NULL | | `CURRENT_TIMESTAMP` / on update | |
| 19 | `CREATEBY` | int(9) | NULL | | `0` | |
| 20 | `PESERTA_DIDIK` | tinyint(4) | NULL | | `0` | |
| 21 | `STATUS` | tinyint(4) | NOT NULL | MUL | `1` | |

### 1.3 `master.pasien` (27 kolom)

| # | Kolom | Tipe | Null | Key | Default | Komentar |
|---|---|---|---|---|---|---|
| 1 | `NORM` | int(11) | NOT NULL | PRI | auto_increment | **Nomor Rekam Medis** |
| 2 | `NAMA` | varchar(75) | NOT NULL | MUL | | |
| 3 | `PANGGILAN` | varchar(15) | NULL | | | Nama Panggilan |
| 4 | `GELAR_DEPAN` | varchar(25) | NULL | MUL | | |
| 5 | `GELAR_BELAKANG` | varchar(35) | NULL | MUL | | |
| 6 | `TEMPAT_LAHIR` | varchar(35) | NULL | | | |
| 7 | `TANGGAL_LAHIR` | datetime | NULL | | | |
| 8 | `JENIS_KELAMIN` | tinyint(4) | NOT NULL | | `1` | |
| 9 | `ALAMAT` | varchar(150) | NULL | | | |
| 10 | `RT` | char(3) | NULL | | | |
| 11 | `RW` | char(3) | NULL | | | |
| 12 | `KODEPOS` | char(5) | NULL | | | |
| 13 | `WILAYAH` | char(10) | NULL | MUL | | |
| 14 | `AGAMA` | tinyint(4) | NULL | | | |
| 15 | `PENDIDIKAN` | tinyint(4) | NULL | | `1` | |
| 16 | `PEKERJAAN` | tinyint(4) | NULL | | `1` | |
| 17 | `STATUS_PERKAWINAN` | tinyint(4) | NULL | | `1` | |
| 18 | `GOLONGAN_DARAH` | tinyint(4) | NULL | MUL | | |
| 19 | `KEWARGANEGARAAN` | smallint(6) | NOT NULL | MUL | `71` | 71-Indonesia |
| 20 | `SUKUBANGSA` | smallint(6) | NULL | MUL | | |
| 21 | `BAHASA` | smallint(6) | NULL | | | |
| 22 | `LINGKUNGANKERJA` | smallint(6) | NULL | | | |
| 23 | `TUJUANPERIKSA` | smallint(6) | NULL | | | |
| 24 | `JENIS_PASIEN` | tinyint(1) | NULL | MUL | `1` | |
| 25 | `CEKNIK` | tinyint(1) | NULL | | `0` | Status pengecekan NIK dukcapil |
| 26 | `TANGGAL` | datetime | NOT NULL | | | Tanggal Pendaftaran |
| 27 | `STATUS` | tinyint(4) | NOT NULL | MUL | `1` | Status Pasien |

> Catatan: **tidak ada kolom NIK/KTP** di `master.pasien` (beda dengan `pegawai` yang punya
> `KTP`). Ada `CEKNIK` (flag pengecekan dukcapil) tapi nomornya sendiri tidak di sini.

### 1.4 `pendaftaran.pendaftaran` (8 kolom) — **tabel jembatan NOPEN↔NORM**

| # | Kolom | Tipe | Null | Key | Komentar |
|---|---|---|---|---|---|
| 1 | `NOMOR` | char(10) | NOT NULL | PRI | **format `yymmdd9999`** — inilah NOPEN |
| 2 | `NORM` | int(11) | NOT NULL | MUL | → `master.pasien.NORM` |
| 3 | `TANGGAL` | datetime | NOT NULL | MUL | |
| 4 | `DIAGNOSA_MASUK` | int(10) | NULL | MUL | Diagnosa Masuk |
| 5 | `RUJUKAN` | varchar(25) | NULL | MUL | |
| 6 | `PAKET` | smallint(6) | NULL | MUL | |
| 7 | `OLEH` | smallint(6) | NOT NULL | MUL | Pengguna / Pencatat / Petugas |
| 8 | `STATUS` | tinyint(4) | NOT NULL | MUL | 0 = Batal / Non Aktif, 1 = Aktif, 2 = selesai |

### 1.5 `pendaftaran.kunjungan` (10 kolom)

| # | Kolom | Tipe | Null | Key | Default | Komentar |
|---|---|---|---|---|---|---|
| 1 | `NOMOR` | char(19) | NOT NULL | PRI | | |
| 2 | `NOPEN` | char(10) | NOT NULL | MUL | | → `pendaftaran.pendaftaran.NOMOR` |
| 3 | `RUANGAN` | char(10) | NOT NULL | MUL | | → `master.ruangan.ID` |
| 4 | `MASUK` | datetime | NOT NULL | MUL | | |
| 5 | `KELUAR` | datetime | NULL | MUL | | NULL = masih berlangsung |
| 6 | `RUANG_KAMAR_TIDUR` | smallint(6) | NULL | MUL | | |
| 7 | `REF` | char(21) | NULL | MUL | | Ref. Konsul / Mutasi / Order dll |
| 8 | `DITERIMA_OLEH` | smallint(6) | NOT NULL | | | Petugas |
| 9 | `BARU` | tinyint(4) | NOT NULL | MUL | `0` | Status Kunjungan |
| 10 | `STATUS` | smallint(4) | NOT NULL | MUL | `1` | Status Aktifitas Kunjungan |

Index tambahan: `NOPEN_RUANGAN_MASUK` **UNIQUE** `(NOPEN, RUANGAN, MASUK)` — satu pasien
tidak bisa punya dua kunjungan ke ruangan yang sama pada detik yang sama.

### 1.6 `pendaftaran.penjamin` (5 kolom)

| # | Kolom | Tipe | Null | Key | Default | Komentar |
|---|---|---|---|---|---|---|
| 1 | `JENIS` | smallint(4) | NOT NULL | PRI | `0` | Jenis Kartu Asuransi. **Ref: `master.referensi`, jenis=10** |
| 2 | `NOPEN` | char(10) | NOT NULL | PRI | | → `pendaftaran.pendaftaran.NOMOR` |
| 3 | `NOMOR` | varchar(25) | NULL | MUL | `0` | nomor kartu asuransi |
| 4 | `KELAS` | tinyint(4) | NULL | MUL | `0` | 1 Kelas 3, 2 Kelas 2, 3 Kelas 1 |
| 5 | `INSTALASI` | char(10) | NULL | MUL | | |

PK komposit `(JENIS, NOPEN)` → **satu pendaftaran bisa punya beberapa penjamin**, satu baris
per jenis. Ada juga tabel terpisah `pendaftaran.penjamin_cob` (coordination of benefit).

> Perhatikan `KELAS`: nilainya **terbalik** dari intuisi (1 = Kelas 3, 3 = Kelas 1).

### 1.7 `pendaftaran.reservasi` (8 kolom)

| # | Kolom | Tipe | Null | Key | Default | Komentar |
|---|---|---|---|---|---|---|
| 1 | `NOMOR` | char(10) | NOT NULL | PRI | | |
| 2 | `TANGGAL` | datetime | NOT NULL | MUL | | |
| 3 | `RUANG_KAMAR_TIDUR` | smallint(6) | NOT NULL | MUL | | |
| 4 | `BERAKHIR` | datetime | NULL | | | Batas Reservasi jika belum melakukan pendaftaran |
| 5 | `ATAS_NAMA` | varchar(75) | NULL | | | Nama yang meminta reservasi |
| 6 | `KONTAK_INFO` | varchar(100) | NULL | | | Kontak Informasi |
| 7 | `OLEH` | smallint(6) | NOT NULL | | | Petugas yg melakukan reservasi |
| 8 | `STATUS` | tinyint(4) | NOT NULL | MUL | `1` | Status Reservasi |

> **Ini reservasi tempat tidur (rawat inap), bukan reservasi poliklinik/operasi.** Tidak ada
> kolom `NORM` maupun `DOKTER` — pasiennya cuma teks bebas di `ATAS_NAMA`.

### 1.8 `medicalrecord.operasi` (25 kolom) — laporan operasi (pasca-tindakan)

| # | Kolom | Tipe | Null | Key | Komentar |
|---|---|---|---|---|---|
| 1 | `ID` | int(11) | NOT NULL | PRI | auto_increment |
| 2 | `KUNJUNGAN` | char(19) | NOT NULL | MUL | → `pendaftaran.kunjungan.NOMOR` |
| 3 | `DOKTER` | smallint(6) | NOT NULL | | Dokter Operator → `master.dokter.ID` |
| 4 | `ASISTEN_DOKTER` | varchar(75) | NOT NULL | | Asisten Dokter Operator (**teks bebas**) |
| 5 | `ANASTESI` | smallint(6) | NOT NULL | | Dokter Anastesi → `master.dokter.ID` |
| 6 | `ASISTEN_ANASTESI` | varchar(75) | NOT NULL | | Asisten Dokter Anastesi / Perawat (teks bebas) |
| 7 | `JENIS_ANASTESI` | tinyint(4) | NOT NULL | | Jenis Anastesi (**Jenis Referensi=52**) |
| 8 | `GOLONGAN_OPERASI` | tinyint(4) | NOT NULL | | Golongan Operasi (**Jenis Referensi=53**) |
| 9 | `PRA_BEDAH` | varchar(50) | NOT NULL | | Diagnosa Pra Bedah (teks bebas, bukan ICD) |
| 10 | `PASCA_BEDAH` | varchar(50) | NOT NULL | | Diagnosa Pasca Bedah (teks bebas) |
| 11 | `INDIKASI` | varchar(50) | NOT NULL | | Indikasi Operasi |
| 12 | `NAMA_OPERASI` | varchar(50) | NOT NULL | | Nama Operasi |
| 13 | `PA` | tinyint(4) | NOT NULL | | Pemeriksaan PA (1=Ya, 2=Tidak) |
| 14 | `JARINGAN_DIEKSISI` | varchar(50) | NOT NULL | | Jaringan Yg Dieksisi |
| 15 | `TANGGAL` | date | NOT NULL | MUL | Tanggal Operasi |
| 16 | `WAKTU_MULAI` | time | NOT NULL | | |
| 17 | `WAKTU_SELESAI` | time | NOT NULL | | |
| 18 | `DURASI` | time | NOT NULL | | tersimpan, bukan dihitung |
| 19 | `KOMPLIKASI` | varchar(50) | NOT NULL | | |
| 20 | `PERDARAHAN` | varchar(15) | NOT NULL | | Jumlah Perdarahan (**teks**, bukan angka) |
| 21 | `RUANGAN_PASCA_OPERASI` | varchar(50) | NOT NULL | | Perawatan Pasca Operasi (teks bebas) |
| 22 | `LAPORAN_OPERASI` | text | NOT NULL | | Laporan Operasi (narasi) |
| 23 | `DIBUAT_TANGGAL` | datetime | NOT NULL | | |
| 24 | `OLEH` | smallint(6) | NOT NULL | | Dibuat Oleh |
| 25 | `STATUS` | tinyint(4) | NOT NULL | MUL | Status (default `1`) |

> Tidak ada kolom nullable sama sekali di tabel ini — semua `NOT NULL`, jadi field kosong
> kemungkinan diisi string kosong `''`, bukan NULL.

### 1.9 `perjanjian.penjadwalan_operasi` (27 kolom) — jadwal operasi (pra-tindakan)

| # | Kolom | Tipe | Null | Key | Default | Komentar |
|---|---|---|---|---|---|---|
| 1 | `id` | int(11) | NOT NULL | PRI | auto_increment | |
| 2 | `id_perjanjian` | int(11) | NULL | MUL | | **`remun_medis.perjanjian`** |
| 3 | `id_reservasi` | int(11) | NULL | MUL | | **`db_reservasi.tb_reservasi`** |
| 4 | `id_waiting_list_operasi` | int(11) | NULL | MUL | | → `medis.tb_waiting_list_operasi` |
| 5 | `kamar_operasi` | int(11) | NULL | MUL | | **`master.ruangan`** |
| 6 | `slot_operasi` | tinyint(2) | NULL | | `0` | |
| 7 | `tujuan_rs` | mediumint(7) | NULL | MUL | | |
| 8 | `tgl_rawat` | date | NULL | | | |
| 9 | `tgl_operasi` | date | NULL | | | |
| 10 | `waktu_operasi` | time | NULL | | | |
| 11 | `dr_anestesi` | int(11) | NULL | MUL | | |
| 12 | `jenis_anestesi` | int(11) | NULL | MUL | | |
| 13 | `durasi_operasi` | text | NULL | | | **bertipe `text`**, bukan time/int |
| 14 | `menunggu_konfirmasi_ruang` | int(11) | NULL | | | |
| 15 | `ruang_rawat` | varchar(10) | NULL | | | |
| 16 | `ruang_tunggu` | datetime | NULL | | | timestamp masuk ruang tunggu |
| 17 | `sedang_operasi` | datetime | NULL | | | timestamp mulai operasi |
| 18 | `ruang_observasi` | datetime | NULL | | | timestamp masuk observasi |
| 19 | `selesai_operasi` | datetime | NULL | | | timestamp selesai |
| 20 | `alasan_batal` | text | NULL | | | |
| 21 | `cancel_at` | datetime | NULL | | | |
| 22 | `cancel_by` | smallint(6) | NULL | MUL | | |
| 23 | `created_at` | datetime | NULL | | `CURRENT_TIMESTAMP` | |
| 24 | `updated_by` | smallint(6) | NULL | MUL | | |
| 25 | `updated_at` | timestamp | NULL | | `CURRENT_TIMESTAMP` / on update | |
| 26 | `status` | tinyint(1) | NULL | | `1` | **0=batal, 1=menunggu masuk, 2=ruang tunggu, 3=sedang op, 4=ruang observasi, 5=selesai op** |
| 27 | `created_by` | smallint(6) | NULL | MUL | | |

> Komentar pada kolom 2, 3, 5 (`remun_medis.perjanjian`, `db_reservasi.tb_reservasi`,
> `master.ruangan`) ditulis langsung oleh pembuat tabel sebagai `COLUMN_COMMENT` — itu
> dokumentasi relasi yang paling dekat ke "resmi" yang ada di skema ini.
>
> **Tabel ini tidak punya `NORM` maupun `NOPEN`.** Pasiennya hanya bisa dicapai lewat
> `id_perjanjian` → `remun_medis.perjanjian.NOMR`.

---

## 2. Relasi antar tabel

### 2.1 Foreign key yang benar-benar dideklarasikan di DB

Hanya **6 FK di seluruh server** yang menyentuh 4 skema ini, dan tidak satu pun berasal
dari tabel target:

| Dari | Ke | Catatan |
|---|---|---|
| `medis.tb_pendaftaran_operasi.nokun` | `pendaftaran.kunjungan.NOMOR` | **penting** — membuktikan pola join `char(19)` ke kunjungan |
| `medis.tb_asisten_pendaftaran_operasi.asisten_bedah` | `master.dokter.ID` | membuktikan kolom dokter memang ID numerik |
| `master.level_slide_imuno.KATEGORI_IMUNO` | `master.kategori_imuno.ID` | tidak relevan (patologi) |
| `master.level_slide_sitologi.KATEGORI_SITOLOGI` | `master.kategori_sitologi.ID` | tidak relevan |
| `master.level_slide_sitologi.LEVEL_KATEGORI` | `master.level_kategori_sitologi.ID` | tidak relevan |
| `perjanjian.perjanjian_anyelir.jadwalId` | `perjanjian.jadwal_anyelir.id` | modul terpisah (TypeORM) |

### 2.2 Relasi berdasarkan konvensi (tidak dijamin DB)

Tingkat keyakinan: **tinggi** = nama + tipe cocok persis dan ada index pendukung;
**sedang** = nama cocok tapi tipe berbeda atau tidak diverifikasi.

| # | Dari | Ke | Yakin | Dasar |
|---|---|---|---|---|
| R1 | `master.dokter.NIP` varchar(30) | `master.pegawai.NIP` varchar(30) | tinggi | tipe identik, PK di sisi pegawai, index `NIP` di dokter |
| R2 | `pendaftaran.pendaftaran.NORM` int(11) | `master.pasien.NORM` int(11) | tinggi | tipe identik, PK di pasien |
| R3 | `pendaftaran.kunjungan.NOPEN` char(10) | `pendaftaran.pendaftaran.NOMOR` char(10) | tinggi | tipe identik, index `NOPEN` |
| R4 | `pendaftaran.penjamin.NOPEN` char(10) | `pendaftaran.pendaftaran.NOMOR` char(10) | tinggi | tipe identik, bagian PK |
| R5 | `pendaftaran.kunjungan.RUANGAN` char(10) | `master.ruangan.ID` char(10) | tinggi | tipe identik, PK di ruangan |
| R6 | `medicalrecord.operasi.KUNJUNGAN` char(19) | `pendaftaran.kunjungan.NOMOR` char(19) | tinggi | tipe identik + preseden FK `medis.tb_pendaftaran_operasi` |
| R7 | `medicalrecord.operasi.DOKTER` smallint(6) | `master.dokter.ID` smallint(6) | tinggi | tipe identik + preseden FK `tb_asisten_pendaftaran_operasi` |
| R8 | `medicalrecord.operasi.ANASTESI` smallint(6) | `master.dokter.ID` smallint(6) | tinggi | sama seperti R7 |
| R9 | `pendaftaran.dpjp_bersama.{NOPEN,KUNJUNGAN,DOKTER}` | `pendaftaran.pendaftaran.NOMOR` / `kunjungan.NOMOR` / `master.dokter.ID` | tinggi | tipe cocok semua |
| R10 | `pendaftaran.dpjp_diagnosa.NOMR` int(11) | `master.pasien.NORM` int(11) | tinggi | penamaan `NOMR` (varian dari NORM) |
| R11 | `perjanjian.penjadwalan_operasi.id_perjanjian` | `remun_medis.perjanjian.ID` int(11) | tinggi | ditulis di `COLUMN_COMMENT`; tabel ada; tipe cocok |
| R12 | `remun_medis.perjanjian.NOMR` int(11) | `master.pasien.NORM` int(11) | tinggi | penamaan + tipe |
| R13 | `perjanjian.penjadwalan_operasi.id_reservasi` | `db_reservasi.tb_reservasi` | sedang | ditulis di komentar; tabel ada; kolom PK belum diverifikasi |
| R14 | `perjanjian.penjadwalan_operasi.id_waiting_list_operasi` | `medis.tb_waiting_list_operasi` | sedang | nama cocok; tabelnya di skema `medis`, bukan `perjanjian` |
| R15 | `perjanjian.penjadwalan_operasi.kamar_operasi` int(11) | `master.ruangan.ID` **char(10)** | **rendah** | komentar bilang `master.ruangan`, **tapi tipe tidak cocok** (int vs char) |
| R16 | `perjanjian.penjadwalan_operasi.dr_anestesi` int(11) | `master.dokter.ID` **smallint(6)** | sedang | nama jelas, tapi tipe lebih lebar dari PK-nya |
| R17 | `perjanjian.penjadwalan_operasi.{created_by,updated_by,cancel_by}` smallint(6) | tabel pengguna/pegawai (belum dipetakan) | sedang | tipe = smallint(6), sama seperti kolom `OLEH` di mana-mana |
| R18 | `pendaftaran.penjamin.JENIS` | `master.referensi` (jenis=10) | tinggi | ditulis eksplisit di `COLUMN_COMMENT` |
| R19 | `medicalrecord.operasi.JENIS_ANASTESI` | `master.referensi` (jenis=52) | tinggi | `COLUMN_COMMENT` |
| R20 | `medicalrecord.operasi.GOLONGAN_OPERASI` | `master.referensi` (jenis=53) | tinggi | `COLUMN_COMMENT` |

### 2.3 Jalur join kunci (rantai lengkap)

**Dari kunjungan ke pasien** (rantai wajib, tidak ada shortcut):

```
pendaftaran.kunjungan.NOPEN
  → pendaftaran.pendaftaran.NOMOR   (char(10), format yymmdd9999)
      → pendaftaran.pendaftaran.NORM
          → master.pasien.NORM
```

**Dari laporan operasi ke pasien:**

```
medicalrecord.operasi.KUNJUNGAN
  → pendaftaran.kunjungan.NOMOR (char(19))
      → [rantai di atas] → master.pasien
```

**Dari dokter ke identitasnya:**

```
master.dokter.ID  (dipakai semua kolom DOKTER/ANASTESI di modul lain)
master.dokter.NIP → master.pegawai.NIP → NAMA, GELAR_DEPAN, GELAR_BELAKANG, SMF
```

**Dari jadwal operasi ke pasien** (lewat skema lain, tidak lewat `pendaftaran`):

```
perjanjian.penjadwalan_operasi.id_perjanjian
  → remun_medis.perjanjian.ID
      → remun_medis.perjanjian.NOMR → master.pasien.NORM
      → remun_medis.perjanjian.ID_DOKTER
```

### 2.4 Tabel jembatan NOPEN↔NORM — hasil scan lengkap

Query: `information_schema.columns WHERE table_schema='pendaftaran' AND column_name IN ('NORM','NOPEN')`
→ 13 baris di 11 tabel.

| Tabel | Punya NORM | Punya NOPEN | Tipe NOPEN | Peran |
|---|---|---|---|---|
| `pendaftaran.pendaftaran` | ✅ int(11) | — (namanya `NOMOR`) | char(10) | **jembatan utama** |
| `pendaftaran.surat_rujukan_pasien` | ✅ int(11) PRI | ✅ char(15) PRI | char(15) | jembatan kedua, PK komposit |
| `pendaftaran.kunjungan` | — | ✅ MUL | char(10) | |
| `pendaftaran.penjamin` | — | ✅ PRI | char(10) | |
| `pendaftaran.penjamin_cob` | — | ✅ PRI | char(10) | |
| `pendaftaran.tujuan_pasien` | — | ✅ PRI | char(10) | |
| `pendaftaran.dpjp_bersama` | — | ✅ MUL | char(10) | DPJP bersama |
| `pendaftaran.dpjp_diagnosa` | ✅ (`NOMR`) | ✅ MUL | char(10) | diagnosa + ICD10 |
| `pendaftaran.dpjp_pendamping` | — | ✅ MUL | char(10) | DPJP pendamping |
| `pendaftaran.penanggung_jawab_pasien` | — | ✅ MUL | char(10) | |
| `pendaftaran.order_drivethru` | — | ✅ PRI | **char(15)** | |
| `pendaftaran.perawat_pasien_ranap` | — | ✅ (no index) | **char(15)** | |

> ⚠️ **NOPEN punya dua lebar berbeda:** `char(10)` di mayoritas tabel, tapi `char(15)` di
> `order_drivethru`, `perawat_pasien_ranap`, dan `surat_rujukan_pasien`. Join lintas dua
> kelompok ini akan kena padding/perbandingan string yang tidak nyaman.

### 2.5 Bonus: tabel DPJP (relasi dokter ↔ pasien yang sebenarnya)

Ditemukan tidak sengaja lewat scan NOPEN. **Ini yang paling dekat dengan konsep
`DokterPasienAssignment` di SIDOKMAIS** — tapi berbasis kunjungan, bukan penugasan permanen.

- **`pendaftaran.dpjp_bersama`** — `ID`, `NOPEN`, `KUNJUNGAN` char(19), `DOKTER` smallint(6),
  `TANGGAL_AWAL`, `TANGGAL_AKHIR`, `OLEH`, `STATUS`
- **`pendaftaran.dpjp_pendamping`** — `ID`, `NOPEN`, `NOKUN` **char(20)**, `DOKTER` smallint(5),
  `TANGGAL`, `OLEH`, `STATUS`
- **`pendaftaran.dpjp_diagnosa`** — `ID`, `NOMR`, `NOPEN`, `KUNJUNGAN`, **`ICD10` varchar(50)**,
  `DIAGNOSA` varchar(150), `KATEGORI_DIAGNOSA` (1=primer, 2=sekunder), `CREATED_AT`,
  `UPDATED_AT`, `OLEH`, `UPDATE_OLEH`, `STATUS`

> Tiga inkonsistensi langsung terlihat: kolom kunjungan bernama `KUNJUNGAN` di dua tabel tapi
> `NOKUN` di satu; tipenya `char(19)` vs **`char(20)`**; dan `DOKTER` `smallint(6)` vs
> `smallint(5)`. Belum ketemu tabel DPJP **utama** (yang non-bersama, non-pendamping) —
> mungkin namanya tidak mengandung `NOPEN`/`NORM`, atau ada di skema lain.

---

## 3. Ringkasan struktural untuk pemetaan ke SIDOKMAIS

| Entitas SIDOKMAIS | Kandidat sumber SIMRS | Catatan |
|---|---|---|
| `Dokter` | `master.dokter` + `master.pegawai` (join NIP) | wajib 2 tabel; nama ada di pegawai |
| `Pasien` | `master.pasien` | `NORM` = No. RM; tidak ada NIK |
| `Ruangan` | `master.ruangan` | `ID` char(10); `JENIS_KUNJUNGAN` 2=IGD, 3=Ranap, 15=Tower C |
| `Kunjungan` | `pendaftaran.kunjungan` (+ `pendaftaran.pendaftaran` untuk NORM) | butuh join jembatan |
| `DokterPasienAssignment` | `pendaftaran.dpjp_*` | per-kunjungan, bukan penugasan tetap — **beda semantik** |
| `Operasi` (jadwal) | `perjanjian.penjadwalan_operasi` | tidak ada NORM langsung |
| `Operasi` (laporan) | `medicalrecord.operasi` | pasca-tindakan |
| `Penjamin` | `pendaftaran.penjamin` | multi-baris per NOPEN; `KELAS` terbalik |
| `PemeriksaanLab` | `layanan.order_lab` → `layanan.order_detil_lab` → `layanan.hasil_lab` | dipetakan 24 Ags 2026 — lihat §5. Tebakan awal (`lis*`) **keliru** |
| `HasilLabItem` | `layanan.hasil_lab` + `master.parameter_tindakan_lab` | `HASIL` = nilai ukur, `NILAI` = rentang rujukan — **jangan tertukar** |
| `Pendapatan` | **belum dipetakan** — kandidat `keuangan`, `db_keuangan`, `remunerasi` | di luar scope |
| `Notifikasi` | tidak ada padanan | murni fitur SIDOKMAIS |

---

## 4. Hal yang masih ambigu — perlu dikonfirmasi ke Mas Fauzi (DBA SIMRS)

### Prioritas tinggi (memblokir desain integrasi)

1. **Mana sumber kebenaran untuk "operasi"?** Ada minimal **tiga** tabel dengan peran berbeda,
   dan saya belum bisa memastikan mana yang dipakai aplikasi produksi:
   - `perjanjian.penjadwalan_operasi` — jadwal + status alur (menunggu → ruang tunggu → sedang
     op → observasi → selesai)
   - `medicalrecord.operasi` — laporan pasca-tindakan (diagnosa, durasi, narasi)
   - `medis.tb_pendaftaran_operasi` — pendaftaran operasi, **satu-satunya yang punya FK asli**
     ke `pendaftaran.kunjungan`

   Untuk fitur "Jadwal Operasi" di aplikasi dokter, yang mana yang harus dibaca? Apakah
   ketiganya terhubung satu sama lain, dan lewat kolom apa?

   **Sebagian terjawab 21 Ags 2026:** ada tabel keempat yang ternyata jadi hub —
   **`medis.tb_waiting_list_operasi`**. Tabel itu satu-satunya yang memuat `norm`, `nokun`,
   `id_dokter`, `tindakan`, dan `tanggal` sekaligus, plus `id_pendaftaran_operasi` dan
   `id_laporan_operasi` yang menautkannya ke dua tabel lain. Backend memakainya sebagai
   dasar modul Operasi, dengan `medis.tb_pendaftaran_operasi` (jam, ruang tujuan) dan
   `perjanjian.penjadwalan_operasi` (status alur 0–5) sebagai LEFT JOIN pelengkap.
   **Pertanyaan yang tersisa:** apakah itu memang urutan yang dipakai produksi, dan apa
   arti kode `tb_waiting_list_operasi.status` tinyint(1) yang tidak berkomentar — saat ini
   tidak dipakai sama sekali, pembatalan dideteksi lewat `alasan_batal` yang terisi.

2. **Bagaimana cara benar mendapatkan pasien dari `perjanjian.penjadwalan_operasi`?**
   Tabel ini tidak punya `NORM` maupun `NOPEN`. Dugaan saya rantainya lewat
   `id_perjanjian` → `remun_medis.perjanjian.NOMR`. Betul? Kalau `id_perjanjian` NULL
   (kolomnya nullable), pasiennya diambil dari mana — dari `id_waiting_list_operasi`?

3. **`penjadwalan_operasi.kamar_operasi` bertipe `int(11)`, tapi komentarnya menunjuk
   `master.ruangan` yang PK-nya `char(10)`.** Tipe ini tidak cocok. Apakah komentarnya sudah
   usang, atau ada tabel kamar operasi terpisah yang ber-ID numerik?

4. ~~**Siapa DPJP utama seorang pasien?**~~ — **TERJAWAB 21 Ags 2026** (saat implementasi
   integrasi). DPJP utama ada di **`pendaftaran.tujuan_pasien.DOKTER`** (smallint(6),
   ber-index). PK tabelnya `NOPEN`, jadi tepat satu dokter tujuan per pendaftaran.
   Tabel itu juga memuat `SMF`, `RUANGAN`, dan `DOKTER_PENGIRIM`.

   Scoping akses dokter→pasien di backend sekarang memakai gabungan tiga sumber:
   `tujuan_pasien.DOKTER` ∪ `dpjp_bersama.DOKTER` ∪ `dpjp_pendamping.DOKTER`
   (lihat `backend/src/utils/simrsAkses.js`). **Yang masih perlu dikonfirmasi:** apakah
   ketiganya memang himpunan yang benar untuk "dokter ini berhak melihat pasien ini",
   atau ada sumber keempat yang terlewat.

### Prioritas sedang (memengaruhi query & kebenaran data)

5. **Arti kode `STATUS`.** Beberapa tabel punya komentar (`pendaftaran.pendaftaran`:
   0=batal, 1=aktif, 2=selesai; `penjadwalan_operasi`: 0–5), tapi
   `pendaftaran.kunjungan.STATUS` bertipe `smallint(4)` **tanpa komentar** — nilainya jelas
   lebih dari 3 kemungkinan. Adakah dokumentasi/tabel referensi untuk status kunjungan?
   Sama untuk `master.pasien.STATUS`, `master.dokter.STATUS`, `medicalrecord.operasi.STATUS`.

6. **`master.referensi` sebagai tabel lookup universal.** Komentar kolom menyebut
   "Jenis Referensi=52", "jenis=10", "jenis=53", "ref jenis=125". Apakah ada daftar lengkap
   nomor jenis referensi? Ini dibutuhkan untuk menerjemahkan hampir semua kolom `tinyint`
   (agama, pendidikan, pekerjaan, golongan darah, jenis anestesi, dst).

7. **`NOPEN` punya dua lebar: `char(10)` dan `char(15)`.** Yang mana yang benar untuk data
   baru? Apakah `char(15)` adalah format lama/baru, atau memang beda jenis nomor?

8. **`pendaftaran.reservasi` sepertinya bukan reservasi poliklinik.** Isinya
   `RUANG_KAMAR_TIDUR` + `ATAS_NAMA` (teks bebas, tanpa `NORM`), jadi dugaan saya ini
   reservasi **tempat tidur rawat inap**. Betul? Kalau iya, reservasi poliklinik/perjanjian
   dokter ada di tabel mana — `remun_medis.perjanjian`?

9. **`db_reservasi.tb_reservasi` vs `pendaftaran.reservasi`** — dua tabel reservasi di dua
   skema berbeda. Mana yang aktif dipakai? `penjadwalan_operasi.id_reservasi` (int) menunjuk
   ke yang `db_reservasi`, sementara `pendaftaran.reservasi.NOMOR` bertipe char(10) — jadi
   keduanya memang beda hal, bukan duplikat?

### Prioritas rendah (kebersihan data / good to know)

10. **Tidak ada foreign key sama sekali** di 8 tabel target. Ini disengaja (alasan performa
    replikasi / warisan MyISAM), atau memang belum sempat ditambahkan? Saya bertanya karena
    ini menentukan seberapa defensif aplikasi harus menangani referensi yatim (orphan).

11. **Semua kolom di `medicalrecord.operasi` `NOT NULL`, tanpa default.** Apakah field yang
    tidak diisi tersimpan sebagai string kosong `''`? Kalau iya, aplikasi harus memperlakukan
    `''` sebagai "tidak ada data", bukan NULL.

12. **`penjadwalan_operasi.durasi_operasi` bertipe `text`.** Formatnya apa — "2 jam",
    "120", "02:00:00"? Ini memengaruhi bisa/tidaknya dihitung.

13. **`master.pasien` tidak punya kolom NIK**, padahal ada flag `CEKNIK` (status pengecekan
    dukcapil). Di mana NIK pasien disimpan?

14. **Inkonsistensi penamaan `NORM` vs `NOMR`** (`dpjp_diagnosa.NOMR`, `remun_medis.perjanjian.NOMR`).
    Keduanya nomor rekam medis yang sama, kan? Tidak ada perbedaan semantik?

15. **`master.dokter.HAFIS`** — kolom int(9) default 0, tanpa komentar, tapi ada index-nya.
    Ini merujuk ke sistem apa?

16. **Apakah replika ini lag dari produksi?** Kalau nanti SIDOKMAIS baca dari sini, berapa
    delay yang harus diasumsikan?

### Pertanyaan baru dari implementasi integrasi (21 Ags 2026)

17. **Konsul ke SMF tidak terlihat siapa pun.** `medis.tb_konsul.tujuan` bernilai
    "1: Dokter, 2: SMF". Aplikasi menyaring lewat `dokter_tujuan`, jadi konsul yang
    dialamatkan ke SMF (bukan ke dokter tertentu) tidak muncul untuk siapa pun. Apakah
    konsul jenis itu dipakai di praktik, dan kalau iya siapa yang seharusnya melihatnya —
    semua dokter di SMF tersebut?

18. **`medis.tb_konsul` vs `pendaftaran.konsul`.** Keduanya lembar konsul, di dua skema.
    Yang dipakai backend adalah `medis.tb_konsul` karena `pendaftaran.konsul` tidak punya
    kolom `dokter_tujuan` sama sekali (`TUJUAN`-nya char(10) = ruangan). Betul bahwa
    `pendaftaran.konsul` sudah tidak dipakai lagi? Ada juga `medis.tb_konsul_21062026`
    yang tampak seperti cadangan bertanggal.

19. **`ikhtisar_klinis` satu blok teks.** Model SIDOKMAIS memecah ikhtisar klinis jadi
    field bernama (kesadaran, tekanan darah, nadi, napas, suhu, TB, BB, nyeri), sementara
    SIMRS menyimpannya sebagai satu `text` bebas. Apakah ada format baku isinya, atau
    memang diketik bebas? Kalau baku, bisa di-parse; kalau tidak, kedelapan field itu
    akan permanen kosong di mode SIMRS.

20. **Kode SMF/spesialisasi.** `master.pegawai.SMF` mediumint(7) — tabel referensinya yang
    mana? Saat ini `spesialisasi` dikirim null ke frontend daripada memancarkan angka.
    Sama untuk `master.pasien.GOLONGAN_DARAH`.

21. **Jenis kelamin 1=L / 2=P.** Dipakai sebagai asumsi di
    `backend/src/utils/simrsBentuk.js` berdasarkan konvensi umum SIMRS dan default kolom
    (`JENIS_KELAMIN` default 1), **belum diverifikasi ke `master.referensi`**. Ini satu-satunya
    tebakan yang tersisa di jalur data; kode selain 1/2 sengaja jadi null. Mohon konfirmasi.

### Pertanyaan baru dari integrasi modul Lab (24 Ags 2026)

22. **4,8% hasil lab tidak punya order yang cocok.** Dalam sampel satu hari, 61 dari 1.268
    grup `(hasil_lab.TINDAKAN_MEDIS, parameter_tindakan_lab.TINDAKAN)` tidak menemukan
    baris `order_detil_lab` dengan `REF`+`TINDAKAN` yang sama. Dugaan saya lab menambah
    atau mengganti tindakan setelah order dibuat, dan perubahan itu tidak ditulis balik ke
    `order_detil_lab`. Kalau benar, hasil-hasil itu tidak akan pernah tampil di SIDOKMAIS.
    Apakah ada jalur lain yang seharusnya dipakai untuk kasus ini?

23. **`order_lab.STATUS` tinyint(4), 3 nilai berbeda, tanpa komentar.** Belum dipakai —
    "sudah ada hasil" diturunkan dari keberadaan baris `hasil_lab`. Kalau kode statusnya
    punya arti resmi (mis. 0=batal), lebih baik dipakai langsung daripada disimpulkan.

24. **51 order bertanggal di masa depan**, satu bertahun 2027. Apakah ini salah entri yang
    perlu dilaporkan, atau ada makna lain (mis. order terjadwal)?

25. **Kategori lab kosong untuk 16% pemeriksaan** — tindakan yang tidak terdaftar di
    `master.group_tindakan_lab`. Apakah ada tabel pengelompokan lain, atau memang ada
    tindakan yang tidak berkategori?

---

## 5. Modul Lab — skema `layanan` (dipetakan 24 Ags 2026)

Skema `layanan` sama sekali tidak muncul di §1–§4 dokumen ini; pemetaan awal berhenti
di `master`, `pendaftaran`, `medis`, dan `perjanjian`. Di situlah data lab sebenarnya
berada.

### 5.1 Tebakan awal yang keliru

§3 sebelumnya menunjuk `lis` / `lis_bridging` / `lis_bu`. Ketiganya memang ada dan jauh
lebih besar (`lis.hasil_log` 23.497.622 baris), tapi isinya **jembatan mentah dari alat
analyzer** — `LIS_KODE_TEST`, `LIS_NAMA_INSTRUMENT`, `VENDOR_LIS`, tanpa kaitan langsung
ke kunjungan maupun dokter peminta. Yang dipakai SIMRS sendiri ada di `layanan`.

### 5.2 Rantai tabel

| Tabel | Baris | Peran |
|---|---|---|
| `layanan.order_lab` | 613.293 | header permintaan: `NOMOR` char(21), `KUNJUNGAN` char(19), `TANGGAL`, `DOKTER_ASAL` smallint, `TUJUAN` char(10), `ALASAN` |
| `layanan.order_detil_lab` | 2.161.273 | satu baris per tindakan: `ORDER_ID` → `order_lab.NOMOR`, `TINDAKAN` smallint, `REF` char(11) |
| `layanan.hasil_lab` | 4.204.357 | satu baris per parameter: `TINDAKAN_MEDIS` → `order_detil_lab.REF`, `PARAMETER_TINDAKAN` → `master.parameter_tindakan_lab.ID` |

Tabel referensi: `master.tindakan` (nama pemeriksaan, cocok 100%),
`master.group_lab` + `master.group_tindakan_lab` (kategori),
`master.parameter_tindakan_lab` (nama parameter, `NILAI_RUJUKAN`, `INDEKS` = urutan),
`master.ruangan` (nama laboratorium).

### 5.3 Grain: satu pemeriksaan = `(ORDER_ID, TINDAKAN)`, bukan `REF`

`REF` bukan kunci unik per pemeriksaan — satu `REF` bisa dipakai beberapa `TINDAKAN`
dalam order yang sama (14.029 baris detil → 9.990 `REF` unik dalam sampel 4 hari).
Memisahkan hasil per pemeriksaan **wajib** memakai `parameter_tindakan_lab.TINDAKAN`
sebagai penyaring kedua; tanpa itu parameter dari dua pemeriksaan berbeda tercampur
jadi satu daftar.

Sebaliknya `REF` praktis unik lintas-order: dari 9.990 `REF`, hanya **1** yang muncul di
lebih dari satu `ORDER_ID`.

### 5.4 Hal yang tidak terlihat dari skema

Semuanya diukur dari data Agustus 2026, bukan diasumsikan:

- **`HASIL` dan `NILAI` berlawanan dengan intuisi nama kolomnya.** `HASIL` rata-rata 3,5
  karakter dan mayoritas angka murni → nilai ukur. `NILAI` rata-rata 6,9 karakter dan
  mayoritas memuat `-` → rentang rujukan. Tertukar di sini tidak memicu error apa pun.
- **`LIS_FLAG` kosong di 67% item** (116.260 dari 172.491). Nilai yang ada hanya `''`,
  `L`, `H`, `VL`, `VH` — tidak ada padanan untuk `ABNORMAL`. Hasil non-numerik (kultur,
  deskripsi) memang tidak pernah berflag, jadi `adaFlagAbnormal` di mode SIMRS lebih
  konservatif daripada mode dummy.
- **`KETERANGAN` sampah.** Terisi 99,998% tapi rata-rata panjang 1,09 karakter — hampir
  semuanya `-`. Pola yang sama dengan `master.diagnosa_masuk`; tidak dipakai.
- **`order_detil_lab.DESKRIPSI` kosong** di 14.020 dari 14.029 baris. Nama pemeriksaan
  harus dari `master.tindakan`, bukan dari kolom ini.
- **51 order bertanggal di masa depan** (dari 174.995 baris 2026), satu di antaranya
  bertahun 2027 — salah ketik entri. Karena daftar diurutkan menurun, baris rusak itu
  selalu muncul paling atas kalau tidak disaring `TANGGAL <= NOW()`.
- **Kategori terisi 84%** menurut volume (58% menurut tindakan unik). Sisanya null.
- **4,8% hasil yatim**: dalam sampel satu hari, 61 dari 1.268 grup `(REF, TINDAKAN)`
  tidak punya baris `order_detil_lab` yang cocok, jadi tidak akan tampil di aplikasi.
  Dugaan: lab menambah/mengganti tindakan setelah order dibuat. **Pertanyaan terbuka
  ke DBA** — lihat §4.
- Ketiga laboratorium tujuan: `105070101` Lab Patologi Klinik (16.903 order/bulan),
  `105080101` Lab Patologi Anatomi (1.134), `105070118` Lab PK Gedung C (3).

### 5.5 Scoping

`order_lab.DOKTER_ASAL` terisi **100%** (0 kosong dari 18.040 order sebulan) dan tipenya
`smallint(6)`, sama persis dengan `master.dokter.ID`. Meski begitu, route memakai
`dokterPunyaAksesPasien()` yang sama dengan modul lain — dokter yang menangani pasien
berhak melihat seluruh lab pasien itu, bukan hanya yang dia sendiri minta. `DOKTER_ASAL`
dipakai untuk menampilkan siapa pemintanya, bukan untuk membatasi akses.

---

## Lampiran — cara data ini dikumpulkan

Semua query dijalankan lewat `q.js` di folder ini, yang menolak statement selain
`SELECT`/`SHOW`/`DESCRIBE`. Query yang dijalankan, seluruhnya:

1. `SELECT 1` — tes koneksi
2. `SHOW GRANTS FOR CURRENT_USER()` — verifikasi read-only
3. `information_schema.schemata` — daftar skema
4. `information_schema.columns` — metadata kolom (tabel target, tabel jembatan, `master.ruangan`, `dpjp_*`, `remun_medis.perjanjian`)
5. `information_schema.key_column_usage` — foreign key
6. `information_schema.statistics` — index
7. `information_schema.tables` — verifikasi keberadaan tabel lintas skema

Hasil mentah tersimpan di `raw/*.json` (metadata skema saja — **tidak ada baris data pasien**).
