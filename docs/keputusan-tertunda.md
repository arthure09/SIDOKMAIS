# Keputusan Tertunda — SIDOKMAIS

Daftar hal yang **sengaja belum dikerjakan**, beserta alasan, pemicu, dan
targetnya. Tujuannya memisahkan dengan jelas mana yang "belum dikerjakan"
(terlupa, utang teknis tanpa rencana) dari yang "sengaja ditunda" (keputusan
sadar, ada alasan dan pemicunya).

Aturan pakai: kalau sesuatu diputuskan untuk tidak dikerjakan sekarang, ia
masuk ke sini dengan **pemicu** yang jelas — apa yang harus terjadi supaya
item ini bisa dilanjutkan. Item yang sudah selesai dihapus dari daftar ini,
bukan dibiarkan menumpuk.

---

## Ringkasan

| Item | Alasan ditunda | Menunggu apa |
|---|---|---|
| Perbandingan nilai lab dengan hasil sebelumnya | Mengubah bentuk response endpoint, bukan cuma tampilan | Keputusan kebijakan data klinis |
| Tombol cetak/bagikan hasil lab | Kebijakan data belum jelas (rekam medis keluar dari aplikasi) | Keputusan kebijakan data klinis |
| Integrasi berkas PDF hasil lab asli dari SIMRS | Sumber berkas (lokasi & cara akses) belum diketahui | Konfirmasi pengelola SIMRS |
| Push notification jarak jauh (remote push) | Expo Go tidak mendukung remote push sejak SDK 53; butuh development build | Slot waktu untuk setup EAS Build |
| Indikator mode Admin di UI | Akun demo ADMIN melihat data semua dokter tanpa penanda visual — berpotensi disalahpahami | — |
| Audit log untuk trigger notifikasi `PERUBAHAN_JADWAL` | Notifikasi otomatis dari `PATCH /api/operasi/:id` tidak tercatat ke `AuditLog` | Keputusan desain: butuh baris audit sendiri atau cukup ter-cover baris `UPDATE Operasi` |
| Jadwal poliklinik mendatang (besok dst.) | Butuh sumber data kedua dengan makna beda (janji temu vs kedatangan aktual) | Konfirmasi tabel janji temu yang berlaku di SIMRS |

---

## Rincian

### 1. Perbandingan nilai lab dengan hasil sebelumnya

Menampilkan nilai pemeriksaan sekarang berdampingan dengan hasil sebelumnya
(misalnya Hemoglobin bulan ini dibanding bulan lalu, dengan penanda
naik/turun). Untuk pasien onkologi yang dipantau rutin, tren nilai sering
lebih informatif daripada nilai tunggal.

Ditunda karena ini mengubah **bentuk data yang dikirim endpoint** — setiap
parameter perlu membawa nilai pembandingnya. Lebih murah diputuskan sebelum
endpoint-nya dipakai luas daripada membongkarnya belakangan.

### 2. Tombol cetak / bagikan hasil lab

Secara teknis mudah — mengunduh/membagikan berkas dari aplikasi mobile bukan
pekerjaan besar. Yang belum jelas adalah **kebijakannya**: apakah hasil lab
pasien boleh keluar dari aplikasi ke penyimpanan pribadi perangkat dokter,
mengingat ini data rekam medis.

Ini bukan keputusan teknis murni, jadi tombolnya tidak dibuat sama sekali —
bukan dibuat lalu dinonaktifkan. Tombol yang ada tapi mati mengundang
pertanyaan "kapan jalan?", sedangkan tombol yang tidak ada tidak menjanjikan
apa pun.

### 3. Integrasi berkas PDF hasil lab asli dari SIMRS

Kalau SIMRS menyimpan hasil lab sebagai berkas dokumen (PDF/scan), aplikasi
perlu bisa menampilkan berkas itu, bukan cuma nilai per parameter. Belum bisa
dimulai karena sumber berkasnya belum diketahui: di mana disimpan, dan
bagaimana aplikasi lain mengaksesnya.

### 4. Push notification jarak jauh (remote push)

Notifikasi di dalam aplikasi sudah jalan (tersambung ke backend, sudah
dites) — tapi itu polling foreground + `expo-notifications` untuk
menampilkan ke tray HP saat aplikasi terbuka (lihat
`frontend/src/hooks/useNotifikasiHp.ts`), **bukan** notifikasi yang muncul
saat aplikasi tertutup/di-background lama.

Hambatannya bukan kode: **Expo Go tidak mendukung remote push notification
sejak SDK 53**, jadi butuh *development build* (versi aplikasi yang
dikompilasi sendiri, bukan dijalankan lewat Expo Go). Menyiapkan build itu
(EAS Build, kredensial push, instalasi ke perangkat) sebanding effort-nya
dengan satu fitur utuh.

### 5. Indikator mode Admin di tampilan

Akun ADMIN bisa melihat data seluruh dokter, bukan hanya satu dokter — tidak
ada penanda apa pun soal itu di tampilan saat ini.

Risikonya spesifik: orang yang melihat bisa mengira seorang dokter bisa
melihat pasien dokter lain, padahal pembatasan per dokter memang sudah
berjalan dan sudah dites (identitas dokter selalu diambil dari token login
di sisi server, tidak pernah dari permintaan aplikasi). Salah paham ini
menyerang justru bagian yang paling hati-hati dikerjakan.

