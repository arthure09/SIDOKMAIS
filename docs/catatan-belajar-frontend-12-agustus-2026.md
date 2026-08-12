# Catatan Belajar Frontend — Rabu, 12 Agustus 2026

**Proyek:** SIDOKMAIS (Sistem Informasi Dokter Dharmais)
**Scope:** frontend saja — tidak ada perubahan backend, database, atau endpoint
**Tujuan dokumen:** merekam *kenapa* tiap perubahan diambil, bukan cuma *apa*
yang diubah. Yang layak dipelajari dari sesi ini bukan potongan kodenya,
melainkan cara melacak penyebab sampai ke akar.

---

## Daftar isi

1. [Ringkasan statistik mingguan — kapan AI tidak diperlukan](#1)
2. [Bug: gestur swipe iOS mendarat di layar yang salah](#2)
3. [Data Pendapatan dihapus dari halaman Profil](#3)
4. [Filter yang menyembunyikan diri saat scroll](#4)
5. [Bug: list terasa nyangkut saat discroll balik](#5)
6. [Lengkungan header — pelajaran soal kontras](#6)
7. [Perubahan teks & tampilan kecil](#7)
8. [Berkas yang berubah](#8)
9. [Yang belum diverifikasi](#9)

---

<a id="1"></a>

## 1. Ringkasan statistik mingguan — kapan AI tidak diperlukan

**Pertanyaan awal:** perlukah memanggil LLM untuk menghasilkan kalimat ringkasan
di bawah grafik "Statistik Pasien Mingguan"?

**Jawaban: tidak.** Semua isi kalimat itu aritmetika biasa di atas array yang
sama dengan yang menggambar bar-nya (`aktivitasMingguan`, 7 entri Senin–Minggu).
Menjumlah, mencari nilai terbesar, dan membagi rata-rata tidak butuh model
bahasa.

Pertimbangan yang dipakai:

| Aspek | Rule-based | Lewat LLM |
|---|---|---|
| Konsistensi dengan angka di chart | Dijamin, sumbernya sama | Bisa salah baca / mengarang |
| Latensi | Instan | Ratusan ms–detik, butuh jaringan |
| Biaya | Nol | Per panggilan |
| Bisa dites | Ya, fungsi murni | Sulit, keluaran tidak deterministik |

LLM baru masuk akal kalau ringkasannya butuh penalaran yang tidak bisa
diturunkan dari angka — misalnya mengaitkan lonjakan kunjungan dengan data
modul lain. Itu bukan kasus di sini.

**Yang dibangun:** `frontend/src/utils/ringkasanAktivitas.ts` — fungsi murni,
masuk keluar sederhana:

```ts
ringkasanAktivitas(aktivitasMingguan) // → string
```

Contoh keluaran:

> "Minggu ini tercatat 12 kunjungan & operasi. Selasa jadi hari tersibuk
> (5 pasien). Aktivitas hari ini (5) di atas rata-rata harian (4.0)."

**Batasan yang disengaja:** tidak ada klaim "naik/turun sekian persen dari
minggu lalu". Endpoint `GET /api/dashboard/statistik` hanya mengirim minggu
berjalan (lihat `backend/src/routes/dashboard.routes.js`), jadi data
pembandingnya memang tidak ada. Menuliskan tren tanpa data pembanding = mengarang.
Kalau nanti dibutuhkan, backend perlu menambah hitungan rentang −7 hari dulu.

**Cara mengetesnya:** frontend belum punya Jest, dan memasangnya hanya untuk satu
fungsi tidak sepadan. Jadi dipakai self-check yang dijalankan Node langsung:

```bash
cd frontend
node src/utils/ringkasanAktivitas.check.ts
```

Node 24 bisa menjalankan `.ts` tanpa kompiler tambahan (type stripping). Karena
impornya menyebut ekstensi `.ts` — wajib untuk resolusi ESM — `tsconfig.json`
perlu `allowImportingTsExtensions: true`.

### Pelajaran

- Sebelum memanggil model, tanyakan: apakah keluarannya bisa diturunkan
  langsung dari data yang sudah ada? Kalau ya, fungsi murni menang di semua
  aspek.
- Kejujuran data itu bagian dari desain. Lebih baik ringkasan tanpa tren
  daripada tren yang tidak punya dasar.

---

<a id="2"></a>

## 2. Bug: gestur swipe iOS mendarat di layar yang salah

**Gejala:** buka Data Pendapatan dari tile Menu di Home → tekan tombol kembali →
benar, sampai di Home. Tapi kalau kembalinya pakai gestur geser dari tepi kiri
iPhone → mendarat di halaman Profil, layar yang tidak pernah sengaja dibuka.

**Akar masalah.** Layar-layar itu tinggal di stack tab lain (`ProfilStack`,
`PasienStack`), tapi dibuka dari Home. Supaya tombol kembali mengarah ke Home,
ada hook `useMenuBack`. Masalahnya hook itu cuma bisa mencegat **dua dari tiga**
cara kembali:

| Cara kembali | Dijalankan di | Bisa dicegat JS? |
|---|---|---|
| Tombol back di header | JavaScript | Ya |
| Tombol back Android | JavaScript (`BackHandler`) | Ya |
| Gestur geser tepi kiri iOS | Native (react-native-screens) | **Tidak** |

Gestur itu diproses kode native iOS; JS baru diberi tahu setelah selesai. Jadi
tidak ada titik untuk membelokkannya di tengah jalan.

**Perbaikan.** `menuEntryScreenOptions` di `useMenuBack.ts` mematikan
`gestureEnabled` saat layar dibuka dengan param `fromHome`. Dipasang di tiga
layar sekaligus lewat satu konstanta, bukan ditambal per layar.

**Kenapa dimatikan, bukan dibelokkan.** Membelokkan hanya bisa lewat
`usePreventRemove`, dan hook itu bekerja dengan cara **menolak semua
penghapusan layar**, bukan mengalihkannya. Padahal `MainTabNavigator` memakai
`popToTopOnBlur: true` — begitu user balik ke Home, tab Profil membersihkan
stack-nya dengan cara menghapus layar itu. Pembersihan itu ikut kena tolak,
sehingga Data Pendapatan tidak pernah terbuang dan muncul lagi saat tab Profil
ditekan. Melepas kunci saat layar kehilangan fokus juga tidak bisa diandalkan
karena `freezeOnBlur: true` membekukan layar non-aktif.

**Jalur perbaikan tuntas** (belum dikerjakan): daftarkan layar-layar itu di stack
milik HomeTab sendiri, supaya pop native-nya memang mendarat di Home dan
`useMenuBack` bisa dihapus. Ditunda karena `PilihPasienHasilLab` bercabang ke
`HasilLabList` → `HasilLabDetail` → `LihatPdfLab`, jadi keempatnya harus ikut
didaftarkan ulang.

### Pelajaran

- Satu fitur bisa punya beberapa pemicu. Menambal satu pemicu meninggalkan
  yang lain tetap rusak — daftar dulu semua jalannya sebelum memilih perbaikan.
- Batas JS ↔ native itu nyata. Kalau sesuatu dijalankan native, JS tidak selalu
  punya kendali, sekalipun ada API yang kelihatannya menyediakannya.
- API yang namanya `preventRemove` memang *mencegah*, bukan *mengalihkan*.
  Baca implementasinya sebelum mengandalkannya — dalam kasus ini
  `node_modules/@react-navigation/core/src/usePreventRemove.tsx` yang
  menjelaskan bahwa `e.preventDefault()` dipanggil untuk semua penghapusan.

---

<a id="3"></a>

## 3. Data Pendapatan dihapus dari halaman Profil

Entri "Data Pendapatan" dilepas dari `settingsMenu` (`profilMock.ts`). Layar dan
route-nya **tidak** dihapus — masih dipakai kartu menu di Home.

Efek berantai yang ikut dibereskan: setelah entri itu hilang, tidak ada satu pun
item di daftar Profil yang punya tujuan navigasi. Jadi `handleMenuPress`,
konstanta `AVAILABLE_MENU_IDS`, prop `navigation`, dan style `settingsRowPressed`
ikut dibuang, dan barisnya jadi `View` biasa, bukan `Pressable` yang di-disable.

### Pelajaran

Menghapus satu baris data sering membuat kode di sekitarnya jadi tidak berguna.
Ikuti jejaknya sampai habis — sisa `Pressable` yang tidak pernah bisa ditekan
adalah kebohongan kecil di antarmuka.

---

<a id="4"></a>

## 4. Filter yang menyembunyikan diri saat scroll

**Permintaan:** baris chip filter di Pasien dan Jadwal naik ke atas saat scroll
ke bawah, muncul lagi saat scroll ke atas.

**Yang dibangun:** hook `useCollapseOnScroll`. Arah scroll dideteksi dari selisih
`contentOffset.y` antar event.

Dua parameter yang perlu dipahami:

- `MIN_DELTA = 6` — di bawah 6 piksel dianggap getaran jari, bukan perubahan
  arah. Tanpa ini barisnya kedip-kedip buka-tutup.
- `SHOW_ABOVE_Y = 24` — di dekat puncak list filter selalu ditampilkan. Di sana
  tidak ada ruang yang perlu dihemat, dan filter yang hilang saat list masih di
  atas terbaca sebagai bug.

**Iterasi 1 (salah).** Kotak filter digeser ke atas sambil tingginya menyusut.
Hasilnya kotak itu naik menimpa search bar — karena elemen yang ditulis
belakangan digambar di atas — jadi terkesan lewat **di depan** search bar.

**Iterasi 2 (benar).** Dipecah jadi dua lapis:

```
<Animated.View style={style}>        // kotak: tinggi menyusut, overflow hidden
  <Animated.View style={innerStyle}> // isi: digeser ke atas
```

Kotak luar tidak pernah bergerak; dia yang memotong. Isinya masuk ke balik tepi
atas kotak, jadi terlihat menyelinap **ke belakang** search bar.

**Soal kemulusan.** Satu `Animated.Value` tidak boleh dipakai dua driver
sekaligus, jadi dipakai dua nilai yang dijalankan berbarengan:

| Nilai | Properti | Driver | Alasan |
|---|---|---|---|
| `slide` | `transform: translateY` | native | Mulus, jalan di thread UI |
| `collapse` | `height` | JS | Layout **tidak bisa** native, selalu di JS |

**Detail yang gampang terlewat:** tinggi barisnya diukur lewat `onLayout`, bukan
angka hardcode, supaya ikut benar kalau user memperbesar font sistem. Dan jarak
atas/bawah baris filter diubah dari `margin` jadi `padding` — margin tidak ikut
terhitung di tinggi yang diukur, jadi kalau tetap margin akan tersisa celah
kosong ~16px saat baris sudah tersembunyi.

### Pelajaran

- Urutan penulisan elemen menentukan siapa digambar di atas siapa. "Di depan"
  atau "di belakang" adalah keputusan struktur, bukan keputusan style.
- Pisahkan yang bisa dianimasikan native (transform, opacity) dari yang tidak
  (apa pun yang mengubah layout: height, width, margin, padding).

---

<a id="5"></a>

## 5. Bug: list terasa nyangkut saat discroll balik

**Gejala:** setelah scroll ke bawah, mencoba scroll ke atas terasa tertahan,
kadang list seperti menolak digeser.

**Akar masalah: umpan balik.** Rantainya begini:

```
animasi jalan
  → tinggi baris filter berubah
    → tinggi viewport list ikut berubah
      → ScrollView menjepit (clamp) contentOffset-nya
        → jepitan itu masuk ke onScroll sebagai "scroll balik arah"
          → memicu animasi lawan
            → kembali ke baris 1
```

Ada pemicu kedua di dekat dasar list: menyembunyikan filter justru **menambah**
ruang scroll, sehingga konten tertarik balik ke atas — persis loop yang sama.

**Perbaikan.** Dua penjaga di `useCollapseOnScroll`:

1. `busyUntil` — arah tidak dibaca selama animasi berlangsung + 80ms sesudahnya
   (`DURATION + SETTLE`). Ini memutus rantai di titik "jepitan masuk ke
   onScroll".
2. Filter tidak disembunyikan kalau sisa jarak ke dasar list kurang dari 2×
   tingginya. Di jarak sependek itu ruang yang dihemat memang tidak berguna.

**Ceiling yang disadari.** Penyebab dasarnya tetap ada: menganimasikan tinggi
berarti mengubah frame ScrollView, dan di iOS itu bisa menghentikan deselerasi.
Perbaikan tuntasnya: header dijadikan `position: absolute` dengan `paddingTop`
di list, lalu header digeser dengan transform saja — nol re-layout. Sudah
ditandai komentar `ponytail:` di hook-nya.

### Pelajaran

- Handler `onScroll` bisa terpicu oleh perubahan yang **kita sendiri** buat,
  bukan cuma oleh jari user. Kalau handler itu juga yang menyebabkan perubahan,
  itu resep loop.
- Kalau penyebab dasarnya belum bisa dihapus, tutup mekanisme pemicunya dan
  **catat ceiling-nya** — jangan pura-pura sudah selesai.

---

<a id="6"></a>

## 6. Lengkungan header — pelajaran soal kontras

Permintaannya "inside rounded corner untuk bagian bawah header". Butuh tiga kali
salah tangkap sebelum ketemu maksudnya:

1. **Cembung** — `borderBottomRadius` di header. Bukan.
2. **Cekung dengan trik dua kotak** — kotak berwarna header ditimpa kotak
   berwarna latar yang sudutnya dibulatkan ke dalam. Bukan juga.
3. **Benar** — panel konten yang sudut atasnya membulat dan **menindih** header,
   sehingga warna header mengintip di sudut. Persis pola kartu putih di bawah
   header biru aplikasi Livin'.

**Yang dibangun:** komponen `ContentSheet`.

```
<ContentSheet shadowOpacity={...} elevation={...}>
```

Dua hal yang bikin bentuknya benar:

- **`marginTop: -SHEET_OVERLAP`** — sheet menindih header. Konsekuensinya
  padding bawah tiap header harus ditambah sebanyak tindihan itu, kalau tidak
  baris paling bawah header ketutupan.
- **Shadow menempel di sheet, bukan di header.** Sheet menindih header, jadi
  shadow yang dipasang di header justru ketutupan sheet itu sendiri. Offsetnya
  negatif (`height: -2`) supaya bayangan jatuh ke atas — yang terbaca panel
  terangkat, bukan header melayang.
- **Dua lapis View** — `overflow: hidden` (untuk memotong list di sudut
  membulat) ikut memotong shadow kalau keduanya di view yang sama. Jadi shadow
  di luar, radius + clipping di dalam.

### Pelajaran terpenting sesi ini: lengkung terbaca dari kontras, bukan radius

Sempat dicoba header berwarna `colors.primary` (#006a65, warna tray Menu di
Home) lalu dikembalikan ke skema semula. Angkanya:

| Pasangan warna | Rasio kontras | Terlihat? |
|---|---|---|
| Header #effbff vs sheet #effbff (posisi atas) | 1.00:1 | Tidak sama sekali |
| Header #ffffff vs sheet #effbff (setelah discroll) | ~1.06:1 | Praktis tidak |
| Header #006a65 vs sheet #effbff | ~6.1:1 | Jelas |

Radiusnya sama persis di ketiga baris. Yang berubah cuma warnanya. **Bentuk
hanya terbaca kalau ada beda warna yang menyangganya.** Dengan skema sekarang
yang benar-benar memisahkan header dari list adalah shadow-nya, bukan
lengkungannya.

Kalau nanti lengkungan itu mau jadi elemen yang benar-benar kebaca, header butuh
warna solid yang kontras — dan itu keputusan untuk semua screen sekaligus,
bukan satu layar. Header berwarna di satu layar saja tidak terbaca sebagai
"khas", tapi sebagai "belum selesai".

Catatan turunan waktu mencoba header teal: seluruh isi header ikut harus
berubah. Chip aktif yang tadinya `primary` jadi lenyap karena warnanya sama
persis dengan header baru, teks harus jadi putih, dan `StatusBar` perlu
`style="light"` karena setelan `auto` mengikuti mode terang/gelap perangkat,
**bukan** warna di belakangnya. Mengganti warna satu permukaan berarti meninjau
ulang semua yang berdiri di atasnya.

---

<a id="7"></a>

## 7. Perubahan teks & tampilan kecil

| Perubahan | Berkas | Catatan |
|---|---|---|
| "Tambah Pengingat" → "Kalender Pengingat" | `homeMock.ts` | `id` tetap `kalender`, routing tidak berubah |
| Subjudul Menu → "Pilihan menu untuk Anda" | `HomeScreen.tsx` | Pakai "Anda", konsisten dengan 3 teks lain di app |
| Font ringkasan statistik 12 → 14 | `HomeScreen.tsx` | `lineHeight` ikut 18 → 21 |
| Pill di belakang tombol grid/list | `HomeScreen.tsx` | `outlineVariant`, bikin 2 tombol terbaca sebagai satu kontrol dua-posisi |

Soal "Anda" vs "kamu": app ini konsisten memakai "Anda" di empat tempat. Kalau
mau diubah jadi lebih akrab, itu keputusan yang harus diterapkan ke keempatnya
sekaligus — nada yang campur aduk lebih buruk daripada nada mana pun yang
dipilih konsisten.

---

<a id="8"></a>

## 8. Berkas yang berubah

**Baru:**

| Berkas | Isi |
|---|---|
| `frontend/src/utils/ringkasanAktivitas.ts` | Fungsi ringkasan statistik mingguan |
| `frontend/src/utils/ringkasanAktivitas.check.ts` | Self-check, dijalankan Node langsung |
| `frontend/src/hooks/useCollapseOnScroll.ts` | Sembunyikan baris kontrol saat scroll |
| `frontend/src/components/ContentSheet.tsx` | Panel konten bersudut membulat + shadow |

**Diubah:**

| Berkas | Perubahan |
|---|---|
| `frontend/src/screens/HomeScreen.tsx` | Ringkasan statistik, pill toggle, teks menu |
| `frontend/src/screens/PasienListScreen.tsx` | Collapse filter + ContentSheet |
| `frontend/src/screens/JadwalOperasiKonsulScreen.tsx` | Collapse filter + ContentSheet |
| `frontend/src/screens/NotifikasiScreen.tsx` | ContentSheet |
| `frontend/src/screens/ProfilDokterScreen.tsx` | Buang menu Data Pendapatan + kode ikutannya |
| `frontend/src/navigation/useMenuBack.ts` | `menuEntryScreenOptions` (matikan gestur) |
| `frontend/src/navigation/ProfilStackNavigator.tsx` | Pakai `menuEntryScreenOptions` |
| `frontend/src/navigation/PasienStackNavigator.tsx` | Pakai `menuEntryScreenOptions` |
| `frontend/src/mocks/homeMock.ts` | Label menu kalender |
| `frontend/src/mocks/profilMock.ts` | Buang entri pendapatan |
| `frontend/tsconfig.json` | `allowImportingTsExtensions` |

---

<a id="9"></a>

## 9. Yang belum diverifikasi

Semua perubahan lolos `npx tsc --noEmit`, dan `ringkasanAktivitas.check.ts`
lolos. Tapi **tidak ada satu pun yang dites di perangkat**. Yang perlu dicek
langsung:

- [ ] Gestur geser tepi kiri di Data Pendapatan / Kalender Pengingat / Pilih
      Pasien Hasil Lab — harusnya tidak bergerak sama sekali saat dibuka dari
      Home, dan tombol back header tetap ke Home.
- [ ] Animasi filter: mulus, dan chip masuk ke *belakang* search bar.
- [ ] Scroll balik ke atas setelah scroll ke bawah — tidak lagi terasa nyangkut.
      Kalau masih, penyebabnya animasi tinggi yang mengubah frame ScrollView;
      perbaikannya header absolute (lihat bagian 5).
- [ ] Lengkung + shadow sheet di tiga layar, terutama di Android (shadow di
      Android pakai `elevation`, perilakunya beda dari iOS).
- [ ] Ringkasan statistik dengan data asli, termasuk saat minggu masih kosong.

### Kebiasaan yang layak dibawa

1. **Baca dulu, baru perbaiki.** Beberapa bug di sesi ini akarnya bukan di
   tempat gejalanya muncul.
2. **Perbaiki di satu tempat yang dilewati semua pemanggil.** Satu penjaga di
   fungsi bersama selalu lebih pendek daripada penjaga di tiap pemanggil.
3. **Catat batasan yang disengaja.** Komentar `ponytail:` di kode ini menandai
   sudut yang dipotong sadar-sadar beserta jalur naiknya — supaya "nanti" tidak
   berubah jadi "tidak pernah".
4. **Jangan mengaku selesai untuk yang belum dilihat.** Lolos `tsc` bukan berarti
   tampilannya benar.
