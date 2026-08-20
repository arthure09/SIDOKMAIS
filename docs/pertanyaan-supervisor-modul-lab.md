# Pertanyaan Modul Hasil Lab — SIDOKMAIS

**Untuk:** Supervisor (bagian B & C) dan Mas Fauzi selaku DBA SIMRS (bagian A & D)
**Dari:** Arthuro — magang solo developer, divisi SIMRS
**Tanggal:** 30 Juli 2026 — **bagian D ditambahkan 20 Agustus 2026**

---

## Konteks

Per hari ini (Day 17) saya sudah membangun fondasi data untuk modul **laporan
hasil lab** di SIDOKMAIS: dua tabel baru (`PemeriksaanLab` untuk permintaan lab
dan `HasilLabItem` untuk nilai per parameter), lengkap dengan data contoh untuk
pengembangan. Modul ini belum pernah dibahas dalam pertemuan, jadi seluruh
struktur yang sudah ada saat ini berdiri di atas asumsi saya sendiri.

Rencana saya: endpoint backend Day 18 (31 Juli), lalu tampilan aplikasi Day 19
(1 Agustus). Artinya jawaban atas pertanyaan di bagian **C** paling berdampak
kalau bisa didapat sebelum 31 Juli — asumsi soal hak akses sudah tertanam di
struktur database, dan mengubahnya setelah endpoint jadi akan lebih mahal.

Dokumen ini saya kirim lebih dulu supaya pertemuannya bisa langsung ke
keputusan, bukan diskusi terbuka. Pertanyaannya sengaja dibuat tertutup —
sebagian besar cukup dijawab pilih salah satu. Kalau ada yang belum bisa
diputuskan sekarang, cukup ditandai "belum" dan saya akan menuliskannya sebagai
keputusan tertunda, bukan mengasumsikan sendiri.

---

## A. Sumber data hasil lab — untuk Mas Fauzi

Tujuan bagian ini: mengetahui bentuk data hasil lab yang sebenarnya ada di
SIMRS, supaya struktur yang saya buat bisa disesuaikan sebelum terlalu jauh.

**A1. Hasil lab di SIMRS tersimpan dalam bentuk apa?**

- [ ] Data terstruktur per parameter (satu baris per nilai — misalnya baris
      Hemoglobin, baris Leukosit, masing-masing dengan nilai, satuan, dan
      rentang rujukannya)
- [ ] Berkas dokumen hasil (PDF atau hasil scan lembar lab)
- [ ] Keduanya — data terstruktur untuk sebagian pemeriksaan, dokumen untuk
      sebagian lain
- [ ] Lain-lain: ................................................

**A2. Kalau ada berkas dokumen:**

- Disimpan di mana — di dalam database (kolom biner), di file server /
  shared folder, atau di sistem dokumen terpisah?
- Bagaimana aplikasi lain di RS mengaksesnya sekarang — lewat URL/endpoint,
  lewat path jaringan, atau lewat modul SIMRS langsung?
- Apakah ada mekanisme akses yang bisa dipakai aplikasi baru, atau setiap
  aplikasi mengaksesnya dengan caranya sendiri?

**A3. Kalau ada tabel terstruktur:** boleh minta struktur tabelnya (nama kolom,
tipe data, relasi ke tabel pasien/kunjungan)?

Sebelumnya saya sudah pernah diberi `master_data.xlsx` sebagai referensi
struktur — format seperti itu sudah sangat cukup, tidak perlu akses ke data
pasien asli. Yang saya butuh khususnya:

- Bagaimana satu hasil lab dihubungkan ke pasien — lewat No. RM, lewat ID
  kunjungan, atau keduanya?
- Apakah ada konsep "order lab" yang terpisah dari "nilai hasil", atau
  semuanya satu tabel?
- Apakah rentang rujukan (nilai normal) ikut tersimpan per baris hasil, atau
  disimpan terpisah sebagai master data parameter?
- Apakah ada penanda abnormal (semacam flag H/L) yang sudah dihitung sistem,
  atau itu dihitung di sisi tampilan?

**A4. Daftar kategori dan nama unit laboratorium resmi.** Saat ini saya pakai 6
kategori umum sebagai sementara (Hematologi, Kimia Klinik, Mikrobiologi,
Patologi Anatomi, Imunologi, Urinalisis) dan nama laboratorium masih placeholder
("Laboratorium A/B/C"). Boleh minta daftar yang benar-benar dipakai di RS
Dharmais?

**A5. Masih ditunggu dari permintaan sebelumnya** — struktur tabel `Operasi` dan
`Penjamin`. Modul operasi dan pendapatan di SIDOKMAIS masih berjalan di atas
struktur asumsi saya, jadi kalau kedua ini sudah bisa dikirim, saya bisa
menyesuaikan sekaligus.

