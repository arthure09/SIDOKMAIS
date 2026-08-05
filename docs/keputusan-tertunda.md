# Keputusan Tertunda — SIDOKMAIS

Daftar hal yang **sengaja belum dikerjakan**, beserta alasan, pemicu, dan
targetnya. Tujuan dokumen ini adalah memisahkan dengan jelas mana yang "belum
dikerjakan" (terlupa, utang teknis tanpa rencana) dari yang "sengaja ditunda"
(keputusan sadar, ada alasan dan pemicunya).

Aturan pakai: kalau sesuatu diputuskan untuk tidak dikerjakan sekarang, ia masuk
ke sini dengan **pemicu** yang jelas — apa yang harus terjadi supaya item ini
bisa dilanjutkan. Item yang sudah selesai dipindahkan ke
`docs/jurnal-pengerjaan.md`, jangan dihapus diam-diam dari sini.

Terakhir diperbarui: **4 Agustus 2026 (Day 21)** — item 5 & 6 selesai, detail
dipindah ke `docs/jurnal-pengerjaan.md` (entri Hari 21), baris di bawah
ditinggalkan sesuai aturan file ini sendiri (lihat paragraf di atas).

---

## Ringkasan

| Item | Alasan ditunda | Menunggu apa | Target |
|---|---|---|---|
| Perbandingan nilai lab sebelumnya | Menambah nilai klinis tapi mengubah bentuk response endpoint | Jawaban supervisor pertanyaan B | Sebelum Day 19 |
| Tombol cetak/bagikan hasil lab | Kebijakan data belum jelas | Jawaban supervisor pertanyaan B | — |
| Integrasi file PDF asli dari SIMRS | Sumber file belum diketahui | Mas Fauzi | Pasca-magang |
| Push notification (remote) | Expo Go tidak lagi mendukung push sejak SDK 53; butuh development build | Slot waktu Minggu 4 | Opsional |
| ~~Kopling parameter hematologi (Hb–Hematokrit–Eritrosit)~~ | ~~Kombinasi nilai saat ini tidak konsisten secara fisiologis~~ | — | **SELESAI 4 Ags 2026** |
| ~~Arah flag abnormal~~ | ~~Untuk pasien pasca-kemoterapi, seharusnya lebih banyak RENDAH daripada TINGGI~~ | — | **SELESAI 4 Ags 2026** |
| Migrasi backend ke TypeScript | Prioritas fitur; risiko merusak yang sudah jalan | — | Tidak dikerjakan |
| Indikator mode Admin di UI | Akun demo adalah admin sehingga melihat data semua dokter; berpotensi disalahpahami saat demo | — | Minggu 4 |

---

## Rincian

### 1. Perbandingan nilai lab dengan hasil sebelumnya
**Target: sebelum Day 19 · Menunggu: jawaban supervisor pertanyaan B**

Menampilkan nilai pemeriksaan sekarang berdampingan dengan hasil sebelumnya
(misalnya Hemoglobin bulan ini dibanding bulan lalu, dengan penanda naik/turun).
Untuk pasien onkologi yang dipantau rutin, tren nilai sering lebih informatif
daripada nilai tunggal — jadi nilai klinisnya besar.

Ditunda karena ini mengubah **bentuk data yang dikirim endpoint**, bukan cuma
menambah tampilan: setiap parameter perlu membawa nilai pembandingnya. Kalau
dikerjakan setelah endpoint Day 18 jadi dan sudah dites, endpoint-nya harus
dibongkar lagi. Lebih murah diputuskan sebelum Day 18 daripada sesudah.

### 2. Tombol cetak / bagikan hasil lab
**Target: belum ditentukan · Menunggu: jawaban supervisor pertanyaan B**

Secara teknis mudah — mengunduh atau membagikan berkas dari aplikasi mobile
bukan pekerjaan besar. Yang belum jelas adalah **kebijakannya**: apakah hasil
lab pasien boleh keluar dari aplikasi ke penyimpanan pribadi perangkat dokter,
mengingat ini data rekam medis.

Ini bukan keputusan yang boleh saya ambil sendiri, jadi tombolnya tidak dibuat
sama sekali — bukan dibuat lalu dinonaktifkan. Tombol yang ada tapi mati
mengundang pertanyaan "kapan jalan?" saat demo, sedangkan tombol yang tidak ada
tidak menjanjikan apa pun.

### 3. Integrasi berkas PDF hasil lab asli dari SIMRS
**Target: pasca-magang · Menunggu: Mas Fauzi (pertanyaan A1–A3)**