Rencana perbaikan: penanda kecil di tampilan saat akun yang login berperan
ADMIN (mis. label "Mode Admin — menampilkan data seluruh dokter" di header).
Perubahan tampilan saja, tidak menyentuh backend maupun logika hak akses.

### 6. Audit log untuk trigger notifikasi `PERUBAHAN_JADWAL`

`PATCH /api/operasi/:id` yang mengubah jadwal memicu `prisma.notifikasi.create()`
(`backend/src/routes/dummy/operasi.routes.js`, fungsi
`buildPerubahanJadwalPesan`) untuk bikin notifikasi `PERUBAHAN_JADWAL` ke
dokter pemilik kunjungan, tapi write ini tidak dipanggil lewat `logAudit()`.
Notifikasinya beneran terbentuk di DB, sementara nol baris `AuditLog` untuk
`entityType: "Notifikasi"` dengan `entityId` itu.

Secara harfiah ini melanggar aturan arsitektur #4 di `CLAUDE.md` ("semua
write action... dicatat ke AuditLog"). Dampaknya rendah: perubahan data yang
memicunya (jadwal operasi) tetap terekam lengkap lewat baris `UPDATE Operasi`
yang sama (before/after lengkap, actor jelas) — yang "bolong" cuma
notifikasi turunannya, isinya pun cuma pesan pemberitahuan, bukan data
medis/finansial sensitif.

Butuh keputusan dulu: apakah notifikasi hasil trigger otomatis butuh baris
audit sendiri (konsisten literal dengan aturan #4), atau cukup dianggap
ter-cover oleh baris `UPDATE Operasi` yang jadi penyebabnya. Juga relevan
untuk pola yang bakal dipakai chatbot nanti (aturan #5, wajib audit tiap
write) — kalau polanya tidak diluruskan sekarang, berisiko ketiru ke fitur
baru.

### 7. Jadwal poliklinik mendatang (besok dan seterusnya)

Tab Poliklinik hanya bisa menampilkan hari ini dan ke belakang. Memilih
tanggal besok lewat chip filter selalu mengembalikan daftar kosong.

**Bukan bug, dan bukan sekadar batasan yang dipasang di aplikasi.** Tab itu
memang default ke hari ini (`dari = sampai = hari ini`), tapi filternya tidak
dikunci — dokter bebas memilih tanggal mana pun. Penghalang sebenarnya ada
di sumber datanya:

```sql
SELECT COUNT(*) FROM pendaftaran.kunjungan WHERE MASUK > NOW()  -- 0
```

Nol, se-rumah-sakit. `pendaftaran.kunjungan` adalah catatan KEDATANGAN —
barisnya baru lahir saat pasien check-in di loket. Jadwal besok secara
prinsip tidak akan pernah ada di sana, berapa lama pun ditunggu.

Janji temu mendatang ada di tabel lain, `remun_medis.perjanjian` (puluhan
ribu janji ke depan, jauh melampaui hari ini).

**Kenapa tidak dikerjakan sekarang.** Menampilkannya berarti tab Poliklinik
punya DUA sumber dengan makna berbeda — hari ini & ke belakang dari
`kunjungan` (sudah terjadi), besok & ke depan dari `perjanjian` (baru
rencana). Menggabungkannya jadi satu daftar seragam akan membuat dokter
membaca rencana sebagai kenyataan. Kalau dikerjakan, keduanya harus dibedakan
secara visual — itu keputusan desain tersendiri, bukan sekadar tambahan
query.

**Yang harus dipastikan lebih dulu:** apakah `remun_medis.perjanjian` memang
tabel janji temu yang dipakai aplikasi pendaftaran. Namanya berada di skema
remunerasi (bukan `pendaftaran`), dan ada `remun_medis.perjanjian_lama`
(jutaan baris) di sebelahnya — belum tentu yang dipilih ini yang berlaku.

Catatan teknis yang jangan hilang: kolom `TANGGAL` di tabel itu bertipe
datetime, jadi `WHERE TANGGAL = CURDATE() + INTERVAL 1 DAY` hanya menangkap
baris tepat tengah malam — harus `DATE(TANGGAL) = ...`.

---

## Catatan tambahan (bukan keputusan tertunda, tapi jangan hilang)

- **`Math.random()` di `backend/prisma/seed-kunjungan-operasi.js`** — pola
  determinisme (`faker.seed(...)`) yang dipakai `prisma/seed.js` belum ikut
  diterapkan di berkas seed terpisah ini. Belum mengganggu karena tidak
  dipakai di alur seed utama, tapi kalau nanti dipakai, determinisme seed
  bocor tanpa gejala yang kelihatan.
- **`simrs-exploration/q.js` tanpa `dateStrings`** — kolom DATE/DATETIME
  dikonversi mysql2 jadi objek Date UTC, sehingga tanggal tercetak mundur
  satu hari. Hanya memengaruhi skrip eksplorasi, bukan aplikasi
  (`src/lib/simrs.js` sudah menyetel `dateStrings: true` justru karena
  jebakan ini). Selama belum diperbaiki, pakai
  `DATE_FORMAT(kolom,'%Y-%m-%d')` di setiap query eksplorasi yang
  menampilkan tanggal.
- **ERD final di `docs/`** belum ada, dan jumlah entitas Prisma sudah
  bertambah sejak dokumen ERD lama dibuat — perlu diperbarui.