---

## B. Cakupan fitur — untuk supervisor

Tujuan bagian ini: menentukan sejauh mana modul lab dikerjakan dalam sisa waktu
magang (sekarang Minggu 3 dari 4).

**B1. Untuk fase ini, apa yang cukup?**

- [ ] Dokter cukup **melihat dokumen hasilnya** (buka lembar hasil lab
      apa adanya). Lebih ringan, dan lebih realistis kalau ternyata SIMRS
      menyimpan hasil lab sebagai berkas dokumen.
- [ ] Dokter perlu **membaca nilai per parameter di dalam aplikasi** (tabel
      parameter, nilai, satuan, rentang rujukan, penanda abnormal). Ini yang
      sudah saya siapkan strukturnya, dan memungkinkan fitur lanjutan seperti
      perbandingan dengan hasil sebelumnya.
- [ ] Keduanya — tabel parameter di aplikasi, dengan opsi membuka dokumen
      aslinya.

Kalau jawabannya opsi kedua atau ketiga, ada pertanyaan turunan: **apakah perlu
menampilkan perbandingan dengan hasil pemeriksaan sebelumnya** (misalnya
Hemoglobin bulan ini dibanding bulan lalu, dengan penanda naik/turun)? Ini
menambah nilai klinis yang cukup besar untuk pasien onkologi yang dipantau rutin,
tapi mengubah bentuk data yang dikirim endpoint — jadi saya perlu tahu sebelum
Day 19, bukan sesudah.

**B2. Apakah dokter boleh mengunduh atau membagikan hasil lab dari aplikasi,
atau hanya melihat?**

- [ ] Hanya melihat di dalam aplikasi
- [ ] Boleh mengunduh (simpan ke perangkat)
- [ ] Boleh membagikan (kirim lewat aplikasi lain di perangkat)

Ini saya pahami sebagai **pertanyaan kebijakan data, bukan teknis** — secara
teknis ketiganya bisa dikerjakan. Yang saya tidak bisa putuskan sendiri adalah
apakah hasil lab pasien boleh keluar dari aplikasi ke penyimpanan pribadi
perangkat dokter, mengingat ini data rekam medis. Sampai ada keputusan, tombol
cetak/bagikan tidak saya buat.

**B3. Apakah modul lab ini masuk sebagai modul resmi magang, atau tetap
berstatus tambahan?** Rencana awal magang memuat 4 modul (list pasien, jadwal
operasi, pendapatan, notifikasi) — modul lab tidak ada di dalamnya, dan
menggantikan slot chatbot yang digeser keluar dari Minggu 3. Saya perlu tahu ini
untuk pelaporan magang.

---

## C. Kebijakan hak akses — untuk supervisor

**Ini bagian yang paling penting dikonfirmasi**, karena asumsinya sudah tertanam
di struktur database dan akan dipakai endpoint Day 18.

**C1. Apakah benar seorang dokter boleh melihat semua hasil lab pasien yang
ditugaskan kepadanya, termasuk hasil lab yang diminta oleh dokter lain?**

**DIJAWAB/DIKONFIRMASI — 4 Agustus 2026 (Day 22).** Opsi pertama dipilih:
dokter penanggung jawab boleh melihat seluruh hasil lab pasiennya, siapa pun
yang meminta pemeriksaan itu. Basis akses `DokterPasienAssignment` (bukan
`kunjungan.dokterId`) yang sejak Day 17 baru berupa asumsi, sekarang jadi
keputusan resmi — dicatat langsung sebagai komentar di
`backend/src/utils/aksesPasien.js` ("Keputusan sudah dikonfirmasi (Day 22,
2026-08-04)"), dan basis yang sama itu sekarang dipakai konsisten di
pasien/lab/kunjungan/operasi routes (lihat `docs/jurnal-pengerjaan.md` entri
Hari 22).

- [x] Benar — dokter penanggung jawab boleh melihat seluruh hasil lab pasiennya,
      siapa pun yang meminta pemeriksaan itu
- [ ] Tidak — dokter hanya boleh melihat hasil lab dari pemeriksaan yang dia
      sendiri minta
- [ ] Tidak — batasannya per kunjungan/episode perawatan, bukan per pasien
- [ ] Ada aturan lain: ................................................

**Yang sudah saya asumsikan (opsi pertama), dan alasannya:**