Kalau ternyata SIMRS menyimpan hasil lab sebagai berkas dokumen (PDF atau hasil
scan), aplikasi perlu bisa menampilkan berkas itu, bukan cuma nilai per
parameter. Belum bisa dimulai karena sumber berkasnya belum diketahui: di mana
disimpan, dan bagaimana aplikasi lain mengaksesnya.

Realistis ini pekerjaan pasca-magang. Selain menunggu jawaban, integrasi ke
SIMRS produksi juga di luar scope fase dummy data yang sekarang berlaku.

### 4. Push notification jarak jauh (remote push)
**Target: opsional, Minggu 4 kalau ada waktu · Menunggu: slot waktu**

Notifikasi di dalam aplikasi sudah jalan (tersambung ke backend asli, sudah
dites). Yang belum ada adalah notifikasi yang muncul di layar HP saat aplikasi
tertutup.

Hambatannya bukan kode: **Expo Go sudah tidak mendukung remote push notification
sejak SDK 53**, jadi butuh *development build* — versi aplikasi yang dikompilasi
sendiri, bukan dijalankan lewat Expo Go. Menyiapkan build itu (EAS Build,
kredensial push, instalasi ke perangkat) memakan waktu yang sebanding dengan
satu fitur utuh, untuk hasil yang tidak bisa ditunjukkan di demo dengan
perangkat yang ada sekarang.

Status: opsional. Kalau Minggu 4 selesai lebih cepat dari perkiraan, ini kandidat
pertama. Kalau tidak, dilaporkan apa adanya sebagai batasan lingkungan
pengembangan, bukan sebagai fitur gagal.

### 5. Kopling parameter hematologi (Hb – Hematokrit – Eritrosit)
**SELESAI — 4 Agustus 2026 (Day 21).** Detail perbaikan:
`docs/jurnal-pengerjaan.md` entri Hari 21. Ringkas: `buildHematologiItems()`
di `backend/prisma/seed.js` sekarang menghitung satu `hbGroupSeverity` per
pasien dan memakainya untuk Hemoglobin/Hematokrit/Eritrosit sekaligus lewat
`buildSeverityDrivenItem()`, gantiin pengacakan independen per parameter.
Baris di bawah ditinggalkan sesuai aturan pakai dokumen ini (lihat paragraf
pembuka) — jangan dihapus.

**Target awal: Day 21 · Menunggu: —**

Di dalam tubuh manusia, Hemoglobin, Hematokrit, dan Eritrosit bergerak bersama —
Hemoglobin rendah hampir selalu diikuti Hematokrit rendah. Di data contoh saat
ini ketiganya diacak berdiri sendiri, jadi bisa muncul kombinasi yang tidak
mungkin secara fisiologis (misalnya Hemoglobin rendah tapi Hematokrit tinggi).

Ini murni soal kualitas **data contoh** — tidak menyentuh struktur database
maupun kode aplikasi, jadi tidak menghalangi Day 18–19. Tapi tetap perlu
diperbaiki sebelum demo, karena dokter yang melihatnya akan langsung menyadari
kombinasinya tidak wajar, dan itu menimbulkan keraguan pada bagian aplikasi yang
sebenarnya sudah benar.

Tidak menunggu siapa pun — murni butuh slot waktu. Dijadwalkan bareng item 6
karena keduanya menyentuh fungsi yang sama di seed.

### 6. Arah nilai abnormal pada data contoh
**SELESAI — 4 Agustus 2026 (Day 21).** Detail perbaikan:
`docs/jurnal-pengerjaan.md` entri Hari 21. Ringkas: `pickArahAbnormal()` di
`backend/prisma/seed.js` sekarang skew 85% ke RENDAH untuk parameter
hematologi pada pasien dengan riwayat kemoterapi (di-derive dari regex
`/kemoterapi/i` terhadap `Kunjungan.diagnosa`), gantiin random 50/50. Baris
di bawah ditinggalkan sesuai aturan pakai dokumen ini — jangan dihapus.

**Target awal: Day 21 · Menunggu: —**

Sebaran tanda hasil per 30 Juli: RENDAH 3, NORMAL 56, TINGGI 8, ABNORMAL 8.
Untuk populasi pasien RS Dharmais — banyak pasien pasca-kemoterapi, yang umumnya
mengalami anemia serta penurunan leukosit dan trombosit — seharusnya **RENDAH
lebih banyak daripada TINGGI**, bukan sebaliknya.

