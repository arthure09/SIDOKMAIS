# Pertanyaan Modul Hasil Lab — SIDOKMAIS

**Untuk:** Supervisor (bagian B & C) dan Mas Fauzi selaku DBA SIMRS (bagian A)
**Dari:** Arthuro — magang solo developer, divisi SIMRS
**Tanggal:** 30 Juli 2026

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

- [ ] Benar — dokter penanggung jawab boleh melihat seluruh hasil lab pasiennya,
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

**Kalau asumsi ini keliru, mohon dikoreksi sebelum 31 Juli.** Setelah endpoint
Day 18 jadi, mengubahnya berarti mengubah struktur database dan seluruh
pengetesan yang sudah lewat.

**C2. Pertanyaan turunan:** apakah dokter boleh melihat hasil lab pasien yang
penugasannya sudah berstatus selesai (bukan lagi pasien aktifnya)? Ini relevan
untuk pasien kontrol yang kembali setelah beberapa bulan.

**C3. Apakah hasil lab tertentu perlu diperlakukan lebih sensitif dari yang
lain?** Misalnya hasil patologi anatomi yang memuat diagnosis keganasan, atau
hasil pemeriksaan HIV/hepatitis — apakah ada aturan RS yang membatasi siapa yang
boleh melihatnya, atau membedakan hasil yang belum diverifikasi dokter patologi?

---

## Ringkasan yang saya butuh untuk lanjut

| Butuh sebelum | Pertanyaan | Kalau belum terjawab |
|---|---|---|
| 31 Juli (Day 18) | **C1** — kebijakan hak akses | Endpoint dibangun di atas asumsi opsi pertama, dicatat sebagai risiko |
| 31 Juli (Day 18) | **B1** — nilai per parameter atau dokumen | Dibangun untuk nilai per parameter (struktur sudah ada) |
| 1 Agustus (Day 19) | **B1 turunan** — perbandingan hasil sebelumnya | Tidak dikerjakan, ditunda |
| Tidak mendesak | **B2** — unduh/bagikan | Tombol tidak dibuat |
| Tidak mendesak | **A1–A4** — sumber data SIMRS | Modul tetap jalan di atas data contoh; integrasi jadi pekerjaan pasca-magang |
| Tidak mendesak | **A4** — nama kategori & lab resmi | Tetap pakai 6 kategori umum + "Laboratorium A/B/C" |
| Tidak mendesak | **A5** — tabel `Operasi` & `Penjamin` | Modul operasi & pendapatan tetap di struktur asumsi |

Terima kasih. Kalau lebih mudah dijawab langsung di dokumen ini, silakan —
kotak centangnya bisa diisi tanpa perlu menulis panjang.