Pasien onkologi ditangani lintas dokter — satu pasien bisa punya dokter bedah
onkologi, onkologi medik, dan radioterapi sekaligus. Order lab juga sering
diminta oleh dokter yang bukan penanggung jawab, misalnya dokter jaga saat rawat
inap. Kalau hak akses dibatasi per kunjungan atau per dokter peminta, dokter
penanggung jawab tidak akan bisa melihat hasil lab pasiennya sendiri hanya
karena yang meminta pemeriksaan itu orang lain — dan fiturnya kehilangan
gunanya.

Konsekuensi di struktur database: setiap hasil lab wajib punya `pasienId`,
sedangkan `kunjunganId` boleh kosong, dan hak akses dibaca dari tabel penugasan
dokter–pasien. Dokter peminta tetap dicatat, tapi sebagai informasi saja.

~~Kalau asumsi ini keliru, mohon dikoreksi sebelum 31 Juli.~~ **Sudah
dikonfirmasi 4 Agustus 2026 — asumsi ini benar, lihat catatan "DIJAWAB/
DIKONFIRMASI" di atas.**

**C2. Pertanyaan turunan:** apakah dokter boleh melihat hasil lab pasien yang
penugasannya sudah berstatus selesai (bukan lagi pasien aktifnya)? Ini relevan
untuk pasien kontrol yang kembali setelah beberapa bulan.

**C3. Apakah hasil lab tertentu perlu diperlakukan lebih sensitif dari yang
lain?** Misalnya hasil patologi anatomi yang memuat diagnosis keganasan, atau
hasil pemeriksaan HIV/hepatitis — apakah ada aturan RS yang membatasi siapa yang
boleh melihatnya, atau membedakan hasil yang belum diverifikasi dokter patologi?

---

## D. Kalau akses ke SIMRS diberikan sebagai READ-ONLY — untuk Mas Fauzi & supervisor

**Ditambahkan 20 Agustus 2026.** Konteksnya berbeda dari bagian A–C: bagian itu
ditulis waktu integrasi masih jauh. Sekarang kemungkinan yang paling realistis
adalah SIDOKMAIS dapat akses **baca-saja** ke basis data SIMRS. Lima pertanyaan
di bawah ini yang paling menentukan besar-kecilnya pekerjaan integrasi — bukan
karena sulit dikerjakan, tapi karena jawaban yang berbeda menghasilkan aplikasi
yang berbeda bentuknya.

Selama belum terjawab, aplikasi tetap jalan di atas data contoh dan tidak ada
yang macet. Jadi ini bukan permintaan mendesak — hanya perlu terjawab **sebelum**
saya mulai menulis kode integrasi, bukan sesudah.

**D1. Hasil lab ada di basis data SIMRS, atau di sistem laboratorium (LIS) yang
terpisah?**

- [ ] Ada di dalam SIMRS — ikut terbaca dengan akses read-only yang sama
- [ ] Ada di LIS terpisah, perlu izin/akses tersendiri
- [ ] Sebagian di SIMRS, sebagian di LIS
- [ ] Lain-lain: ................................................

Ini menyambung pertanyaan **A1** yang belum terjawab, dengan satu tambahan yang
baru terasa sekarang: kalau hasil lab ternyata ada di LIS terpisah, akses
read-only ke SIMRS saja **tidak menghasilkan data lab sama sekali**, dan modul
Cari Hasil Lab tetap berjalan di atas data contoh meskipun integrasi modul lain
sudah selesai. Kalau begitu keadaannya, lebih baik saya tahu lebih dulu supaya
tidak menjadwalkan pekerjaan yang bahan bakunya belum ada.

**D2. Bagaimana SIMRS mencatat hubungan "dokter ini menangani pasien ini"?**

- [ ] Ada tabel penugasan dokter–pasien tersendiri
- [ ] Diturunkan dari kunjungan/registrasi (misalnya kolom DPJP di baris kunjungan)
- [ ] Cara lain: ................................................

**Ini pertanyaan yang paling berdampak di bagian D.** Seluruh pembatasan akses di
SIDOKMAIS — pasien, hasil lab, kunjungan, operasi, dan dashboard — berdiri di
atas satu tabel `DokterPasienAssignment` yang saya buat sendiri, dan kebijakannya
sudah dikonfirmasi di **C1**. Yang belum diketahui bukan kebijakannya, tapi
**bentuk datanya di SIMRS**: kalau di sana hubungan itu tidak berupa tabel
tersendiri melainkan diturunkan dari kolom DPJP di kunjungan, maka seluruh
pembatasan akses harus dihitung ulang dari bentuk yang berbeda. Karena ini kode
yang menentukan siapa boleh melihat data pasien siapa, perubahannya tidak cukup
disambung — harus diuji ulang.

**D3. Login dokter memakai akun aplikasi sendiri, atau harus lewat SSO/LDAP RS?**