Penyebabnya bisa dilacak: sebagian besar parameter di data contoh memakai arah
abnormal bawaan `["RENDAH", "TINGGI"]` (peluang seimbang), sementara parameter
yang secara klinis memang hanya naik (SGOT, SGPT, Ureum, Kreatinin, tumor marker)
sudah dibatasi ke `["TINGGI"]`. Akibatnya arah TINGGI terakumulasi. Perbaikannya:
memberi arah abnormal eksplisit ke parameter hematologi (Hemoglobin, Leukosit,
Trombosit, Hematokrit, Eritrosit → cenderung RENDAH).

Sama seperti item 5, ini kualitas data contoh saja.

### 7. Migrasi backend ke TypeScript
**Target: tidak dikerjakan · Menunggu: —**

Rencana awal dan dokumentasi lama menyebut backend TypeScript. Kondisi aktual:
seluruh 16 berkas backend adalah JavaScript (`.js`, CommonJS), tanpa
`tsconfig.json` dan tanpa dependency `typescript`. Ditemukan saat audit
dokumentasi 30 Juli 2026 — jadi ini penyimpangan yang tidak disengaja, bukan
keputusan yang pernah diambil.

Keputusan sekarang: **tidak dimigrasi.** Alasannya:

- Sisa waktu magang kurang dari dua minggu, dan prioritasnya menyelesaikan modul
  lab (endpoint + tampilan) serta hardening Minggu 4.
- Migrasi 16 berkas di tengah jalan berisiko merusak modul yang sudah berjalan
  dan sudah dites (pasien, operasi, notifikasi), untuk hasil yang tidak menambah
  satu pun fungsi baru.
- Frontend tetap TypeScript, jadi manfaat pengecekan tipe masih didapat di
  lapisan yang paling banyak berubah.

Yang **sudah** dilakukan sebagai gantinya: penyimpangan ini dicatat eksplisit di
`CLAUDE.md` dan `README.md`, supaya tidak ada dokumentasi yang terus mengklaim
backend TypeScript. Kalau proyek ini dilanjutkan pasca-magang, migrasi jadi
kandidat pekerjaan pertama — saat tidak ada tekanan tenggat.

### 8. Indikator mode Admin di tampilan
**Target: Minggu 4 · Menunggu: —**

Akun yang dipakai untuk demo adalah akun ADMIN, dan admin bisa melihat data
seluruh dokter, bukan hanya satu dokter. Di tampilan saat ini tidak ada penanda
apa pun soal itu.

Risikonya spesifik dan cukup serius saat demo: orang yang melihat akan mengira
seorang dokter bisa melihat pasien dokter lain — padahal pembatasan per dokter
memang sudah berjalan dan sudah dites (identitas dokter selalu diambil dari token
login di sisi server, tidak pernah dari permintaan aplikasi). Salah paham ini
justru menyerang bagian yang paling hati-hati dikerjakan.

Rencana perbaikan: penanda kecil di tampilan saat akun yang login berperan ADMIN
(misalnya label "Mode Admin — menampilkan data seluruh dokter" di header).
Perubahan tampilan saja, tidak menyentuh backend maupun logika hak akses.
Dijadwalkan Minggu 4 bareng persiapan demo.

---

## Catatan tambahan (bukan keputusan tertunda, tapi jangan hilang)

- **`Math.random()` di `backend/prisma/seed-kunjungan-operasi.js`** (baris 67 dan
  71). Pola yang sama sudah diperbaiki di `prisma/seed.js` pada Day 17, tapi
  berkas seed terpisah ini belum ikut. Belum mengganggu karena tidak dipakai di
  alur seed utama — tapi kalau nanti dipakai, determinisme seed bocor lagi tanpa
  gejala yang kelihatan.
- **Klaim stale di *project knowledge* Claude.ai** (`memory.md` dan
  `rencana-pengembangan-aplikasi-dokter.md`): masih menyebut axios, backend
  TypeScript, `#27B4AC` sebagai primary, dan "10-entity schema (`Assignment`)".
  Berkas-berkas itu read-only dari sisi repo, jadi tidak bisa dikoreksi lewat
  pekerjaan ini — perlu diperbarui manual dari sisi Claude.ai. Selama belum,
  fakta keliru itu akan terus masuk ke konteks prompt berikutnya.
- **ERD final di `docs/`** belum ada, dan jumlah entitas sudah berubah (10 → 13).
  Terdaftar sebagai TODO di `README.md`.