- [ ] Akun sendiri (SIDOKMAIS menyimpan akun & kata sandinya sendiri, seperti sekarang)
- [ ] Wajib SSO/akun domain RS
- [ ] Belum ada ketentuan

Kalau jawabannya SSO, seluruh alur login dan cara aplikasi mengenali "dokter yang
sedang masuk" diganti — dan identitas dokter itu dipakai di semua modul, jadi ini
termasuk perubahan yang paling mahal kalau baru diketahui belakangan.

**D4. Kalau aksesnya read-only, apakah SIDOKMAIS boleh punya basis data kecil
sendiri di samping SIMRS?**

- [ ] Boleh — silakan siapkan sendiri, di server ........................
- [ ] Boleh, tapi harus dikelola tim SIMRS
- [ ] Tidak boleh — semua data harus di SIMRS
- [ ] Belum ada ketentuan

Alasan pertanyaan ini: ada empat hal yang **dibuat oleh aplikasi ini sendiri** dan
tidak mungkin ditulis ke SIMRS yang read-only —

| Data | Keterangan |
|---|---|
| Catatan kalender | catatan pribadi dokter, murni milik aplikasi |
| Notifikasi | dibuat & ditandai terbaca oleh aplikasi |
| Log audit | catatan setiap aksi tulis (aturan wajib proyek ini) |
| Akun pengguna | kalau **D3** dijawab "akun sendiri" |

Tanpa tempat menyimpan keempatnya, fitur kalender dan notifikasi tidak bisa
jalan sama sekali. Kalau jawabannya "tidak boleh", saya perlu tahu supaya kedua
fitur itu bisa dinyatakan gugur sejak awal, bukan dibongkar setelah dikerjakan.

**D5. Data jasa medis (pendapatan) diambil dari mana?**

Sepanjang yang saya pahami, angka remunerasi berasal dari **SIREMDIS**, yang
merupakan sistem terpisah dari SIMRS. Kalau benar begitu, akses read-only ke
SIMRS tidak mencakup data ini, dan modul Jasa Medis tetap memakai data contoh
sampai ada akses tersendiri.

- [ ] Benar, SIREMDIS sistem terpisah — perlu izin/akses sendiri
- [ ] Datanya juga tersedia di SIMRS
- [ ] Lain-lain: ................................................

Saya tidak mengajukan permintaan akses apa pun lewat pertanyaan ini — mengingat
sifat datanya, saya menganggap ini keputusan supervisor sepenuhnya. Yang saya
butuh hanya kepastian statusnya, supaya modul ini tidak saya laporkan sebagai
"tinggal disambungkan" padahal sumbernya belum ada.

---

## Ringkasan yang saya butuh untuk lanjut

| Butuh sebelum | Pertanyaan | Kalau belum terjawab |
|---|---|---|
| 31 Juli (Day 18) | **C1** — kebijakan hak akses | **Terjawab 4 Agustus 2026** — opsi pertama dikonfirmasi, lihat bagian C1 di atas |
| 31 Juli (Day 18) | **B1** — nilai per parameter atau dokumen | Dibangun untuk nilai per parameter (struktur sudah ada) |
| 1 Agustus (Day 19) | **B1 turunan** — perbandingan hasil sebelumnya | Tidak dikerjakan, ditunda |
| Tidak mendesak | **B2** — unduh/bagikan | Tombol tidak dibuat |
| Tidak mendesak | **A1–A4** — sumber data SIMRS | Modul tetap jalan di atas data contoh; integrasi jadi pekerjaan pasca-magang |
| Tidak mendesak | **A4** — nama kategori & lab resmi | Tetap pakai 6 kategori umum + "Laboratorium A/B/C" |
| Tidak mendesak | **A5** — tabel `Operasi` & `Penjamin` | Modul operasi & pendapatan tetap di struktur asumsi |
| Sebelum mulai integrasi | **D2** — bentuk relasi dokter–pasien di SIMRS | Pembatasan akses tetap di `DokterPasienAssignment` buatan sendiri |
| Sebelum mulai integrasi | **D3** — login sendiri atau SSO | Tetap akun sendiri; kalau ternyata SSO, alur login dibangun ulang |
| Sebelum mulai integrasi | **D4** — boleh punya DB sendiri | Kalender & notifikasi diasumsikan tetap bisa jalan |
| Sebelum mulai integrasi | **D1** — lab di SIMRS atau LIS | Modul lab tetap di data contoh |
| Tidak mendesak | **D5** — sumber data jasa medis | Modul Jasa Medis tetap di data contoh |

Terima kasih. Kalau lebih mudah dijawab langsung di dokumen ini, silakan —
kotak centangnya bisa diisi tanpa perlu menulis panjang.
