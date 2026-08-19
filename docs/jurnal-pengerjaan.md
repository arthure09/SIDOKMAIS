# Jurnal Pengerjaan — SIDOKMAIS

Dokumentasi harian progress magang. Diisi berdasarkan kondisi kode aktual di repo
(bukan sekadar rencana), jadi kalau ada perbedaan sama `rencana-pengembangan-aplikasi-dokter.pdf`,
versi di sini yang mencerminkan apa yang benar-benar terjadi. Update file ini tiap
ada progress baru — jangan dihapus, tinggal tambah entri.

---

## Minggu 1 — Brainstorming & Setup (14-20 Jul)

### Hari 1 (Sel, 14 Jul) — Kickoff
Review kebutuhan project dan breakdown modul awal. Artefak di luar repo.

### Hari 2 (Rab, 15 Jul) — Flowchart alur aplikasi
Flowchart login → list pasien → aksi. Artefak di luar repo.

### Hari 3 (Kam, 16 Jul) — Identifikasi fitur & wireframe kasar
Fitur final per modul diidentifikasi, wireframe kasar dibuat. Artefak di luar repo.

### Hari 4 (Jum, 17 Jul) — Desain arsitektur
ERD, daftar endpoint API, draft intent chatbot. Artefak di luar repo.

### Hari 5 (Sab, 18 Jul) — Setup project
Init repo, Docker Compose (Node app + Postgres), environment config (`.env.example`).

### Hari 6 (Min, 19 Jul) — DB schema + seed
Prisma migration untuk **11 entity** (Dokter, Pasien, DokterPasienAssignment, Ruangan,
Kunjungan, Pengguna, Notifikasi, Operasi, Penjamin, Pendapatan, AuditLog). Seed
dummy data pakai `@faker-js/faker` locale Indonesia, password di-hash pakai bcrypt.

> Koreksi 30 Jul 2026 (audit dokumentasi): entri ini sebelumnya menulis
> "10 entity" padahal daftar di dalam tanda kurungnya berisi 11 nama —
> `AuditLog` tidak ikut terhitung. Per 30 Jul jumlahnya jadi **13** setelah
> `PemeriksaanLab` + `HasilLabItem` masuk.

### Hari 7 (Sen, 20 Jul) — RBAC skeleton
`auth.middleware.js` (verifikasi JWT, attach `req.user` dari klaim token) dan
`rbac.middleware.js` (factory `authorize(...roles)`) dibangun terpisah. Endpoint
`POST /api/auth/login` dan `GET /api/auth/me` jadi yang pertama pakai ini.
**Keputusan kunci hasil review Minggu 1**: dokter READ-ONLY untuk Operasi &
Konsultasi (data ini mensimulasikan sync dari SIMRS lewat Admin) — jadi aturan
resmi di `CLAUDE.md` #1, dipakai terus di hari-hari berikutnya.
Diverifikasi: login sukses/gagal, `GET /api/me` dengan token valid/kosong/rusak/
kedaluwarsa, `authorize()` reject role salah.

---

## Minggu 2 — Modul Inti & Notifikasi (21-27 Jul)

### Hari 8 (Sel, 21 Jul) — Backend list pasien
`GET /api/pasien` (search, filter status, pagination) dan `GET /api/pasien/:id`
(detail + riwayat kunjungan). `dokterId` selalu dari `req.user` (JWT), tidak pernah
dari query/body — prinsip yang direuse terus di endpoint berikutnya.

### Hari 9 (Rab, 22 Jul) — Frontend list pasien + detail
`PasienListScreen` (search debounce, filter status, loading/error/empty state) dan
`PasienDetailScreen` (data pasien + riwayat kunjungan). Login screen dan Zustand
`authStore` (token in-memory) juga dibangun di hari ini sebagai prasyarat supaya
screen ini bisa dites end-to-end.

### Hari 10 (Kam, 23 Jul) — Backend data operasi
`GET/POST/PATCH/DELETE /api/operasi`. RBAC per-method (bukan per-route seperti
modul Pasien) — GET boleh DOKTER+ADMIN, POST/PATCH/DELETE ADMIN only, dicapai
dengan memasang `authorize()` dua kali di chain middleware. Util `auditLog.js`
dibuat dari nol (ini write endpoint pertama di app), setiap POST/PATCH/DELETE
tercatat ke tabel `AuditLog` dengan before/afterData. Percobaan DELETE operasi
yang punya `Pendapatan` terkait ditangkap (Prisma P2003) dan dibalikin 409 rapi.

Dites manual pakai curl + 2 akun DOKTER berbeda + 1 ADMIN terhadap data seed asli
— semua skenario PASS (dicatat di `docs/testing-manual.md`).

### Hari 11 (Jum, 24 Jul) — Frontend data operasi + batch besar di luar rencana
Ini hari dengan progress paling banyak, gabungan beberapa keputusan:

**Frontend Operasi (sesuai rencana, dikoreksi):** rencana awal nyebut "list, detail,
update status", tapi "update status" di-drop karena bertentangan sama aturan
read-only Hari 7. Jadinya cuma list + detail, read-only.

**Eksplorasi Figma & batch tambahan (di luar rencana awal):** ternyata ada 10 screen
yang sudah didesain (file Figma "aplikasi-dokter-dharmais"), 2 versi tiap beberapa
screen (wireframe awal vs polished). Diputuskan pakai polished kalau ada. Dibangun
dalam satu batch, murni UI + data mock (belum ada API di baliknya):
- Bottom tab navigation (5 tab: Home, Pasien, Operasi, Notifikasi, Profil) —
  gantiin struktur 1-stack sebelumnya
- `HomeScreen` — dashboard ringkasan aktivitas, pakai nama dokter asli dari
  `authStore` (bukan mock)
- `ProfilDokterScreen` — logout beneran wired ke `authStore.logout()`
- `DataPendapatanScreen` — wajib watermark "CONTOH DATA DUMMY" (aturan #3)
- `NotifikasiScreen` — list notifikasi dengan filter kategori
- `JadwalOperasiKonsulScreen` — toggle Operasi/Konsul; tab Konsul sengaja
  ditampilkan "segera hadir" karena entity Konsultasi belum ada modelnya di DB
  dan masih pending keputusan supervisor
- `DetailJadwalOperasiScreen`, `DetailPembatalanOperasiScreen` (bonus, di luar
  6 screen yang direncanakan), `DetailLaporanLabScreen` (bonus, entity-nya
  belum ada di `schema.prisma` sama sekali)

**Audit & perbaikan RBAC:** ditemukan 3 screen (Detail Jadwal Operasi, Detail
Pembatalan Operasi, Detail Laporan Lab) punya tombol aksi tulis ("Mulai Operasi",
"Ubah Jadwal", "Jadwalkan Ulang Operasi") yang bertentangan sama aturan dokter
read-only, meskipun secara teknis belum tersambung ke fungsi apapun. Diperbaiki:
tombol di 2 screen pertama dihapus total, tombol di Detail Laporan Lab diubah
jadi penanda status baca lokal ("Sudah Dibaca") yang tidak menulis data ke mana
pun. Keputusan untuk mempertahankan 2 screen bonus (Detail Pembatalan, Detail
Laporan Lab) didokumentasikan di `CLAUDE.md` sebagai catatan pending.

**Dokumentasi:** `CLAUDE.md` — Hari 8/9/10 ditandai selesai, 2 catatan pending baru.
`docs/testing-manual.md` — 3 section checklist baru untuk modul frontend UI-only
(Home/Profil/Pendapatan, Notifikasi+Lab, Jadwal Operasi+Detail+Pembatalan) —
checklist masih kosong, menunggu pengetesan manual di HP fisik.

**Belum selesai dari Hari 11:**
- Belum dites di Expo Go / HP fisik — audit sejauh ini murni baca kode
- Beberapa micro-copy (label kartu navigasi Home, label filter Data Pendapatan,
  teks menu Profil) belum dicocokkan ke Figma asli, masih pending review
  screenshot dari Arthuro

### Hari 12 (Sab, 25 Jul) — Setup Expo push notification + tabel notifications
**Belum dikerjakan sesuai jadwal aslinya.** Tabel `notifications` sudah ada di
schema/seed dari Hari 6, dan UI-nya sudah dibangun lebih dulu (bonus batch Hari 11),
tapi setup Expo push notification & endpoint backend-nya belum ada. Statusnya
"tertinggal", di-catch-up bareng Hari 13-14 (lihat catatan 28 Jul di bawah).

### Hari 13 (Min, 26 Jul) — Integrasi notifikasi
**Belum dikerjakan.** Sama seperti Hari 12 — `NotifikasiScreen` masih pakai data
mock, belum tersambung ke backend/trigger notifikasi beneran (pasien baru,
reminder H-1/H-2, perubahan jadwal).

### Hari 14 (Sen, 27 Jul) — Testing manual modul 1, 2, 4 + review Minggu 2
**Belum dikerjakan sesuai jadwalnya** — testing manual modul frontend (checklist
sudah disiapkan di `docs/testing-manual.md` tapi belum diisi) dan review Minggu 2
formal belum berlangsung tanggal ini.

---

### Catatan status per 28 Jul 2026 (Selasa)
Kalender jadwal sudah masuk Hari 15 (mulai Chatbot), tapi realisasinya masih
mentok di Hari 11 — Hari 12-14 tertinggal ~3 hari. **Hari ini ada review dengan
supervisor**, jadi workload hari ini digabung: prep materi review + mulai
nyicil catch-up Hari 12-14, bukan langsung lompat ke Chatbot (Hari 15) sebelum
Minggu 2 benar-benar kelar.

**Workload hari ini (28 Jul):**
1. Review dengan supervisor — bawa 5 poin keputusan terbuka (ERD Konsultasi,
   format data klinis, kebijakan data ke LLM pihak ketiga — ini genting karena
   Hari 15 harusnya udah mulai desain intent chatbot, 2 screen bonus di luar
   rencana, handover pasca-magang)
2. Testing manual modul 1, 2, 4 (Pasien, Operasi, Notifikasi UI) di HP fisik —
   isi checklist yang sudah disiapkan di `docs/testing-manual.md`
3. Catch-up Hari 12-13: mulai endpoint backend notifikasi + setup Expo push,
   sambungin `NotifikasiScreen` dari mock ke data asli — sejauh waktu
   mengizinkan, boleh nyambung ke hari berikutnya kalau belum kelar
4. Chatbot (Hari 15 asli) ditunda sampai poin 1-3 beres, terutama poin 1 karena
   kebijakan data ke LLM harus jelas dulu sebelum desain intent schema dimulai

### Catatan lanjutan 28 Jul 2026 — Catch-up Hari 12-13, Prioritas 1 & 2 selesai
Eksekusi `docs/prompts/hari-12-13-notifikasi.md`. Prioritas 1 (wajib) dan Prioritas 2
(bonus, waktu masih cukup) kelar; Prioritas 3 (push notification asli) sesuai
rencana ditunda ke hari berikutnya — belum disentuh sama sekali.

**Prioritas 1 — backend + wiring frontend:**
- `backend/src/routes/notifikasi.routes.js` baru: `GET /api/notifikasi` (filter
  `isRead`, pagination `page`/`limit`, `dokterId` selalu dari `req.user`) dan
  `PATCH /api/notifikasi/:id/read`. Mount di `server.js` pakai
  `authorize("DOKTER")` saja (ADMIN memang tidak butuh akses, beda dari
  `/api/pasien` dan `/api/operasi` yang izinkan keduanya).
- Notifikasi yang eksis tapi bukan milik dokter yang login sengaja dibalikin
  `404` (bukan `403`) di endpoint mark-as-read — supaya tidak bocorin
  informasi "ID ini valid tapi punya dokter lain".
- **Keputusan audit log** (diserahkan ke saya oleh prompt-nya): mark-as-read
  TETAP dicatat ke `AuditLog`, ikut aturan #4 CLAUDE.md ("semua write action")
  apa adanya alih-alih di-exclude sebagai low-stakes — alasannya didokumentasikan
  langsung sebagai komentar di `notifikasi.routes.js`.
- Frontend: `api/notifikasi.ts` (pola sama persis `api/pasien.ts`), tipe baru di
  `api/types.ts`. `NotifikasiScreen.tsx` disambungkan ke API asli — loading/error/
  empty state (pola sama `PasienListScreen`), tap notifikasi unread → mark-as-read
  optimistic dengan revert kalau request gagal. `DetailLaporanLabScreen` TETAP
  murni dekoratif (entity Laporan Lab belum ada modelnya) — entry point-nya di
  `NotifikasiScreen` sekarang eksplisit dipisah jadi 1 item statis dari mock, bukan
  hasil fetch, supaya tidak disambungin ke endpoint notifikasi beda-entity. Filter
  kategori disesuaikan ke 3 `tipe` asli di enum (`PASIEN_BARU`, `REMINDER_OPERASI`,
  `PERUBAHAN_JADWAL`, dipetakan ke label "Pasien Baru"/"Jadwal") + "Hasil Lab"
  (khusus item demo); chip "Sistem" dari mock lama di-drop karena tidak ada
  `tipe` enum yang merepresentasikannya.
- Catatan: prompt catch-up ini mengasumsikan `frontend/src/api/operasi.ts` sudah
  ada ("pola sama persis kayak `api/pasien.ts` / `api/operasi.ts`") — ternyata
  belum ada, `JadwalOperasiKonsulScreen` masih 100% mock. Di luar scope hari ini,
  tidak disentuh.

**Prioritas 2 — trigger `PERUBAHAN_JADWAL`:**
- Di `PATCH /api/operasi/:id`, kalau `status` atau `tanggalOperasi` **benar-benar
  berubah nilainya** (dibandingkan `before`, bukan cuma dikirim di body dengan
  nilai sama), dibuat 1 row `Notifikasi` baru ke `dokterId` pemilik `kunjungan`
  operasi itu — bukan ke `req.user` yang PATCH (relevan karena ADMIN yang biasanya
  ngerjain PATCH ini). Gagal bikin notifikasi tidak menggagalkan response utama
  PATCH (pola fault-tolerant sama seperti `utils/auditLog.js`).

**Verifikasi manual (curl, bukan Jest — konsisten sama pola testing modul
Operasi Hari 10):** backend dijalankan lokal terhadap DB dev asli (host Tailscale
di `.env`, ternyata reachable dari sandbox pengerjaan ini), login pakai 2 akun
dari seed (`natalia.natalia.salma` / DOKTER, `admin` / ADMIN). Semua PASS:
list ter-scope per dokter + filter `isRead` jalan, ADMIN kena `403` di
`/api/notifikasi`, mark-as-read sukses + `AuditLog` row lengkap
before→after, notifikasi dokter lain & id tidak eksis sama-sama `404`, PATCH
`catatanPreOp` doang TIDAK bikin notifikasi, PATCH `tanggalOperasi` bikin 1
row `PERUBAHAN_JADWAL` dengan `dokterId` dari kunjungan (bukan dari admin yang
PATCH). Data uji coba (perubahan sementara ke 1 row `Operasi` + 2 row
`Notifikasi` hasil tes) di-revert/dihapus lagi setelah verifikasi; row
`AuditLog` yang kebentuk dari request asli via API sengaja TIDAK dihapus
(append-only, bukan tempat buat "beres-beres").

**Belum dites:** Expo Go / HP fisik (frontend) — verifikasi sejauh ini backend
via curl ke DB dev + `npx tsc --noEmit` bersih di frontend, bukan smoke test di
device beneran. Prioritas 3 (migration `expoPushToken`, `expo-server-sdk`,
cron reminder H-1/H-2) belum dikerjakan sama sekali, sesuai rencana di prompt.

### Catatan lanjutan 28 Jul 2026 — Polish UI Home/Pasien/Jadwal (di luar rencana awal)
Sesi terpisah dari catch-up Hari 12-13 di atas — murni polish UI/UX di frontend
atas permintaan Arthuro, tanggal sama (28 Jul), tidak masuk item resmi
`rencana-pengembangan-aplikasi-dokter.pdf`. Semua perubahan hanya di
`frontend/`, tidak menyentuh backend/schema. Diverifikasi tiap langkah pakai
`npx tsc --noEmit` (bersih di akhir), belum dites di Expo Go/HP fisik.

**1. Shadow header saat discroll (semua screen dengan header fixed):**
- Hook `useTabBarDockOnScroll` (`frontend/src/hooks/`) ditambah state `scrolled`
  (threshold 2px dari atas), dipakai bareng logic dock FloatingTabBar yang
  sudah ada — satu `onScroll` yang sama, tidak perlu subscribe dua kali.
- Hook baru `useHeaderScrollShadow` buat 3 screen yang sebelumnya belum ada
  `onScroll` sama sekali di ScrollView-nya (`PasienDetailScreen`,
  `DetailJadwalOperasiScreen`, `DetailKonsulScreen`) — dipasang berdiri
  sendiri, tanpa ikut logic dock tab bar.
- Style bersama `shadows.header` ditambah di `theme/colors.ts`, dipasang
  kondisional (`scrolled && shadows.header`) ke header 11 screen: Home,
  PasienList, Notifikasi, JadwalOperasiKonsul, ProfilDokter, DataPendapatan,
  PasienDetail, DetailJadwalOperasi, DetailKonsul, DetailNotifikasi,
  DetailLaporanLab. Login & Welcome screen sengaja dilewati — headernya ikut
  scroll bareng konten, bukan fixed di atas.

**2. `PasienListScreen` — search box & navigasi list:**
- Background kotak pencarian digelapkan (`surfaceSoft` → `surfaceVariant`,
  placeholder disesuaikan ke `colors.outline`) karena kontrasnya kurang kelihatan.
- Tombol clear (ikon "x") muncul di kotak pencarian begitu user mulai
  mengetik, buat hapus cepat tanpa backspace manual.
- Floating action button "scroll to top" (komponen baru
  `components/ScrollToTopButton.tsx` + hook `hooks/useScrollToTopButton.ts`),
  muncul begitu list discroll sedikit (threshold 2px, awalnya 300px lalu
  direvisi ke 2px atas permintaan Arthuro), posisi ngambang persis di atas
  FloatingTabBar.

**3. `JadwalOperasiKonsulScreen` — sorting & navigasi list:**
- Floating "scroll to top" yang sama, dipasang per-tab (ref terpisah buat
  ScrollView Operasi vs Konsultasi, direset tiap ganti tab biar tidak nyangkut
  visible dari posisi scroll tab sebelumnya).
- Filter "Semua" sekarang mengurutkan kartu jadwal operasi & konsultasi:
  **status dulu** (Terjadwal/Berlangsung → Selesai → Batal jadi 3 kelompok),
  **tanggal terdekat ke hari ini di dalam tiap kelompok**. Keputusan urutan
  ini sempat dikonfirmasi eksplisit ke Arthuro dulu (ada 2 interpretasi
  mungkin — status-dulu vs tanggal-dulu — karena beda hasil signifikan).

**4. Identitas fallback akun ADMIN:**
- Akun `Pengguna` role ADMIN tidak punya relasi ke `Dokter` (`dokterId` null),
  jadi selama ini nama & spesialisasi yang tampil di UI jatuh ke fallback
  generik ("User" / "Spesialisasi belum diatur"). Diganti jadi "Reza Auditore"
  / "Spesialis Kelamin" di `HomeScreen` (sapaan) dan `ProfilDokterScreen`
  (nama + spesialisasi) — permintaan langsung Arthuro, murni tampilan
  frontend, tidak ada perubahan skema/data di backend.

**5. Redesign `HomeScreen`:**
- Logo header diganti dari `Logo sidokmais.png` ke
  `logo sidokmais dan tulisan.png` (versi dengan wordmark).
- Ditemukan file PNG-nya punya padding transparan ~106px di kiri-kanan (canvas
  854x292, konten asli cuma 643x184) — ini yang bikin logo kelihatan tidak
  align ke kiri sejajar teks "Halo" meskipun `paddingLeft` container sudah
  disamakan. Di-crop pakai PIL (`Image.getbbox()` + `.crop()`) langsung ke
  file asset-nya supaya bounding box Image di RN pas dengan konten visible-nya.
  Ukuran `headerLogo` disesuaikan beberapa kali ikut feedback Arthuro
  (diperbesar dulu, lalu dikecilkan lagi ke 168×48 final).
- Header sekarang pakai `Animated.Value` — background header fade dari
  `colors.background` ke putih (`colors.backgroundWhite`) plus shadow-nya,
  dianimasikan halus 200ms pas discroll (bukan langsung snap), khusus di Home
  saja (screen lain tetap warna shadow header default).
- "Ringkasan Aktivitas Hari Ini" digabung jadi satu section sama grid 4
  tombol quick action (ringkasan tampil duluan, grid di bawahnya), lalu
  background kartu (`summaryCard`) di section gabungan ini dihilangkan atas
  permintaan Arthuro (jadi section polos tanpa panel), dan ukuran tombol
  quick action + ringkasan diperbesar lagi karena sudah tidak dibatasi
  padding kartu. "Pasien Prioritas" + "Statistik Pasien Mingguan" tetap satu
  kartu terpisah, tidak ikut digabung (sesuai instruksi eksplisit — cuma
  Ringkasan yang boleh gabung sama quick action).
- Tombol bell notifikasi ditambah di pojok kanan header (navigasi ke
  `NotifikasiTab`), sejajar logo yang di kiri.

**Commit & push:** semua perubahan di atas digabung 1 commit
(`aa1c4eb feat: header scroll shadow, list scroll-to-top FAB, jadwal sort, home redesign`)
dan di-push ke `origin/main`. Push sempat butuh override manual
(`-c http.postBuffer=524288000 -c http.version=HTTP/1.1`, non-persisten, tidak
mengubah `~/.gitconfig`) karena pola HTTP 400 yang sudah pernah ketemu
sebelumnya di repo ini pas ada perubahan asset binary (PNG logo).

---

## Minggu 3 — Hasil Lab & Dashboard Kinerja (28 Jul-3 Ags)
Chatbot digeser keluar dari minggu ini (keputusan Arthuro, 29 Jul 2026), diganti
2 fitur dummy-data: Cari Hasil Lab (by No. RM) dan Dashboard Kinerja Dokter.
Scope chatbot lama (intent schema, read/write-intents, validation layer,
konfirmasi, audit log integration) jadi buffer/nice-to-have, belum pasti
dikerjakan sebelum akhir magang — lihat `CLAUDE.md`.

### Hari 15 (Sel, 28 Jul) — Catch-up Notifikasi
Lihat catatan "Catch-up Hari 12-13" di atas (dikerjakan tanggal yang sama,
28 Jul, sesuai jadwal asli).

### Hari 16 (Rab, 29 Jul) — Desain & struktur data Hasil Lab
Scope hari ini sengaja dibatasi ke desain & data saja (bukan screen — itu
Hari 17, bukan navigasi — itu Hari 18), sesuai
`docs/prompts/hari-16-tugas-hari-ini.md`.
- `frontend/src/mocks/labMock.ts` dibuat: type `HasilLabItem`,
  `KelompokHasilLab` (field `laboratorium`, dummy murni — "Laboratorium A/B/C",
  belum ada nama unit lab asli), `HasilLabPasien`, dan `hasilLabByNorm` isi 3
  pasien dummy (No. RM 10-digit numerik, pola sama seperti `norm` di
  `prisma/seed.js`, bukan format hyphenated), tiap pasien 2 kelompok, tiap
  kelompok 1-3 item. Entry pasien pertama (`9821140512`, Tn. Ahmad Subarjo)
  reuse teks dari `notifikasiMock.ts` → `laporanLabDetail`, 4 item lab lama
  dipecah jadi 2 kelompok ("Laboratorium A" / "Laboratorium B") biar gak
  dobel karang teks. File ini belum dipakai di layar manapun — itu wajar,
  konsumennya (`CariHasilLabScreen`) baru dibuat Hari 17. Diverifikasi
  `npx tsc --noEmit` bersih.
- Desain visual: prompt Stitch di `docs/prompts/desain-hasil-lab-stitch.md`
  sudah siap dipakai (belum ditempel ke Stitch oleh AI — itu langkah manual
  Arthuro di tool Stitch, di luar akses Claude Code).
- Rencana navigasi (`fitur-cari-hasil-lab.md` bagian 3) sudah dibaca ulang:
  tab `NotifikasiTab` tetap terdaftar sebagai route, cuma difilter dari
  render tombol `FloatingTabBar.tsx` (bukan dihapus dari navigator) — biar
  bel di Home (`navigation.navigate('NotifikasiTab')`) tetap jalan tanpa
  restrukturisasi navigator. Dieksekusi Hari 18, belum ada perubahan kode
  navigasi hari ini.
- Pertanyaan buat supervisor (belum dijawab, dibawa ke pertemuan berikutnya):
  1. Daftar laboratorium yang benar-benar ada di RS Dharmais (nama resmi unit
     lab) — buat ganti string dummy `laboratorium` di `labMock.ts`.
  2. Metrik apa yang relevan buat Dashboard Kinerja Dokter (jumlah pasien
     aktif? konsultasi/operasi selesai? ketepatan jadwal dari data
     `PERUBAHAN_JADWAL`? komposisi kasus?).
  3. (Opsional) Konfirmasi ulang status chatbot — tetap buffer akhir magang
     atau resmi dicoret dari scope.

### Catatan lanjutan 29 Jul 2026 — Polish UI header animasi, search jadwal, Home quick action 6-tombol
Sesi terpisah dari scope resmi Hari 16 di atas (labMock.ts/desain), tapi
digabung ke commit yang sama karena sama-sama 29 Jul — murni polish UI/UX
frontend di luar `docs/prompts/hari-16-tugas-hari-ini.md`, tidak menyentuh
backend/schema. Diverifikasi `npx tsc --noEmit` bersih, belum dites di Expo
Go/HP fisik.

**1. Hook `useAnimatedHeaderFade` diekstrak dari `HomeScreen`:**
- Logic animasi header fade (background `colors.background` → `backgroundWhite`
  + shadow + elevation, 200ms, dibuat 28 Jul khusus buat Home) dipindah dari
  inline `Animated.Value`/`useEffect`/interpolate di `HomeScreen.tsx` ke hook
  reusable `frontend/src/hooks/useAnimatedHeaderFade.ts`.
- Dipasang juga di `NotifikasiScreen` dan `JadwalOperasiKonsulScreen`
  (sebelumnya header statis, cuma `scrolled && shadows.header`), dan
  `PasienListScreen` ikut dipindah ke hook yang sama gantiin pola statis
  yang sama. Jadi 4 screen (Home, Notifikasi, Jadwal Operasi/Konsul, Pasien)
  sekarang share 1 implementasi animasi fade header, bukan re-implement
  masing-masing.

**2. `JadwalOperasiKonsulScreen` — search box by nama/No. RM:**
- State `search` baru, filter client-side by `pasien.nama`/`pasien.norm`
  (case-insensitive) dipasang di atas filter status yang sudah ada, sebelum
  `sortByStatusThenNearestDate` — jadi hasil search ikut tersortir juga
  (status dulu, tanggal terdekat di dalam grup), bukan cuma numpuk di akhir.
  Berlaku di kedua list (Operasi & Konsultasi).
- Judul screen ("Jadwal Operasi"/"Jadwal Konsultasi") dihapus dari header
  buat kasih tempat search box; chip filter status dipindah dari `flexWrap`
  ke `ScrollView` horizontal karena header makin sempit vertikal dengan
  tambahan search box.

**3. `NotifikasiScreen` — status baca lokal untuk item demo Laporan Lab:**
- Item demo Laporan Lab bukan entity API asli (`DetailLaporanLabScreen`
  masih murni dekoratif, entity-nya belum ada modelnya di `schema.prisma` —
  catatan lama di `CLAUDE.md`), jadi tidak bisa panggil
  `PATCH /api/notifikasi/:id/read` buat dia. State `labDemoRead` lokal
  ditambah supaya titik unread-nya hilang begitu item dibuka (navigasi ke
  `DetailLaporanLab`), tanpa mencoba nulis ke endpoint notifikasi
  beda-entity.

**4. `DetailNotifikasiScreen` — pill status baca dapat state aktif:**
- Pill "Sudah Dibaca"/"Belum Dibaca" sebelumnya selalu abu-abu
  (`colors.onSurfaceVariant`) apapun statusnya. Sekarang berubah warna
  primary (background `primaryContainer`, teks/ikon `colors.primary`) kalau
  `isRead` true — konsisten sama badge/dot unread yang sudah ada di list
  `NotifikasiScreen`.

**5. `HomeScreen` — quick action grid 4→6 tombol, formasi 3x2:**
- 2 kartu baru ditambah ke `navigasiCards` (`homeMock.ts`): "Data Pendapatan"
  dan "Cari Hasil Lab".
- Bentuk kartu diganti dari kotak besar (shadow per-kartu, label besar) jadi
  tombol bulat (lingkaran ikon 64px dengan shadow sendiri, label kecil di
  bawah) supaya 3 kartu muat sebaris — formasi 3x2 gantiin 2x2.
- "Data Pendapatan" disambungin nested navigate `ProfilTab → DataPendapatan`
  — perlu ubah tipe `ProfilTab` di `navigation/types.ts` dari `undefined`
  jadi `NavigatorScreenParams<ProfilStackParamList> | undefined` supaya bisa
  passing target screen di nested stack.
- "Cari Hasil Lab" masih non-navigable (masuk `NAVIGABLE_CARD_IDS` yang
  di-exclude, sama seperti "Chatbot") — layar tujuannya (`CariHasilLabScreen`)
  belum ada, itu scope Hari 17.
- Logo header dikecilkan lagi (168×48 → 112×32, ukuran final sebelumnya di
  28 Jul) buat kasih ruang tambahan ke header yang makin padat.

### Hari 17 (Kam, 30 Jul) — Fondasi data modul lab (backend)
**Menyimpang dari rencana:** rencana awal Hari 17 adalah `CariHasilLabScreen`.
Diganti jadi fondasi data backend karena membuat screen kedua di atas mock
(`labMock.ts`) hanya menghasilkan 2 screen yang sama-sama tidak bisa dites
end-to-end. Urutan dibalik: data (H17) → endpoint (H18) → screen (H19).
Laporan lengkap versi non-teknis: `docs/laporan-harian/day-17-30-juli-2026.md`.

**Schema & migration:**
- 2 model baru: `PemeriksaanLab` (order lab) + `HasilLabItem` (parameter per
  order, cascade delete dari parent). 2 enum baru: `StatusPemeriksaanLab`
  (PENDING/COMPLETED/CANCELLED), `FlagHasilLab` (RENDAH/NORMAL/TINGGI/ABNORMAL).
- `NotifikasiTipe.HASIL_LAB` + field `relatedId`/`relatedType` di `Notifikasi`
  (polymorphic ringan — supaya notifikasi bisa nunjuk ke entity apa pun tanpa
  nambah kolom FK tiap ada modul baru).
- Migration `20260730024026_add_lab_module`. Total model jadi 13.
- `backend/src/constants/lab.js` baru: `LAB_KATEGORI` (6 kategori), satu sumber
  kebenaran buat seed + validasi endpoint H18.

**Keputusan schema (detail alasan di laporan harian):**
1. 2 entitas, bukan 1 — 1 order → banyak parameter.
2. `pasienId` wajib, `kunjunganId` nullable; **hak akses lewat
   `DokterPasienAssignment`, bukan `kunjungan.dokterId`**. Alasan klinis:
   pasien onkologi lintas dokter, order sering diminta dokter lain (dokter
   jaga), jadi hak akses lewat kunjungan bikin dokter PJ tidak bisa lihat hasil
   lab pasiennya sendiri. `dokterPemintaId` disimpan sebagai info, bukan
   penentu akses. **Masih asumsi — belum dikonfirmasi supervisor.**
3. `kategori` String, bukan enum — daftar resmi RS belum ada; arah String→enum
   lebih murah daripada sebaliknya.
4. `nilai` String, bukan Decimal — banyak hasil kualitatif ("Reaktif", "3+",
   "Tidak ditemukan sel ganas").
5. `flag` diturunkan dari perbandingan nilai vs rujukan yang sama dipakai
   generate nilainya, bukan diacak terpisah. Rujukan per jenis kelamin untuk
   Hb/Hematokrit/Eritrosit/Kreatinin; tumor marker perempuan (CA 15-3, CA-125)
   tidak pernah muncul di pasien laki-laki.

**Seed lab + hygiene seed:**
- `seedPemeriksaanLab()` 2-pass: pass 1 bangun spec JS, lalu
  `ensureMinimumKunjunganNull` (~20%), `ensureMinimumCrossDokter` (>=3),
  `ensureMinimumPending` (>=1) memaksa distribusi wajib; pass 2 baru insert ke
  DB. Ini supaya proporsi tidak bergantung murni pada probabilitas acak.
- `faker.seed(20260730)` dipasang paling awal di `main()`.
- **Temuan:** `pickOne`/`pickMany` masih pakai `Math.random()`, jadi
  `faker.seed()` tidak benar-benar mengontrol seluruh keacakan. Diperbaiki ke
  `faker.helpers.arrayElement`/`arrayElements`. Ini jenis bug yang verifikasi
  determinismenya lolos di permukaan (jumlah baris sama) tapi isinya beda.
- Guard username collision di `seedPengguna`, `dedupeKataBerurutan()` buat
  quirk `fakerID_ID.person.fullName()` yang ~25% menggandakan kata pertama
  ("Indira Indira Jelita"), pemisahan `JENIS_TINDAKAN_PEREMPUAN` dari daftar
  netral (Mastektomi tidak muncul di pasien laki-laki).

**Verifikasi:** 37 `PemeriksaanLab`, 75 `HasilLabItem`; status COMPLETED 24 /
PENDING 4 / CANCELLED 9; rata-rata 3,13 item per order COMPLETED (2,03 kalau
dibagi seluruh order); `kunjunganId` null 8 (22%); 6 order cross-dokter;
`dokterPemintaId` null 7; flag RENDAH 3 / NORMAL 56 / TINGGI 8 / ABNORMAL 8;
**0 dari 24 order COMPLETED yang panelnya tidak penuh**. Seed dijalankan 3×
berturut-turut, username akun identik (`admin`, `indira.jelita`,
`irma.febrianti`).

**Kendala:** Tailscale sempat mati sehingga migration gagal (Prisma tidak bisa
reach DB) — disambung ulang, migration dijalankan lagi, bukan bikin migration
baru.

**Belum dikerjakan / catatan:**
- Pola `Math.random()` yang sama **masih ada** di
  `backend/prisma/seed-kunjungan-operasi.js:67,71` — belum ikut diperbaiki.
  Tidak dipakai di alur seed utama, tapi berpotensi jadi jebakan yang sama.
- Kualitas data lab belum realistis klinis (kopling Hb–Hematokrit–Eritrosit,
  arah flag untuk pasien pasca-kemo) — dijadwalkan Day 21, lihat
  `docs/keputusan-tertunda.md`.
- Audit dokumentasi 6 klaim stale — lihat bagian "Koreksi dokumentasi" di
  bawah.

### Hari 18 (Jum, 31 Jul) — Endpoint backend modul lab
**Catatan tanggal:** dikerjakan bareng Hari 19 & 21 dalam satu commit/sesi
tanggal 4 Agustus 2026 (`3dd8f02`, 09:31 WIB) — lihat "Catatan sesi gabungan"
di bawah Hari 21 untuk kenapa 3 hari jadwal jadi 1 sesi eksekusi.

`backend/src/routes/lab.routes.js` baru: `GET /api/lab` (list ringkasan hasil
lab per pasien, wajib query `pasienId`, pagination `page`/`limit`, opsional
filter `dariTanggal`/`sampaiTanggal` yang baru menyusul di Hari 22) dan
`GET /api/lab/:id` (detail lengkap satu `PemeriksaanLab` + seluruh
`hasilLabItem` terkait). Scoping akses pakai `dokterPunyaAksesPasien()` —
berbasis `DokterPasienAssignment`, BUKAN `kunjungan.dokterId` — sesuai asumsi
yang ditulis di `docs/pertanyaan-supervisor-modul-lab.md` bagian C1. Guard
"Akun ini tidak terhubung ke data dokter" dipasang untuk role DOKTER yang
`dokterId`-nya null (pola sama seperti `pasien.routes.js`). Response detail:
`hasilLabItem` sengaja nullable (bukan array kosong) kalau order belum ada
hasilnya — didokumentasikan sebagai komentar di kode karena belum
dikonfirmasi Mas Fauzi apakah SIMRS asli simpan data terstruktur per-parameter
atau cuma dokumen (PDF). Di-mount di `server.js`.

### Hari 19 (Sab, 1 Ags) — Frontend modul lab
Alur "Cari Hasil Lab" (pilih pasien → list ringkasan → detail parameter →
lihat PDF) — 4 screen baru:
- `PilihPasienHasilLabScreen` — pilih dari daftar pasien yang di-assign ke
  dokter yang login.
- `HasilLabListScreen` — list ringkasan `PemeriksaanLab` satu pasien.
- `HasilLabDetailScreen` — detail parameter (`hasilLabItem`) satu pemeriksaan.
- `LihatPdfLabScreen` — buka PDF lewat WebView; PDF-nya dummy statis
  (`frontend/assets/dummy.pdf`), karena integrasi berkas PDF asli dari SIMRS
  masih pending (lihat `docs/keputusan-tertunda.md` item 3).

`frontend/src/api/lab.ts` (pola sama `api/pasien.ts`, pakai `apiFetch<T>()`)
+ tipe baru di `api/types.ts`. Home quick action "Cari Hasil Lab" (kartu id
`hasillab`, ditambah 29 Jul tapi sebelumnya di-exclude dari
`NAVIGABLE_CARD_IDS`) sekarang aktif, navigate ke `PasienTab` →
`PilihPasienHasilLab`. `frontend/src/mocks/labMock.ts` (dibuat Hari 16)
sekarang **0 importer** — alur di atas konsumsi endpoint asli dari awal,
bukan migrasi dari mock. `npx tsc --noEmit` bersih.

**Catatan supaya tidak tertukar:** ini alur BARU dan terpisah dari
`DetailLaporanLabScreen` (screen dekoratif di tab Notifikasi, dibangun Hari
11) — screen itu masih murni pakai `frontend/src/mocks/notifikasiMock.ts`
(`laporanLabDetail`), **tidak ikut disambungkan** di sini walau namanya mirip.

**Smoke test Expo Go / HP fisik: PASS.** Dikonfirmasi langsung oleh Arthuro
5 Agustus 2026 — sebelumnya tidak ada jejak pengetesan device di commit/kode,
jadi ini ditanyakan eksplisit alih-alih diasumsikan dari histori commit.

### Hari 20 (Min, 2 Ags) — Dashboard Kinerja Dokter
**Belum dikerjakan.** `git log` tidak menemukan satu pun commit yang
menyinggung "dashboard" atau "kinerja" — tidak ada kode, desain, maupun
progress lain yang tercatat. Ditulis apa adanya di sini (bukan di-skip diam-
diam) supaya jurnal tidak menyesatkan, mengikuti prinsip yang sama dengan
temuan Hari 21 di bawah (kualitas data yang sempat tidak konsisten tanpa
tercatat jelas sebelumnya).

### Hari 21 (Sen, 3 Ags) — Seed: kopling hematologi + arah flag pasca-kemoterapi
Menyelesaikan item 5 & 6 di `docs/keputusan-tertunda.md` (dijadwalkan Day 21
sejak 30 Jul) — `backend/prisma/seed.js`:
- `PARAM_KORELASI_HB` (baris ~382) = `["Hemoglobin", "Hematokrit",
  "Eritrosit"]`. `buildHematologiItems()` (baris ~451) menghitung SATU
  `hbGroupSeverity` (abnormal?/arah/magnitude) per pasien, lalu memakainya
  buat ketiga parameter itu lewat `buildSeverityDrivenItem()` (baris ~470) —
  bukan diacak independen per parameter seperti sebelumnya. Leukosit &
  Trombosit (beda lini sel darah) tetap independen lewat
  `buildKuantitatifItem()`, tapi arahnya tetap ikut skew kemoterapi di bawah.
- `riwayatKemoterapi` di-derive per pasien dari regex `/kemoterapi/i`
  (`RIWAYAT_KEMOTERAPI_REGEX`) terhadap `Kunjungan.diagnosa` — tidak ada
  field khusus riwayat kemoterapi di schema.
- `pickArahAbnormal()`: kalau pasien punya riwayat kemoterapi dan parameter
  punya opsi arah RENDAH, 85% arahnya RENDAH — mencerminkan sitopenia
  pasca-kemo (Hb/leukosit/trombosit cenderung turun), bukan skew ke TINGGI
  atau random 50/50 seperti sebelumnya.
- `flag` tetap SELALU dihitung dari nilai vs rujukan yang sama dipakai
  generate nilainya (tidak diacak terpisah) — properti ini sudah benar sejak
  Hari 17, tidak berubah di sini.

**Catatan sesi gabungan:** Hari 18, 19, dan 21 di atas — walau tercatat 3
hari terpisah di jadwal (31 Jul, 1 Ags, 3 Ags) — kronologisnya semuanya masuk
SATU commit (`3dd8f02`, Selasa 4 Agustus 2026 09:31 WIB), bukan 3 sesi kerja
terpisah. Jadwal Day 18-21 mundur total dari tanggal aslinya dan baru
dieksekusi 4 Agustus (kecuali Hari 20/Dashboard Kinerja yang tidak pernah
dieksekusi sama sekali — lihat entrinya di atas).

## Minggu 4 — Hardening, Testing, Dokumentasi (4-10 Ags)

### Hari 22 (Sel, 4 Ags) — Filter tanggal, bug fix, RBAC hardening
Dua commit terpisah, sama-sama 4 Agustus, sesudah sesi pagi Hari 18/19/21
di atas.

**`d1c6116` (12:04 WIB) — filter tanggal Hasil Lab + fix crash date picker +
fix timezone WIB:**
- Filter tanggal permintaan (dari/sampai) di `HasilLabListScreen` — pola
  draft/apply lewat modal + tombol "Terapkan". Backend `GET /api/lab` terima
  query `dariTanggal`/`sampaiTanggal`, difilter lewat `tanggalPermintaan`.
  Dependency baru `@react-native-community/datetimepicker` 8.4.4.
- Fix crash: `DateTimePicker` sebelumnya dikasih `value={new Date()}` inline
  (timestamp baru tiap render), dikombinasikan dengan `onChange` yang belum
  di-`useCallback` — kombinasi ini bikin re-layout native tanpa henti di iOS
  (watchdog kill, tanpa error JS kelihatan) dan dialog Android menumpuk.
  Diperbaiki: `fallbackDate` stabil lewat `useState`, `onChange` dibungkus
  `useCallback`.
- Fix timezone: `backend/src/routes/lab.routes.js` — frontend kirim
  `dariTanggal`/`sampaiTanggal` sebagai `"YYYY-MM-DD"` (tanggal kalender
  lokal WIB), tapi `Date.parse` membaca string tanpa jam sebagai UTC 00:00,
  jadi batas hari meleset +7 jam. Diperbaiki pakai `WIB_OFFSET_MS` (baris
  ~45) supaya batas hari jatuh tepat tengah malam WIB. Aplikasi diasumsikan
  satu zona waktu (WIB) — dicatat eksplisit sebagai komentar kalau nanti
  perlu per-user timezone.

**`e13efbe` (14:48 WIB) — RBAC hardening (task resmi Day 22) + 2 perubahan
lab tambahan:**
- **RBAC hardening:** `dokterPunyaAksesPasien()` dipindah dari lokal
  `lab.routes.js` ke util bersama `backend/src/utils/aksesPasien.js`, dipakai
  juga di `kunjungan.routes.js` dan `operasi.routes.js` (list + detail) —
  sebelumnya cuma dipakai `pasien.routes.js`/`lab.routes.js`. Efeknya: dokter
  yang di-assign ke pasien lewat `DokterPasienAssignment` sekarang bisa lihat
  kunjungan/operasi pasien itu walau `kunjungan.dokterId` tercatat dokter
  lain. Guard "Akun ini tidak terhubung ke data dokter" (sebelumnya cuma di
  `pasien.routes.js`/`lab.routes.js`) sekarang dipasang merata, termasuk di
  `GET /api/kunjungan/:id` dan `GET /api/operasi/:id`. Basis akses ini
  didokumentasikan sebagai "sudah dikonfirmasi (Day 22, 2026-08-04)" langsung
  di komentar `aksesPasien.js` — lihat juga update terkait di
  `docs/pertanyaan-supervisor-modul-lab.md` bagian C1.
- `GET /api/operasi/:id` tidak lagi meng-`include` `pendapatan` (data
  finansial `tarifTotal`/`jumlahDiterimaDokter`) — tidak dipakai frontend
  sama sekali, sebelumnya ikut ter-embed tanpa perlu.
- `backend/package.json`: `testPathIgnorePatterns` ditambah
  `"\\.manual\\.js$"` supaya `verify-auth.manual.js` (script manual, bukan
  test Jest) tidak lagi ikut ke-run `npm test`.
- **Bukan bagian RBAC, dibundel commit yang sama:** `GET /api/lab` sekarang
  cuma balikin pemeriksaan berstatus `COMPLETED` (sebelumnya exclude
  `CANCELLED` doang, `PENDING` masih ikut muncul) — supaya list Hasil Lab
  pasien cuma isi laporan yang memang sudah ada; badge/status di UI
  (`STATUS_LABEL`, `bisaDilihat`, `statusText`) dicabut dari
  `HasilLabListScreen` karena jadi tidak perlu lagi. `LihatPdfLabScreen`:
  `FloatingTabBar` disembunyikan (slide-down) selagi screen ini fokus lewat
  hook baru `useHideTabBar()` (`frontend/src/hooks/useHideTabBar.ts`) +
  `tabBarStore.hidden`, balik lagi begitu blur — screen PDF full-bleed jadi
  tidak ketutupan tab bar.

**Review kode menyeluruh (`docs/analisa/review-kode-day-22-4-agustus-2026.md`):**
dipicu laporan aplikasi keluar sendiri di filter tanggal Hasil Lab. Menelusuri
kode sumber (bukan crash log — mesin pengembangan tidak punya `adb`/Xcode
penuh, pengetesan device lewat Expo Go) menemukan akar masalah persis sama
dengan yang sudah diperbaiki di commit `d1c6116` di atas: `value` picker jatuh
ke `new Date()` inline (timestamp baru tiap render) dikombinasikan `onChange`
tanpa `useCallback` — di iOS memicu re-layout native tanpa henti (watchdog
kill), di Android numpuk dialog + promise menggantung (`DateTimePickerAndroid.
open()` tidak ada penjaga dialog yang sudah terbuka). Turut mengonfirmasi versi
`@react-native-community/datetimepicker` 8.4.4 sudah benar (persis
`bundledNativeModules.json` Expo SDK 54) — dugaan awal soal versi salah
gugur. Audit ini juga memetakan kode mati/struktur lewat pencarian importer,
bukan cuma grep permukaan (satu kata kunci `scale` sempat terlihat dipakai di
15 tempat, ternyata semuanya `Animated.Value`/`transform` lokal, bukan
importer `theme/responsive.ts`).

**Tindak lanjut audit — dikerjakan 5 Agustus 2026** (item "disarankan"/
"opsional" dari dokumen review, ditunda satu hari dari Day 22):
- Hapus kode mati nol-consumer: `frontend/src/mocks/labMock.ts` (89 baris),
  dependency `react-native-vector-icons` + `expo-blur` (`npm uninstall`,
  bukan cuma dicabut manual dari `package.json` — biar lockfile konsisten),
  4 dari 6 export `frontend/src/theme/responsive.ts` (`verticalScale`, `wp`,
  `hp` dihapus total; `scale` tetap ada tapi jadi fungsi privat karena
  `moderateScale`/`ms` — satu-satunya export yang beneran dipakai (7 layar) —
  butuh dia secara internal).
- Penjaga respons basi di `HasilLabListScreen.tsx`: `load()` sekarang terima
  `isCancelled(): boolean` (closure ke flag `cancelled` di `useEffect`, DICEK
  ULANG setelah tiap `await` — bukan dikirim sebagai value biasa yang beku di
  waktu pemanggilan), supaya ganti filter tanggal cepat-cepat tidak menampilkan
  hasil dari request yang lebih lama.
- `npx tsc --noEmit` diverifikasi ulang bersih setelah seluruh perubahan di
  atas.
- **Koreksi `CLAUDE.md`:** baris `PaperProvider` "tidak dilepas karena
  berisiko dan tidak mendesak" diluruskan — audit ini membuktikan provider itu
  nol consumer, jadi alasan sebenarnya cuma "tidak mendesak", bukan "berisiko".
- **Belum dikerjakan dari dokumen review** (disengaja, bukan lupa — item ini
  eksplisit ditandai "sengaja TIDAK dikerjakan" di dokumennya sendiri, bagian
  9): konsolidasi 4 hook scroll yang tumpang tindih, `src/utils/date.ts`
  buat `formatTanggal` yang ditulis ulang di banyak layar, layer state per
  modul, pagination Hasil Lab di sisi klien, pelepasan `PaperProvider`.
  Alasannya sama semua: refactor tanpa nambah fungsi di minggu yang tujuannya
  stabilisasi, risiko regresi > manfaat dengan sisa waktu magang segini.
- `docs/testing-manual.md` ditambah kasus tepi regresi (buka picker lalu
  diamkan, pilih tanggal di batas hari, tombol X tidak ikut buka modal,
  Reset draft tidak menembus pola apply, ganti filter cepat-cepat) — lihat
  section "Modul: Hasil Lab (Day 18-22)" → "3. Regresi — review kode Day 22".

### Hari 23 (Rab, 5 Ags) — Verifikasi audit log
Eksekusi `docs/prompts/hari-23-audit-log-verifikasi.md`. Beda dari audit
sebelumnya (yang cuma baca kode buat pastikan `logAudit()` DIPANGGIL): kali
ini isi baris `AuditLog` yang beneran tersimpan di DB dev dicek langsung —
curl ke backend lokal (`npm run dev`, terhubung ke DB dev via Tailscale
`100.109.84.118`, sama seperti pola verifikasi Hari 10/12-13), lalu baca
hasilnya lewat Prisma, bukan cuma percaya response API-nya.

**Cek statis (grep semua `backend/src/routes/*.routes.js`):** 4 write
handler ketemu, 3 di `operasi.routes.js` (create/update/delete) + 1 di
`notifikasi.routes.js` (mark-as-read) — semuanya manggil `logAudit()`.
`pasien.routes.js`/`kunjungan.routes.js`/`lab.routes.js`/`auth.routes.js`
nol write handler, konsisten sama status read-only masing-masing modul.

**Temuan — 1 gap ketemu, dikonfirmasi hidup lewat curl bukan cuma baca
kode:** trigger notifikasi `PERUBAHAN_JADWAL` (`prisma.notifikasi.create` di
dalam `PATCH /api/operasi/:id`, `operasi.routes.js` baris ~329, ditambahkan
Hari 15) TIDAK dipanggil `logAudit()`. Dites langsung: PATCH `tanggalOperasi`
sungguhan bikin row `Notifikasi` baru di DB, tapi 0 baris `AuditLog` untuk
`entityType: "Notifikasi"` dengan `entityId` notifikasi itu. Secara harfiah
ini write action yang tidak tercatat — melanggar CLAUDE.md aturan #4. Sesuai
batasan task ini (verifikasi, bukan perbaikan), **belum diperbaiki** — perlu
keputusan dulu: apakah notifikasi hasil trigger otomatis butuh baris audit
sendiri, atau cukup ter-cover baris UPDATE `Operasi` yang jadi penyebabnya
(yang sudah menangkap seluruh before/after perubahan operasinya).

**Verifikasi isi baris `AuditLog` (login `admin`/`admin123` + akun DOKTER
`putra.tasdik`, terhadap 1 `Operasi` uji yang dibuat khusus buat tes ini):**
CREATE (`beforeData=null`, `afterData` lengkap), UPDATE Operasi
(`beforeData`/`afterData` sama-sama lengkap, bukan cuma diff), UPDATE
Notifikasi lewat mark-as-read (`isRead` false→true, `actorId` cocok akun
DOKTER yang PATCH — bukan ADMIN yang PATCH operasinya), DELETE
(`beforeData` record lengkap, `afterData=null`) — semua PASS, `actorId`/
`actorRole` di tiap baris dicocokkan manual ke akun yang benar-benar login.
Data uji (`Operasi` + `Notifikasi` hasil trigger) dihapus lagi setelah
verifikasi; 4 baris `AuditLog` yang terbentuk dari request asli SENGAJA
tidak dihapus (append-only, pola sama Hari 12-13).

**Fault-tolerance `utils/auditLog.js`:** dikonfirmasi lewat baca kode
(`try/catch` + `console.error`, tidak ada `throw` ulang) — tidak
disimulasikan gagal beneran, dianggap tidak sepadan buat scope hari ini.

**`GET /api/me`:** dikonfirmasi eksplisit bukan write action (cuma
`res.json(req.user)`), tidak ada `logAudit()` di situ — memang seharusnya
begitu.

**Temuan sampingan (di luar scope inti):** password seed akun `admin`
TERNYATA **bukan** `Sidokmais#2026` seperti diklaim `docs/testing-manual.md`
dan `console.log` di `seed.js` sendiri ("password sama untuk semua") —
`seed.js` bikin hash terpisah dari `"admin123"` khusus buat ADMIN. Ketemu
pas verifikasi ini gagal login 401 sebelum nyoba `admin123`. Belum
diperbaiki (di luar scope task ini, cuma dicatat).

Detail lengkap tiap item: `docs/testing-manual.md` section "Modul: Audit
Log — verifikasi menyeluruh (Hari 23, 5 Ags 2026)".

Hari 24-28: belum dimulai. Sisa scope: integration testing, bug fixing
(2 round), user documentation, final review. (Ditambah 1 item baru dari
temuan hari ini: keputusan soal audit log trigger `PERUBAHAN_JADWAL`, dan
koreksi password seed ADMIN di dokumentasi.)

### Catatan lanjutan 5 Ags 2026 — Endpoint statistik dashboard Home + Pasien Prioritas (Bagian B, di luar jadwal aslinya)
Sesudah Hari 23 (audit log, pagi — lihat entri di atas) selesai, lanjut ke
"Bagian B — Statistik Home" dari `docs/prompts/prompt-gabungan-3-fitur.md`.
Tidak ada di jadwal Minggu 4 CLAUDE.md, tapi secara substansi mengisi
kebutuhan "Dashboard Kinerja Dokter" yang tertunda dari Hari 20 (lihat
catatan silang di entri 6 Ags di bawah). 2 commit sore harinya:

- `ad0e86c` (11:48) — `GET /api/dashboard/statistik` versi inti:
  `pasienAktif`, `operasiHariIni`, `konsulHariIni`, `aktivitasMingguan`.
  Mengganti mekanisme lama di frontend (fetch list dengan
  `RINGKASAN_FETCH_LIMIT=100` lalu filter+hitung di client, yang undercounted
  kalau dokter punya >100 operasi/kunjungan) dengan `COUNT` langsung di DB.
  Scoping akses pasien pola sama `operasi.routes.js`/`kunjungan.routes.js`
  pasca-hardening Day 22 (`OR: [{dokterId}, {pasien.assignments.some}]`).
  Rentang tanggal dikonversi ke kalender WIB (`getRentangHariIniWIB`/
  `getRentangMingguIniWIB`, offset UTC+7 tetap/tidak DST-aware). ADMIN dapat
  semua `0` + `adminCatatan` penjelas — keputusan desain eksplisit (endpoint
  scoped "statistik SAYA sebagai dokter yang login"), bukan agregat
  lintas-dokter.
- `ae8c77a` (15:53) — nambah `pasienPrioritas` (3 jadwal Operasi/Kunjungan
  `SCHEDULED` terdekat ke depan, top-N per tabel digabung+disortir+dipotong
  di JS) + rapi-rapi UI: hapus badge notifikasi merah & tombol bel di Home
  (tab Notifikasi sudah dipindah ke akses lewat bel di header), empty-state
  buat `pasienPrioritas` kosong, lantai minimum 6% di bar chart mingguan
  supaya bar tidak hilang total waktu `jumlah:0`.

Kode dikonfirmasi bersih secara statis sebelum lanjut ke verifikasi live
(`npx tsc --noEmit` pass, pola scoping akses konsisten) — verifikasi live
terhadap DB dev baru menyusul besoknya, lihat entri 6 Ags di bawah.

**Susulan 6 Agustus:** `05da44c` — hapus field `pasienId` (dipilih di query
Prisma + dialirkan sampai tipe frontend tapi tidak pernah dibaca, kartu
prioritas di Home tidak tappable) dan fallback `?? []` yang menjaga skenario
deploy-skew FE/BE yang tidak mungkin terjadi di proyek ini (satu checkout
docker-compose, FE+BE selalu jalan bareng) — hasil `/ponytail-review`
terhadap diff `ad0e86c`+`ae8c77a`.

### Catatan lanjutan 6 Ags 2026 — Verifikasi Bagian B (Statistik Home)
Eksekusi `docs/prompts/verifikasi-bagian-b-statistik-home.md` — verifikasi
live endpoint yang dibangun 5 Agustus (entri di atas).

**Setup:** backend lokal (`npm run dev`) terhubung ke DB dev via Tailscale
`100.109.84.118`, pola sama Hari 10/12-13/23. Login 2 akun DOKTER hasil seed
(`putra.tasdik`, `agus.nugraha`) + `admin`/`admin123`.

**Semua 5 item Task 1 PASS:**
1. `pasienAktif` — cocok ke `COUNT DokterPasienAssignment ACTIVE` buat kedua
   akun DOKTER (masing-masing 2, dicek manual lewat query Prisma terpisah).
2. `operasiHariIni`/`konsulHariIni`/`aktivitasMingguan` — baseline semua 0
   (seed data historis, Jun-Jul 2026, tidak ada yang jatuh di rentang
   "hari ini"/minggu berjalan 6 Ags 2026), cocok dengan `COUNT` manual per
   hari. `pasienPrioritas` baseline `[]` (0 jadwal SCHEDULED masa depan di
   seed) — juga cocok.
3. **Kasus tepi timezone (paling kritikal):** dibuat 2 `Kunjungan` uji —
   A `2026-08-06T16:30:00Z` (23:30 WIB Kamis) dan B
   `2026-08-06T17:30:00Z` (00:30 WIB Jumat) — sengaja dipilih supaya sama-sama
   di tanggal UTC yang sama (6 Ags) tapi beda tanggal kalender WIB, persis
   celah yang paling gampang salah kalau ada kode yang diam-diam pakai
   boundary UTC. Hasil: `konsulHariIni` 0→1 (cuma A), `aktivitasMingguan`
   Kamis 0→1 + Jumat 0→1 (masing-masing cuma dapat 1 record, bukan 2-2 atau
   ketuker), `pasienPrioritas` isinya [A, B] terurut A dulu. Dicocokkan
   independen pakai `Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta'
   })` (bukan reuse fungsi yang sama dites) — hasilnya identik: A = "Kamis,
   6 Agustus 23.30", B = "Jumat, 7 Agustus 00.30". Data uji dihapus lagi
   setelah verifikasi, dicek balik ke baseline (`konsulHariIni`→0,
   `pasienPrioritas`→`[]`).
4. Sebagai `admin` — response persis `{ pasienAktif:0, operasiHariIni:0,
   konsulHariIni:0, pasienPrioritas:[], adminCatatan: "..." }`, tidak crash,
   tidak ada agregat lintas-dokter.
5. Dokter tanpa assignment aktif — di-simulasikan dengan flip sementara 2
   assignment ACTIVE milik `putra.tasdik` jadi COMPLETED (bukan bikin akun
   baru), hit endpoint → `pasienAktif:0`, HTTP 200, tidak exception. Direvert
   balik ke ACTIVE setelah dicek, dikonfirmasi `pasienAktif` balik ke 2.

Tidak ada bug ditemukan — kodenya sesuai spek termasuk di kasus tepi yang
paling rawan. Detail lengkap (query pembanding, response curl mentah): lihat
`docs/testing-manual.md` section "Modul: Dashboard Home (Statistik + Pasien
Prioritas)".

**Silang-referensi entri Hari 20** ("Dashboard Kinerja Dokter — Belum
dikerjakan", lihat di atas): entri itu TETAP BENAR secara harfiah — tidak
ada kode yang dikerjakan tanggal 2 Agustus sesuai jadwal aslinya. Tapi
kebutuhannya secara substansi sudah terisi lewat jalur lain: `pasienAktif`/
`operasiHariIni`/`konsulHariIni`/`aktivitasMingguan`/`pasienPrioritas` di
atas adalah "Bagian B — Statistik Home" dari
`docs/prompts/prompt-gabungan-3-fitur.md`, dikerjakan 5 Agustus (3 hari
setelah jadwal Hari 20 aslinya, sebagai bagian sesi gabungan bukan hari
terpisah). Widget "grafik performa" yang lebih visual (kalau itu yang
dimaksud "Dashboard Kinerja" aslinya) masih belum ada — dicatat di sini
supaya pembaca jurnal tidak salah simpul "Hari 20 beneran belum ada apa-apa"
padahal sebagian besar angkanya sudah tersedia & terverifikasi hidup.

### Catatan lanjutan 6 Ags 2026 — Pull-to-refresh 7 layar, konsistensi warna/radius, rapikan sapaan Home

Sesi lanjutan hari yang sama (setelah verifikasi Bagian B di atas), lewat
permintaan langsung Arthuro di chat — di luar item Hari 24 ("Integration
testing") yang belum mulai.

**1. Pull-to-refresh native di 7 layar** — Home, Daftar Pasien, Jadwal
Operasi/Konsul, Notifikasi, Detail Pasien, Profil Dokter, Data Pendapatan.
Pakai `RefreshControl` bawaan React Native, bukan library baru. Perubahan
kuncinya: fungsi `load()`/`loadOperasi()`/`loadKunjungan()` yang tadinya
selalu `setLoading(true)` (nge-swap seluruh list jadi spinner penuh layar
tiap refresh) sekarang nerima opsi `{ silent?: boolean }` — pull-to-refresh
manggil mode silent biar list-nya tetap kelihatan pas spinner native muncul
di atas. `PasienDetailScreen` dikasih fungsi refresh terpisah dari effect
mount awalnya, biar guard `cancelled` (proteksi race condition pas ganti
pasien cepat) gak ikut kebongkar. `DataPendapatanScreen` (masih murni mock,
belum ada endpoint) dapat refresh simulasi 500ms — kosmetik doang, placeholder
sampai modul Pendapatan tersambung backend.

**2. Konsistensi token warna & radius** ikut ke-commit bareng (sudah ada di
working tree sebelum sesi chat ini mulai): badge status "SELESAI" di
`PasienListScreen`/`PasienDetailScreen` yang tadinya `colors.tertiaryFixed`
(kuning) disamakan ke `colors.deepTealDark`; warna status "Berlangsung"/
"Selesai" di `JadwalOperasiKonsulScreen` yang tadinya hex mentah (`#a3a900`,
`#0D3D3B`) diganti token (`colors.tertiaryContainer`, `colors.deepTealDark`);
radius kartu yang sebelumnya angka mentah (`24`) atau `radius.sm` tersebar di
beberapa screen disatukan lewat token baru `radius.md: 24` di `colors.ts`.
Filter kategori di `NotifikasiScreen` juga dapat tint warna per kategori
(`KATEGORI_TINT`) — sebelumnya semua kategori satu warna pill yang sama.

**3. Redesain kecil `ProfilDokterScreen`** — hero card diubah dari layout
avatar-tengah+pill jadi badge identitas (avatar rata kiri, nama+spesialisasi
di sampingnya), fallback teks spesialisasi yang sebelumnya salah ketik
"Spesialis Kelamin" dibetulkan jadi "Spesialisasi belum tersedia". Menu
pengaturan yang belum ada tujuan navigasinya sekarang tampil non-tappable +
label "Segera hadir" (cuma menu Pendapatan yang aktif) — biar gak kelihatan
bisa ditap tapi diem aja pas ditekan. Tombol "Keluar Akun" diganti dari solid
merah jadi outline.

**4. Home dirapikan lebih lanjut.** Jarak judul→card di section "Ringkasan
Aktivitas Hari Ini"/"Akses Cepat" yang pakai `gap: 20` (beda dari "Pasien
Prioritas"/"Statistik Mingguan" yang `gap: 16`) disamakan ke 16. Sapaan nama
dokter dirapikan: nama dokter disimpan lengkap sama gelar dalam satu string
(`"dr. Nama, Sp.B(K) Onk"`), sebelumnya seluruhnya masuk heading besar-bold
`Halo, {nama}` — gelar panjang bikin kata terakhir jatuh sendirian ke baris
ke-2 (kelihatan berantakan, dilaporkan Arthuro pakai screenshot). Dipisah
pakai `splitGelar()` (potong di koma pertama): nama tetap di heading besar,
gelar turun jadi caption kecil terpisah (uppercase, letter-spacing) — reuse
persis pola `spesialisasiText` yang sudah ada di `ProfilDokterScreen`. Tanda
seru ditambah di belakang nama ("Halo, dr. Putra Tasdik!") atas permintaan
langsung.

**5. Referensi animasi loading — belum diimplementasi.** Arthuro minta ganti
`<ActivityIndicator>` generik dengan animasi lain, tapi minta lihat referensi
dulu sebelum dikerjakan. Dibuat 3 kandidat bertema monitor vital pasien
(Vital Line/EKG, Pulse Ring, Cross Trace) di halaman Artifact terpisah biar
motion-nya bisa dibandingkan langsung. Channel 1 & 3 butuh dependency baru
`react-native-svg` (Arthuro sudah `npm install` duluan — kelihatan dari
`package.json`/`package-lock.json`, walau kodenya sendiri belum dipakai di
manapun); Channel 2 (Pulse Ring) zero-dependency, cukup `View`+`Animated`
bawaan RN. **Belum ada keputusan channel mana yang dipakai**, jadi
`<ActivityIndicator>` di 5 layar itu masih yang lama, belum diganti.

**Commit & push:** `11ab7d4` — digabung 1 commit, dipush ke `origin/main`
tanpa perlu override HTTP (`c72d37b..11ab7d4`). Ikut kebawa perubahan lain
yang sudah pending sebelum sesi ini mulai: rename menu Home `chatbot` →
`radiologi` (`homeMock.ts`) dan dependency `react-native-svg` di atas.

### Hari 24-27 (Kam 6 Ags – Min 9 Ags) — Tidak ada progres
Tidak ada commit maupun perubahan uncommitted di repo pada rentang ini —
dikonfirmasi langsung ke Arthuro: memang tidak ada progres, bukan kerjaan yang
lupa ke-commit. Item rencana Hari 24 (Integration testing), Hari 25 (Bug
fixing round 1), Hari 26 (Bug fixing round 2 + regression testing), dan
Hari 27 (User documentation) di `CLAUDE.md` **belum dikerjakan**, bukan
"selesai tanpa jejak".

### Hari 28 (Sen, 10 Ags) — Kalender pribadi dokter (Bagian A), fix navigasi tab, sembunyikan tab bar layar Akses Cepat, debug 500 error Prisma Client basi

Di luar jadwal aslinya ("Final review, wrap-up") — 3 commit pagi/siang
membangun fitur baru, ditutup 1 sesi debug sore yang dipicu laporan bug
langsung dari Arthuro.

**`81324d5` (10:37 WIB) — kalender pribadi dokter (Bagian A):**
- Entity baru `CatatanKalender` (`id`, `dokterId`, `tanggal`, `waktu`,
  `judul`, `catatan`, `tipe`) + enum `TipeCatatanKalender`
  (REMINDER/BLOCKING/PRIBADI), migration
  `20260810031147_add_kalender_module`. Beda dari seluruh entity lain di
  schema: **tidak** ada relasi ke Pasien/Kunjungan/Operasi sama sekali — ini
  murni catatan pribadi dokter, satu-satunya modul di app yang jadi write
  action penuh oleh dokter sendiri (bukan view-only hasil sync SIMRS, lihat
  komentar `NAVIGABLE_CARD_IDS` di `HomeScreen.tsx`).
- Kolom `waktu` sengaja `String` "HH:mm" polos, bukan `DateTime` — ini jam
  dinding pengingat, bukan instant yang perlu ikut konversi `WIB_OFFSET_MS`
  seperti kolom `tanggal` (komentar eksplisit di `schema.prisma`).
- Endpoint `backend/src/routes/kalender.routes.js` (baru, 246 baris):
  `GET /api/kalender?dari&sampai` (filter rentang tanggal, geser ke UTC lewat
  `WIB_OFFSET_MS` sama seperti `lab.routes.js`/`dashboard.routes.js`), `POST`,
  `PATCH /:id` (partial update), `DELETE /:id`. `dokterId` selalu dari JWT
  (`req.user`), tidak pernah dari body/params. Branch ADMIN ikut pola
  `dashboard.routes.js`: `GET` balikin list kosong + `adminCatatan` penjelas,
  `POST`/`PATCH`/`DELETE` 403 — akun ADMIN tidak terikat satu Dokter jadi
  "kalender pribadi milik siapa" tidak masuk akal buat akun itu. Catatan
  milik dokter lain sengaja dibalikin **404** (bukan 403) di `PATCH`/`DELETE`,
  reuse pola `notifikasi.routes.js` `PATCH /:id/read`, supaya endpoint tidak
  bocorin ID valid milik dokter lain. Semua write (CREATE/UPDATE/DELETE)
  tercatat ke `AuditLog` (aturan #4 `CLAUDE.md`).
- Frontend: `CatatanKalenderScreen.tsx` (baru, 828 baris) nested di
  `ProfilStackNavigator` — month grid manual 6×7 (`buildMonthGrid`), dengan
  layer read-only jadwal Operasi/Kunjungan ditumpuk di atas catatan pribadi
  (dibaca lewat `fetchOperasiList`/`fetchKunjunganList` yang sudah ada, cuma
  ditampilkan bukan ditulis — konsisten aturan #1 read-only Operasi/
  Konsultasi). Tile baru "Tambah Pengingat" ditambah ke grid Akses Cepat Home
  (`homeMock.ts`, `NAVIGABLE_CARD_IDS`, tint `colors.secondary`).

**`68aa652` (11:20 WIB) — fix bug navigasi `initial:false`:**
- Bug: `navigation.navigate({tab, screen})` tanpa opsi `initial:false`, kalau
  `screen` tujuan BUKAN `initialRouteName` tab itu dan tab itu baru pertama
  kali dikunjungi, mengganti **seluruh state stack** tab tujuan jadi cuma
  berisi screen itu sendiri — root aslinya (`ProfilDokter`/`PasienList`)
  tidak pernah ke-push. Akibatnya tombol "kembali" tidak punya apa-apa buat
  di-*pop* di dalam stack itu, nembus balik ke Home, dan tab tujuan jadi
  rusak buat sisa sesi (navigasi berikutnya ke tab yang sama juga ikut kena).
- Ditemukan lewat laporan bug Arthuro sendiri di tile "Tambah Pengingat"
  (fitur baru commit sebelumnya) — ditelusuri ternyata bug lama yang sama
  juga sudah menimpa **"Data Pendapatan" dan "Cari Hasil Lab"**, 3 dari 3
  tile Akses Cepat yang ada, bukan cuma yang baru dibuat.
- Fix: `initial: false` ditambah ke ketiga `navigation.navigate()` call di
  `HomeScreen.handleCardPress`, dengan komentar penjelas di kode kenapa opsi
  ini penting (bukan cuma silent fix).

**`d6926c2` (11:43 WIB) — sembunyikan tab bar + smooth transition di layar Akses Cepat:**
- 3 screen yang cuma bisa diakses lewat tile Akses Cepat Home (Data
  Pendapatan, Kalender Pribadi, alur Cari Hasil Lab) sekarang sembunyikan
  `FloatingTabBar` lewat `useHideTabBar()` — hook yang sudah ada dari Hari 22
  buat `LihatPdfLabScreen`, dipakai ulang bukan dibuat baru — plus bottom
  padding disesuaikan supaya tidak lagi menyisakan ruang kosong bekas tab bar
  yang sudah hilang.
- Cross-tab transition: `MainTabNavigator` pakai `animation: 'fade'` bawaan
  `bottom-tabs` v7 (default sebelumnya `'none'`, potong instan tanpa
  transisi), dipadukan durasi *hide* `FloatingTabBar` 240ms→200ms biar
  nyambung mulus sama fade 150ms-nya.
- Tombol kembali di 3 entry-screen itu diarahkan eksplisit ke Home lewat
  helper baru `goBackToHome()` (`frontend/src/navigation/goBackToHome.ts`),
  bukan `goBack()` biasa — kalau pakai `goBack()`, itu bakal *pop* ke root
  stack tab tujuan (`ProfilDokter`/`PasienList`) yang tidak pernah sengaja
  dikunjungi user, sisi lain dari celah yang sama dengan bug `initial:false`
  di atas. Screen turunan **di dalam** alur (`HasilLabList`/`Detail`/
  `LihatPdf`) tetap pakai `goBack()` normal, karena mereka memang bagian
  stack yang sengaja dikunjungi bertahap.

**Sesi debug sore — kalender tidak bisa simpan/lihat jadwal, 500 "Terjadi kesalahan pada server":**

Dilaporkan Arthuro lewat chat sesudah 3 commit di atas dites di device.
Diagnosis dituntun jarak jauh — koneksi ke DB dev (laptop Windows/WSL2 di
Surabaya, diakses lewat Tailscale) tidak tersedia dari lingkungan kerja ini,
jadi seluruh command dijalankan langsung oleh Arthuro di WSL2 dan hasilnya
ditempel ke chat.

1. **Hipotesis awal — migration belum ter-*deploy* (salah).**
   `backend/Dockerfile` cuma menjalankan `npx prisma generate` saat image
   *build*, tidak pernah `migrate deploy` otomatis — dicurigai migration
   `20260810031147_add_kalender_module` (baru dibuat commit `81324d5`) belum
   ter-*apply* ke database. Dicek `docker compose exec app npx prisma
   migrate status` → **"Database schema is up to date!"**, tabelnya sudah
   ada. Hipotesis ini gugur.
2. **Hipotesis kedua — Prisma Client basi di container (benar).** Petunjuk
   yang mengarah ke sini: response time error yang dicatat `morgan` cuma
   ~2ms — terlalu cepat buat request yang sempat menyentuh DB remote lewat
   Tailscale, jadi errornya pasti meledak sinkron di JavaScript sebelum
   request sempat jalan. Log asli (`docker compose logs --tail=50 app`
   — sebelumnya cuma kelihatan baris akses `morgan`, bukan
   `console.error(err)`-nya karena scroll belum ke atas) mengonfirmasi:
   `TypeError: Cannot read properties of undefined (reading 'create')` di
   `kalender.routes.js:155` dan `(reading 'findMany')` di baris 132 —
   `prisma.catatanKalender` sendiri `undefined`.
3. **Akar masalah:** `docker-compose.yml` mem-bind-mount `.:/usr/src/app`
   (source code ikut ter-update tiap `git pull`), tapi `node_modules`
   di-*exclude* lewat volume anonim terpisah
   (`- /usr/src/app/node_modules`) — pola standar Docker+Node buat
   menghindari bentrok native module host vs container. `npx prisma
   generate` cuma jalan sekali, waktu image di-*build*. Jadi `git pull` yang
   membawa model `CatatanKalender` baru ke `schema.prisma` **tidak**
   otomatis meregenerasi `@prisma/client` di `node_modules` — client yang
   jalan di container masih versi lama yang belum kenal model itu sama
   sekali.
4. **Fix:** `docker compose exec app npx prisma generate` (dikonfirmasi
   sukses — `grep -c catatanKalender node_modules/.prisma/client/index.d.ts`
   → 64 match) lalu `docker compose up -d --force-recreate app` (lebih pasti
   daripada `restart` biasa). Dites ulang dari app — sudah tidak error.

**Dicatat buat ke depan (belum diperbaiki):** `docker compose restart app`
**tidak cukup** setiap kali `schema.prisma` berubah — harus `npx prisma
generate` (dan `migrate deploy` kalau ada migration baru) dulu, baru
restart/recreate container, karena `node_modules` container adalah volume
terpisah yang tidak ikut `git pull`. `README.md` sudah mencatat langkah
`migrate deploy` tapi belum menyebutkan `prisma generate` ulang setelah
`git pull` — ditawarkan ke Arthuro buat ditambahkan ke README atau diwire ke
start command container, belum ada keputusan sampai catatan ini ditulis.

### Hari 30 (Rab, 12 Ags) — Ringkasan statistik Home, fix gestur swipe iOS, filter auto-sembunyi, panel konten membulat, rapikan `docs/`

Masa buffer (11 Ags–akhir Agustus) sesuai `CLAUDE.md`. Frontend saja — tidak
ada perubahan backend, schema, maupun endpoint. Lima commit sore (14:44–14:45
WIB), plus penataan `docs/` yang belum di-commit saat catatan ini ditulis.

Rekaman lengkap alasan tiap keputusan ada di
`docs/catatan-belajar-frontend-12-agustus-2026.md` — entri jurnal ini
ringkasannya.

**`51363c7` — ringkasan teks statistik mingguan di Home:**
- Pertanyaan pembuka dari Arthuro: perlukah memanggil LLM untuk menghasilkan
  kalimat ringkasan di bawah chart "Statistik Pasien Mingguan"? **Tidak.**
  Seluruh isinya aritmetika di atas array yang sama dengan yang menggambar
  bar-nya, jadi rule-based menang di semua aspek yang relevan: angkanya
  dijamin konsisten dengan chart, instan, gratis, dan bisa dites. LLM baru
  masuk akal kalau ringkasannya butuh penalaran yang tidak bisa diturunkan
  dari angka — bukan kasus di sini.
- `frontend/src/utils/ringkasanAktivitas.ts`: fungsi murni, keluarannya satu
  kalimat berisi total minggu berjalan, hari tersibuk, dan posisi hari ini
  terhadap rata-rata harian.
- **Sengaja tidak ada klaim naik/turun vs minggu lalu.** `GET
  /api/dashboard/statistik` cuma mengirim minggu berjalan (`getRentangMingguIniWIB`
  di `dashboard.routes.js`), jadi data pembandingnya memang tidak ada.
  Kalau nanti dibutuhkan, backend perlu menambah hitungan rentang −7 hari
  dulu — bukan ditebak di frontend.
- Tesnya `ringkasanAktivitas.check.ts`, 7 assert dijalankan Node langsung
  (`node src/utils/ringkasanAktivitas.check.ts`, type stripping Node 24),
  bukan Jest — frontend belum punya Jest dan memasangnya untuk satu fungsi
  murni tidak sepadan. Konsekuensinya `tsconfig.json` perlu
  `allowImportingTsExtensions` karena impornya menyebut ekstensi `.ts` sesuai
  aturan resolusi ESM.
- Ikut di commit yang sama karena berkasnya sama: label menu "Tambah
  Pengingat" → "Kalender Pengingat" (`id` tetap `kalender`), subjudul Menu →
  "Pilihan menu untuk Anda", dan pill di belakang tombol grid/list.

**`89d072c` — fix gestur swipe iOS di screen yang dibuka dari tile Menu:**
- Bug lanjutan dari yang diperbaiki Hari 28. Tombol back header sudah benar
  (ke Home) sejak `useMenuBack` dibuat, tapi **gestur geser dari tepi kiri
  iPhone** masih mendarat di `ProfilDokter`/`PasienList` — root stack tab
  tujuan yang tidak pernah sengaja dibuka user.
- Akar masalah: `useMenuBack` cuma bisa mencegat dua dari tiga cara kembali.
  Tombol back header dan back Android jalan di JS; gestur geser iOS
  dijalankan native oleh `react-native-screens` tanpa lewat JS, jadi tidak
  ada titik untuk membelokkannya.
- Fix: `menuEntryScreenOptions` (di `useMenuBack.ts`) mematikan
  `gestureEnabled` saat layar dibuka dengan param `fromHome`. Satu konstanta
  dipakai ketiga layar (`DataPendapatan`, `CatatanKalender`,
  `PilihPasienHasilLab`), bukan ditambal per layar.
- **Kenapa dimatikan, bukan dibelokkan.** Membelokkan hanya bisa lewat
  `usePreventRemove`, dan hook itu bekerja dengan menolak SEMUA penghapusan
  layar — termasuk `popToTopOnBlur` di `MainTabNavigator` yang membersihkan
  stack tab tujuan saat user balik ke Home. Kalau itu ikut tertolak,
  `DataPendapatan` tidak pernah terbuang dan muncul lagi waktu tab Profil
  ditekan (persis bug yang dulu diperbaiki `popToTopOnBlur`). Melepas kunci
  saat layar kehilangan fokus juga tidak bisa diandalkan karena `freezeOnBlur`
  membekukan layar non-aktif, jadi pelepasannya jadi balapan timing.
  Kesimpulan ini dari membaca `node_modules/@react-navigation/core/src/usePreventRemove.tsx`
  dan `bottom-tabs/src/views/BottomTabView.tsx`, bukan dari uji di device.

**`51f9a8c` — lepas Data Pendapatan dari menu Profil:**
- Entri itu dulu ditaruh di daftar Settings Profil karena Home belum punya
  kartu menunya; sekarang sudah ada, jadi cuma jalan kedua ke layar yang sama.
  Daftarnya balik ke 3 item versi Figma. Screen + route `DataPendapatan`
  **tidak** dihapus, masih dipakai kartu menu Home.
- Efek berantai: setelah entri itu hilang tidak ada satu pun item di daftar
  yang punya tujuan navigasi, jadi `handleMenuPress`, `AVAILABLE_MENU_IDS`,
  prop `navigation`, dan style `settingsRowPressed` ikut dibuang. Barisnya
  jadi `View` biasa, bukan `Pressable` yang di-*disable*.

**`9841db2` — filter auto-sembunyi saat scroll + panel konten membulat:**
- `useCollapseOnScroll`: baris chip filter di Pasien & Jadwal naik saat scroll
  ke bawah, turun lagi saat scroll ke atas. Dua lapis View — kotak luar tidak
  bergeser dan dia yang memotong (`overflow: hidden`), isinya yang digeser —
  supaya chip terlihat menyelinap ke **belakang** search bar. Versi pertama
  menggeser kotaknya sendiri sehingga kotak itu menimpa search bar dan malah
  terlihat lewat di depannya.
- Dua `Animated.Value` terpisah: geseran isi native driver (mulus), tinggi
  kotak JS driver (layout tidak bisa native). Satu nilai tidak boleh dipakai
  dua driver sekaligus.
- **Bug "list terasa nyangkut saat discroll balik"** (dilaporkan Arthuro
  setelah versi pertama). Akar masalahnya umpan balik: selama animasi jalan
  tinggi viewport list ikut berubah → `ScrollView` menjepit `contentOffset` →
  jepitan itu masuk lagi ke `onScroll` sebagai scroll balik arah → memicu
  animasi lawan. Dua penjaga: (a) arah tidak dibaca selama animasi + 80ms
  sesudahnya; (b) filter tidak disembunyikan kalau sisa jarak ke dasar list
  kurang dari 2× tingginya, karena di sana menyembunyikannya justru menambah
  ruang scroll dan menarik konten balik ke atas.
- `ContentSheet` (komponen baru): panel konten menindih header sejauh
  radiusnya, jadi warna header mengintip di dua sudut atas — lengkung
  menghadap ke luar, pola kartu putih di bawah header biru Livin' yang jadi
  rujukan Arthuro. Dipakai Pasien, Jadwal, dan Notifikasi. Shadow menempel di
  sheet (offset negatif, jatuh ke atas), bukan di header, karena sheet
  menindih header sehingga shadow milik header sendiri ketutupan.
- **Temuan desain yang layak diingat:** lengkung terbaca dari kontras, bukan
  dari radius. Dengan skema header sekarang (`#effbff` → `#ffffff` saat
  discroll) rasionya cuma ~1.06:1 — praktis tidak terlihat; yang benar-benar
  memisahkan header dari list adalah shadow-nya. Header berwarna solid sempat
  dicoba (`primary` `#006a65`, 6.1:1) lalu **dikembalikan atas permintaan
  Arthuro** — kalau mau diambil, itu keputusan untuk semua screen sekaligus,
  bukan satu layar.

**`1d44ee2` — `docs/catatan-belajar-frontend-12-agustus-2026.md`:** dokumen
belajar berisi gejala → akar masalah → perbaikan → pelajaran untuk tiap butir
di atas, atas permintaan Arthuro.

**Penataan `docs/` (belum di-commit saat catatan ini ditulis):**
- 22 berkas di `docs/prompts/` dipilah: 18 prompt eksekusi tetap di sana,
  2 materi challenge pindah ke `docs/latihan/`, 2 review/brief pindah ke
  `docs/analisa/`.
- **Penting:** `docs/prompts/` ternyata sudah ada di `.gitignore` sejak awal
  ("Local prompt/dev journal notes — not for the repo"). Memindahkan isinya ke
  `docs/` biasa akan membuat catatan lokal itu ikut terpublikasi, jadi dua
  folder baru ikut ditambahkan ke `.gitignore` supaya statusnya tidak
  berubah diam-diam. Kalau nanti salah satunya memang mau masuk repo, hapus
  barisnya dari `.gitignore` — bukan pindahkan berkasnya.
- Rujukan path lama diperbarui di `testing-manual.md` (2 tempat),
  `jurnal-pengerjaan.md`, dan komentar `homeMock.ts`.
- `docs/README.md` baru: cara mengenali tiap jenis dokumen + 4 aturan menaruh
  dokumen baru, supaya pembagian ini tidak berantakan lagi.

**Status verifikasi:** semua lolos `npx tsc --noEmit` dan
`ringkasanAktivitas.check.ts` lolos, tapi **tidak ada satu pun yang dites di
perangkat**. Daftar yang perlu dicek langsung ada di bagian 9
`docs/catatan-belajar-frontend-12-agustus-2026.md`.

---

### Hari 32 (Jum, 14 Ags) — Hapus Detail Laporan Lab, rapikan teks Home & Profil, navigasi tile Menu pindah ke stack Home

Masa buffer. Frontend + satu perubahan kecil backend (`auth.routes.js`). Tidak
ada perubahan schema, migration, maupun endpoint baru.

**`f98945f` — commit gabungan (25 berkas).** Isinya dua lapis: pekerjaan yang
sudah ada di working tree sejak hari-hari sebelumnya tapi belum pernah
di-commit, plus pekerjaan hari ini. Digabung jadi satu commit karena Arthuro
minta "push semua perubahan" sekaligus; idealnya dipecah per topik, dan ini
dicatat supaya jelas kenapa satu commit isinya seluas ini.

Yang sudah ada sebelumnya:
- **Jasa Medis (`DataPendapatanScreen`) dirombak** — panel ringkasan +
  komposisi penjamin, filter bulan, daftar transaksi dikelompokkan per tanggal
  dan dimuat 10 baris sekali jalan. Komposisi bar sengaja dihitung dari
  transaksi `TERVERIFIKASI` saja supaya segmennya menjumlah persis ke angka
  besar di atasnya.
- **`frontend/scripts/cek-pendapatan.mjs`** — 1 berkas assert yang dijalankan
  Node langsung (bukan Jest, pola sama dengan `ringkasanAktivitas.check.ts`).
  Yang dijaga invarian datanya: id unik, tanggal ISO, nominal wajar, status &
  jenis tidak keluar dari nilai yang dikenali panel, dan **tidak ada field
  identitas pasien** yang ikut di baris jasa medis.
- **Kartu identitas di Profil** — NIP & SIP ditarik dari `/api/auth/me`;
  bentuk respons `/login` dan `/me` disatukan lewat helper `bentukPengguna()`
  di `auth.routes.js` (sebelumnya dua literal terpisah — resep dua respons yang
  diam-diam beda isinya).
- **`useCollapseOnScroll` jadi dua baris** — swipe pertama menyembunyikan chip
  filter, swipe kedua search bar; arah sebaliknya search bar duluan yang balik.
  Dipakai `PasienListScreen` & `JadwalOperasiKonsulScreen`.
- **`ContentSheet.tsx` dan `profilMock.ts` dihapus** (sudah nol pemakai).

Pekerjaan hari ini yang ikut di commit itu:
- **Notifikasi Hasil Lab dihapus.** Kartu demo statis kategori "Lab" di
  `NotifikasiScreen` (satu-satunya pintu masuk ke `DetailLaporanLabScreen`)
  dan chip filter "Hasil Lab" dibuang, berikut kategori `Lab`, label "Contoh",
  dan state `labDemoRead`. Daftar notifikasi sekarang murni dari
  `/api/notifikasi` dengan 2 kategori: Pasien Baru & Jadwal.
- **`DetailLaporanLabScreen` dihapus total** (keputusan Arthuro) — screen
  dekoratif hasil eksplorasi Figma itu sudah digantikan modul Cari Hasil Lab
  yang tersambung backend asli, jadi tidak perlu dua jalur ke data yang sama.
  Ikut dihapus: route `DetailLaporanLab` di `NotifikasiStackNavigator` +
  `types.ts`, dan `frontend/src/mocks/notifikasiMock.ts` (jadi nol consumer).
  Catatan di `CLAUDE.md` diperbarui supaya sesi berikutnya tidak mencari screen
  yang sudah tidak ada.
- **Tile "Ringkasan Aktivitas Hari Ini" di Home dirapikan.** Label dipendekkan
  jadi Pasien Aktif / Operasi / Konsultasi — "Hari Ini" sudah ada di judul
  seksinya, dan pengulangan itu yang bikin "Konsultasi Hari Ini" patah 2-3
  baris di kolom selebar ~73pt. `textTransform: 'uppercase'` dilepas (huruf
  besar + letterSpacing ~30% lebih lebar, pemicu utama wrap-nya). Margin kiri
  ikon/angka/label disamakan jadi 0 — sebelumnya 0/9/4, terbaca seperti tangga.

**Sesudah commit itu (belum di-commit saat catatan ini ditulis):**

- **Nomor SIP tidak lagi ditampilkan** (keputusan Arthuro) — cukup NIP. Bukan
  cuma barisnya yang dihapus dari kartu Profil: `sip` juga dilepas dari
  `bentukPengguna()` dan dari tipe `LoginResponse`, jadi nomornya tidak keluar
  dari server sama sekali. Kolom `sip` di `schema.prisma` + seed-nya tetap ada.
- **Nama pasien menabrak & terpotong di `PasienDetailScreen`.** Dua titik
  berbeda:
  - *Menabrak* — di kartu hero, badge status satu baris dengan nama, jadi sisa
    lebar buat nama tinggal ~130pt di layar 375. Nama panjang (apalagi satu
    kata panjang yang tidak bisa dipatah) meluber keluar kotaknya dan menimpa
    badge. Badge dipindah ke bawah blok info (`alignSelf: 'flex-start'`); nama
    dapat ~207pt dan bebas wrap.
  - *Terpotong* — judul header `numberOfLines={1}` → `{2}`. Nama pasien
    Indonesia gampang lewat ~28 karakter yang muat sebaris, dan judul kepotong
    "Muhammad Abdul Rah…" memaksa dokter turun ke kartu buat memastikan
    pasiennya benar.
- **Screen dari tile Menu pindah ke stack HomeTab** — menutup catatan terbuka
  Hari 30. Ini persis *upgrade path* yang dulu ditulis di `useMenuBack.ts`, dan
  dikerjakan sekarang karena Arthuro minta swipe-back-nya jangan dikunci lagi.
  - Sebelumnya `DataPendapatan`/`CatatanKalender` menumpang `ProfilStack` dan
    `PilihPasienHasilLab` menumpang `PasienStack`, dibuka lintas tab dengan
    `initial: false`. Konsekuensinya pop native mendarat di
    `ProfilDokter`/`PasienList`, dan gestur swipe iOS terpaksa dimatikan karena
    dia jalan di native tanpa lewat JS.
  - Sekarang ada `HomeStackNavigator`: `Home` + tiga screen menu itu + tiga
    screen lanjutan Hasil Lab (`HasilLabList`/`HasilLabDetail`/`LihatPdfLab`).
    Tiga screen lab itu **sengaja didaftarkan di dua stack** (HomeStack dan
    PasienStack) karena alurnya memang punya dua pintu masuk: Menu Home → pilih
    pasien, dan `PasienDetail` → hasil lab pasien itu. Tipe param-nya dishare
    lewat `LabRoutes` di `types.ts` supaya tidak bisa lepas sinkron.
  - Karena Home sekarang benar-benar ada di bawahnya dalam satu stack, ketiga
    cara kembali (tombol header, back Android, swipe iOS) mendarat di Home
    tanpa dibelokkan. Yang ikut terhapus: `useMenuBack.ts` seluruhnya
    (`useMenuBack` + `menuEntryScreenOptions`), tipe `MenuEntryParams`, param
    `fromHome` di empat pemanggilan `HomeScreen`, dan `gestureEnabled: false`.
    `ProfilStack` tinggal `ProfilDokter`.

**Status verifikasi:** `npx tsc --noEmit` lolos di tiap langkah. **Tidak ada
yang dites di perangkat** — yang paling perlu dicoba langsung: swipe-back dari
tiga screen menu, alur Home → Pilih Pasien → Hasil Lab → PDF (swipe mundur
satu-satu sampai Home), dan tampilan nama panjang di detail pasien.

---

### Hari 33-35 (Sab 15 Ags – Sen 17 Ags) — Tidak ada progres

---

### Hari 36 (Sel, 18 Ags) — Rencana revisi modul klinis: Tahap 1 (kategori kunjungan) & Tahap 2 (model Konsultasi)

Masa buffer. Hari terbesar sejak Hari 28: 1 entitas baru, 2 migration,
1 modul backend baru, 1 layar ditulis ulang total, 7 commit.

Titik berangkatnya `docs/rencana-revisi-modul-dokter.md` — rencana 4 tahap yang
disusun setelah dapat referensi bentuk asli dokumen SIMRS (Lembar Konsultasi,
Laporan Operasi) dan dashboard jasa medis SIREMDIS.

#### Pre-check rencana: 5 hal yang berbeda dari asumsi dokumen

Rencana itu punya bagian "Pre-check Wajib Sebelum Eksekusi". Dijalankan lebih
dulu, dan hasilnya mengubah cara Tahap 1 dikerjakan:

1. **Sebagian Tahap 1 sudah ada.** `Kunjungan` sudah punya `ruanganId` FK ke
   `Ruangan`, dan enum `RuanganJenis` sudah memuat `POLI`/`RAWAT_INAP`. Field
   `ruangan` String yang diminta rencana itu duplikat relasi yang sudah ada.
2. **Asumsi "Konsultasi = jadwal" masih hidup dan dalam** — bukan cuma satu
   layar: `JadwalOperasiKonsulScreen` memanggil `fetchKunjunganList`,
   `DetailKonsulScreen` menerima param `kunjunganId`, dan `statusJadwal.js`
   menurunkan status Kunjungan persis seperti Operasi.
3. **Tahap 3 punya tumpang tindih yang belum diputuskan rencana:** `Operasi`
   sudah punya `tim String[]`, `catatanPreOp`, `catatanPostOp` — belum jelas
   field tim baru menggantikannya atau hidup berdampingan.
4. **Tahap 4 bukan "kemungkinan restrukturisasi", tapi pasti breaking:**
   `Pendapatan.operasiId` FK **required** dan tidak ada `dokterId` sama sekali,
   padahal contoh transaksinya ("Konsul Ruang Perawatan") bukan operasi.
5. **Nomor baris pre-check #2 sudah bergeser** — bug `Math.random()` tanpa
   `faker.seed()` ada di `seed-kunjungan-operasi.js:86,90`, bukan 67,71.

#### Tahap 1 — Kategori kunjungan (`c57426a`, `4534ee1`, `fb2c46b`)

**Keputusan inti: kategorinya DITURUNKAN dari `Ruangan.jenis`, bukan kolom baru
di `Kunjungan`.** Nilainya sudah ada di sana dan `ruanganId` wajib di tiap
kunjungan, jadi kolom terpisah cuma bikin dua sumber kebenaran yang bisa saling
bertentangan (kunjungan bertipe RAWAT_INAP yang ruangannya poli). Yang benar-benar
kurang cuma nilai `IGD` di enum — satu migration `ALTER TYPE ... ADD VALUE`,
additive, tidak breaking.

- **`src/utils/jenisKunjungan.js`** — peta dua arah `RAWAT_JALAN` ↔ `POLI` +
  `parseJenisKunjungan()`. Kosakata publik (API & UI) pakai istilah rencana;
  `POLI` itu detail taksonomi ruangan yang tidak perlu bocor ke query string.
- **Bug yang ditangkap test sebelum sempat jalan:** versi pertama memakai
  lookup langsung `KE_RUANGAN_JENIS[query.jenisKunjungan]`. Untuk
  `?jenisKunjungan=__proto__` itu mengembalikan `Object.prototype` — **truthy**,
  jadi lolos whitelist dan masuk ke `where` Prisma. Diganti `Object.hasOwn`.
  Ini persis alasan test ditulis lebih dulu untuk fungsi di batas kepercayaan.
- **Bug model di seed yang ikut ketahuan:** `seed.js` memberi ruangan **OK**
  ke sebagian `Kunjungan`, padahal `Operasi` punya `ruanganId` sendiri.
  Kunjungan di ruang operasi memang salah model, dan sebelum Tahap 1 tidak ada
  yang menyadarinya karena `ruangan.jenis` belum berarti apa-apa. Sekarang
  kunjungan mengambil dari ruangan non-OK saja.
- **Filter `?jenisKunjungan=`** di list pasien & kunjungan, plus field
  `jenisKunjungan` di respons list/detail/riwayat. Di list pasien filternya
  berarti "pasien yang **punya** kunjungan jenis ini" — daftar itu berbasis
  pasien, bukan kunjungan.
- **Yang di-skip:** `nomorKamar` (item terbuka rencana sendiri, belum
  dikonfirmasi ke Mas Fauzi) dan field `ruangan` String (duplikat FK).

#### Filter chip → dropdown (`adcb094`)

Versi pertama memasang 3 chip jenis di samping 3 chip status. Enam chip tidak
muat sebaris di layar ponsel; versi `flexWrap`-nya jadi dua baris dan ikut
menaikkan tinggi header yang menyusut-mengembang waktu scroll. Diganti dua
tombol dropdown + bottom sheet, memakai ulang pola dropdown bulan di
`DataPendapatanScreen` (backdrop, sheet membulat, item bercentang).

Tombol menampilkan **nama dimensinya** waktu kosong ("Status", "Jenis
Kunjungan"), bukan "Semua" — dua tombol bertuliskan "Semua" bersebelahan tidak
memberi tahu apa pun soal isinya. Baris ketiga sengaja tidak dibuat:
`useCollapseOnScroll` cuma mengelola dua baris (search + filter).

#### Tahap 2 — Model Konsultasi (`ec6c07f`, `e9985e3`, `1602c64`)

Tahap paling berisiko di rencana, dan memang restrukturisasi total. Referensi
Lembar Konsultasi menunjukkan bentuk aslinya: **surat konsul antar-dokter** —
dua pihak (pengirim, tujuan), dua state (menunggu jawaban, sudah dijawab) —
bukan jadwal appointment seperti yang diasumsikan sejak Minggu 1.

- **Entitas ke-14 `Konsultasi`** + 2 enum (`PrioritasKonsultasi`,
  `StatusKonsultasi`), migration `20260818064500_add_konsultasi_module`.
  Dua relasi bernama ke `Dokter` (`KonsultasiPengirim`/`KonsultasiTujuan`).
  SQL-nya digenerate lewat `prisma migrate diff --from-schema-datasource`,
  bukan ditulis tangan.
- **Hak aksesnya sengaja BEDA pola dari seluruh modul lain.** Pasien & lab
  lewat `DokterPasienAssignment`; di sini `WHERE dokterTujuanId = <dari JWT>`,
  tanpa jalan lolos lewat assignment. Konsekuensinya disengaja: konsul yang
  ditujukan ke dokter lain tetap 403 **meski pasiennya di-assign ke dokter yang
  login**. Ini keputusan terkunci di rencana, dan justru karena polanya
  menyimpang, ia ditutup test tersendiri.
- **`konsultasi.rbac.test.js`** — 8 test, prisma di-mock, yang diperiksa
  *where clause yang dikirim*, bukan hasil query. Termasuk jaminan `?dokterId=`
  tidak bisa dipakai DOKTER buat mengintip dokter lain (Aturan #2).
- **Tiga penyimpangan dari tabel field rencana, disengaja:**
  - `dokterPengirimId` ditambahkan. Rencana menyebut "ada dua pihak (pengirim,
    tujuan)" tapi cuma mendaftarkan `dokterTujuanId`; tanpa pengirim, layar
    detail tidak bisa menampilkan konsul ini datang dari siapa.
  - `tanggalPermintaan` ditambahkan — rencana cuma punya `tanggalJawaban`.
  - Ikhtisar klinis semuanya nullable; lembar konsul di lapangan terisi
    sebagian. `tekananDarah` String karena bentuknya "120/80".
- **Seed pakai 6 skenario utuh**, bukan field yang diacak sendiri-sendiri:
  permintaan nyambung dengan diagnosis kerjanya, dan jawaban menjawab
  permintaan itu. Permintaan "evaluasi anestesi" yang dijawab "tunda
  kemoterapi" bukan data dummy, itu data rusak — prinsip yang sama dengan seed
  lab (Hari 21).
- **Frontend diganti sumbernya, bukan di-extend** (pre-check #3):
  `DetailKonsulScreen` ditulis ulang jadi dua section — Permintaan (selalu) dan
  Jawaban (kondisional). Waktu `MENUNGGU_JAWABAN` yang tampil penanda belum
  dijawab, bukan kartu kosong: field jawabannya memang null di server, tidak
  sekadar disembunyikan UI. Filter status dipisah per tab (Operasi punya siklus
  jadwal, Konsultasi punya dua state surat) dan direset waktu ganti tab.
- **Sisa temuan pre-check #3 yang paling halus:** dashboard punya
  `konsulHariIni` yang sebenarnya menghitung `prisma.kunjungan` tapi dilabeli
  "Konsultasi" di Home. Sebelum hari ini itu cuma penamaan longgar; sesudah
  `Konsultasi` jadi entitas tersendiri, itu menyesatkan. Direname jadi
  `kunjunganHariIni`, berikut `jenis: 'KONSULTASI'` → `'KUNJUNGAN'` dan label
  UI di Home & Kalender. Rename dua sisi (backend + frontend) sengaja dalam
  satu commit supaya kontrak API-nya tidak pernah pecah di tengah.
- **`1602c64`** — komentar seed menjanjikan sebagian konsul punya `kunjunganId`
  null supaya layar detail teruji di dua kondisi, tapi tiap pasien di seed
  selalu punya minimal satu kunjungan: hasilnya 0 dari 14 baris. Ditambah
  undian 25%. Ketahuan waktu memverifikasi hasil seed, bukan dari kode.

#### Debugging: ternyata ada DUA Prisma Client di laptop backend

Catatan Hari 28 sudah merekam satu sisinya (client di dalam container basi).
Hari ini kena **dua-duanya, dengan gejala yang sama sekali berbeda**, dan itu
memakan waktu paling lama hari ini:

| Yang jalan | Pakai | Generate di | Gejala kalau basi |
|---|---|---|---|
| API server | volume anonim container | `docker compose exec app npx prisma generate` | HTTP 500 **hanya** pada baris yang memakai nilai enum baru |
| `npm run prisma:seed` | `node_modules` WSL2 | `npx prisma generate` di host | `TypeError: Cannot read properties of undefined (reading 'deleteMany')` |

Yang bikin sisi pertama sulit dibaca: `?limit=2` balik 200 (dua baris pertama
kebetulan tidak ada IGD-nya) sementara `?limit=100` dan `/api/pasien` balik 500.
Kelihatan seperti bug di endpoint tertentu, padahal kode + data yang sama jalan
200 di laptop lokal. Yang memastikan bukan kode: port 3000 **masih menjawab**
setelah server di WSL2 di-Ctrl-C — berarti ada proses lain, dan `restart: unless-stopped`
di `docker-compose.yml` yang menahannya hidup.

**Aturannya sekarang: tiap `schema.prisma` berubah, generate di DUA tempat.**

#### Status verifikasi

- `npx tsc --noEmit` lolos di tiap langkah; 31/31 test backend lolos.
- Endpoint Tahap 1 & 2 diuji **lawan DB asli lewat Tailscale**, bukan cuma unit
  test: sebelum seed jalan, dengan 2 baris `Konsultasi` sementara yang dibuat
  lalu dihapus lagi; sesudah seed, dengan data seed sebenarnya.
- Hasil verifikasi setelah reseed: Konsultasi 14 baris, 9 ditujukan ke dokter
  utama dan API mengembalikan **tepat 9** (scoping bekerja), 5 menunggu jawaban
  / 4 sudah dijawab, 4 CITO. Kategori kunjungan: Rawat Jalan 27, IGD 8, Rawat
  Inap 17.
- **Tidak ada yang dites di perangkat.** Yang paling perlu dicoba langsung:
  dua dropdown filter di Daftar Pasien (termasuk kombinasi status + jenis),
  tampilan dua section di Detail Konsultasi untuk kedua status, dan badge CITO.

### Hari 37 (Rab, 19 Ags) — Tahap 3 & 4 rencana revisi + security review seluruh codebase

Rencana revisi modul klinis **tuntas semua** hari ini (Tahap 3 dan 4 menyusul
Tahap 1 & 2 kemarin), lalu satu screenshot referensi memaksa Tahap 4 ditulis
ulang dua kali, dan hari ditutup dengan security review yang menemukan celah
HIGH di kode yang sudah jalan sejak Minggu 1.

Enam commit: `7e6d649`, `a1d000e`, `0fee0f2`, `76db2db`, `5b3c354`, `bb0d319`.

#### Tahap 3 — Laporan Operasi (`7e6d649`)

`Operasi` berhenti jadi sekadar jadwal. 26 kolom nullable + 2 enum
(`SifatOperasi`, `JenisPembedahan`), migration
`20260819043000_add_laporan_operasi`, additive murni jadi data lama tetap valid.

- **Aturan tampilnya yang jadi inti tahap ini:** laporan cuma dikirim kalau
  status **efektif**-nya `COMPLETED`, bukan status tersimpan. Operasi yang
  tercatat `SCHEDULED` tapi tanggalnya sudah lewat tetap dapat laporannya —
  konsisten dengan label "Selesai" yang tampil di layar (`utils/statusJadwal.js`
  dari Hari 33). Penyaringannya di **server**, field-nya dibuang dari respons,
  bukan dikirim null lalu disembunyikan UI.
- **Satu tabel `LAPORAN_FIELDS`** di `utils/laporanOperasi.js` melayani dua hal
  sekaligus: validasi body PATCH dan penyaringan respons GET. Menambah field
  laporan nanti cukup di satu tempat. Nama kolom tidak pernah diambil dari
  request — itu juga yang menutup mass-assignment (dikonfirmasi agen review
  sore harinya).
- **`tim` lama dibiarkan.** Sempat terpikir menggantinya dengan 5 field bernama
  peran, tapi itu migrasi data + ubah validasi PATCH + ubah kartu jadwal, demi
  nol fungsionalitas baru. Kartu Tim Medis sekarang menampilkan peran kalau
  laporannya ada, jatuh ke daftar nama polos kalau belum.
- **Seed pakai narasi per jenis tindakan**, prinsip yang sama dengan seed lab
  (Hari 21) dan seed konsul (Hari 36): transfusi cuma muncul kalau perdarahan
  >500 ml, grup anestesi lokal cuma terisi kalau `jenisAnestesi` Lokal, jam
  selesai selalu setelah insisi.
- **8 test** (`laporanOperasi.test.js`), termasuk kasus tersimpan-`SCHEDULED`-
  tapi-lewat dan operasi dibatalkan (yang tidak boleh punya laporan).
- Ikut dibersihkan: penanganan `P2003` di `DELETE /api/operasi` jadi tidak
  terpakai setelah Tahap 4 melepas relasi `Pendapatan → Operasi`.

#### Tahap 4 — Jasa Medis, versi pertama (`a1d000e`)

`Pendapatan` berhenti jadi turunan `Operasi` dan jadi **satu baris per
pelayanan**, diturunkan dari kunjungan + operasi + konsultasi yang sudah ada.
`Penjamin` dapat flag `isJkn` eksplisit — mencocokkan teks bebas kolom `tipe`
untuk menentukan kelompok uang itu cara yang diam-diam salah begitu ada
penjamin baru.

Dua penyimpangan dari dokumen rencana, disengaja:

- **Ringkasan periode tidak disimpan sebagai model.** Rencana menyebut "dua
  layer secara data (ringkasan + detail)". Tapi ringkasan itu agregasi atas
  rentang tanggal yang dipilih user — menyimpannya berarti punya dua sumber
  angka yang bisa berbeda. Dihitung saat diminta.
- **Satu endpoint, bukan dua.** Layarnya butuh ringkasan dan daftar sekaligus,
  dan angka ringkasan harus dijumlah dari baris yang sama persis dengan yang
  ditampilkan. Dipisah dua panggilan, dua angka itu bisa selisih tanpa ada yang
  sadar.

Versi ini sengaja **tanpa identitas pasien**, mengikuti keputusan 14 Ags 2026
yang tercatat di `pendapatanMock.ts` — bukan mengikuti tabel field rencana yang
menyebut `norm`/`namaPasien`. Alasannya: keputusan itu lebih baru dan lebih
spesifik, dan arahnya aman (menambah kolom identitas nanti itu additive,
mencabutnya setelah terlanjur jalan tidak).

**Bug seed lama yang ketahuan di sini:** `seedOperasi` memilih 6 kunjungan acak
dari **seluruh** dokter, dan akun demo sering tidak kebagian satu pun. Efeknya
baru kelihatan sekarang karena jasa medis diturunkan dari operasi: dokter utama
punya 0 baris tindakan operasi. Diperbaiki jadi separuh jatah dari kunjungan
dokter utama. Ini juga yang bikin laporan Tahap 3 tidak pernah tampil waktu app
dibuka — screenshot detail operasi yang dikirim siang tadi kebetulan operasi
dari `seedJadwalMendatang`, yang memang sengaja tanpa laporan.

#### Tahap 4 ditulis ulang — screenshot SIREMDIS asli (`0fee0f2`)

Screenshot tabel "Detail Tindakan" mengoreksi **tiga** asumsi sekaligus:

| Asumsi awal | Kenyataan di referensi |
|---|---|
| Tanpa identitas pasien | Ada kolom `NORM` dan `NAMA PASIEN` |
| Periode = pilihan bulan | Rentang tanggal bebas, "01-08-2026 s/d 17-08-2026" |
| Tarif bervariasi tiap transaksi | Tabel tetap per tindakan — puluhan baris cuma memakai dua nilai, Rp 23.400 dan Rp 31.950 |

- **Identitas pasien masuk kembali**, relasi `Pendapatan → Pasien`, migration
  `20260819110000_pendapatan_pasien`. Komentar lama di `schema.prisma` dan
  `types.ts` yang menjelaskan kenapa identitas pasien *tidak* ada ikut
  diperbarui — riwayat keputusannya tetap dicatat di situ supaya tidak ada
  dokumentasi yang saling bertentangan.
- **Batas atas periode INKLUSIF.** "s/d 17-08" yang diam-diam memotong tanggal
  17 berarti sehari penuh jasa medis hilang dari laporan. Ini dapat testnya
  sendiri, dan implementasinya memakai awal hari **berikutnya** sebagai batas
  eksklusif, dihitung dalam WIB.
- **Pemilih rentang tanggal** memakai ulang pola filter di `HasilLabListScreen`
  (`@react-native-community/datetimepicker` sudah terpasang sejak Hari 25, tidak
  ada dependency baru). Pintasan bulan tetap ada di bawahnya — cuma di situ
  dokter bisa tahu bulan mana yang memang ada isinya, dan picker tanggal tidak
  bisa menyampaikan itu.
- **Tarif jadi tabel tetap.** Seed sebelumnya mengarang rentang Rp 150–400 rb
  untuk konsul, sekitar 10× terlalu besar. Nominal poliklinik, IGD, dan seluruh
  tindakan operasi belum punya rujukan — ditandai `PENDING` di seed, jangan
  dianggap angka nyata.
- **`unitPelayanan` = SMF tempat pelayanan terjadi, bukan spesialisasi dokter
  yang menagih.** Di referensi, dokter Sp.THT menagih konsul di unit "Anak" —
  unit mengikuti tempatnya, bukan siapa yang mengerjakan. Sebelumnya diisi nama
  ruangan ("Rawat Inap Melati"), sekarang SMF ("Onkologi Medik").

#### Tahap 4 disederhanakan — gaya aplikasi finance (`76db2db`)

Tiga penyederhanaan atas permintaan langsung:

- **`statusVerifikasi` dihapus sampai ke kolom DB** (migration
  `20260819130000_hapus_status_verifikasi`), bukan sekadar disembunyikan.
  Kolom itu memang tidak pernah ada di tabel SIREMDIS — sisa dari mock lama.
  Laporan jasa medis cuma perlu satu angka total, bukan dua kolom uang (cair vs
  diproses) yang harus dijelaskan bedanya. Baris "menunggu verifikasi" di panel
  dan filternya ikut hilang.
- **Rincian per penjamin dihapus.** Bar multi-segmen diganti dua segmen JKN vs
  Non-JKN, tiap kartu menyebut persentasenya sendiri terhadap total. Dua angka
  itu sekarang menjumlah persis ke angka besar di atasnya tanpa perlu dijumlah
  di kepala.
- **Daftar transaksi bergaya ledger aplikasi finance:** ikon kategori bulat di
  kiri (dicocokkan dari nama tindakan — tidak ada kolom kategori baru di DB cuma
  demi ikon), nominal tebal rata kanan dengan angka tabular, keterangan
  bertingkat di tengah, penjamin jadi chip yang warnanya membedakan JKN dari
  Non-JKN. Divider mulai setelah kolom ikon supaya terbaca sebagai ledger,
  bukan tabel.

`pendapatanMock.ts` dihapus (nol consumer). Layar Jasa Medis sekarang murni
dari `/api/pendapatan`.

#### Security review seluruh codebase — 3 agen paralel

Dibagi tiga domain: (1) auth/RBAC/plumbing, (2) route data klinis, (3) modul
finansial + data layer + frontend. Dua agen **secara independen** menemukan dua
temuan yang sama, dan keduanya saya verifikasi ulang sendiri ke file aslinya
sebelum dilaporkan.

**Yang bersih** (ini bagian yang penting dicatat, karena hasilnya menguatkan
keputusan arsitektur Minggu 1): ke-13 endpoint klinis punya scoping clause
server-side dari `req.user`; ketiga endpoint tulis semuanya `authorize("ADMIN")`;
nol `$queryRaw`/`$executeRaw`/`eval` di seluruh backend; `?dokterId=` tidak bisa
dipakai DOKTER di satu pun route; guard `role === "DOKTER" && !ownDokterId → 403`
ada di semua 17 route yang bisa dicapai DOKTER; `jenisKunjungan.js` sudah pakai
`Object.hasOwn` untuk memblokir `?jenisKunjungan=__proto__`. **Aturan #2
CLAUDE.md terbukti dipegang konsisten di seluruh codebase.**

**Temuan 1 (HIGH) — kunci JWT bisa ditebak.** `docker-compose.yml` punya
`JWT_SECRET: ${JWT_SECRET:-change-me-to-a-long-random-secret}` sejak Hari 5,
dan `jwt.js` memakainya tanpa validasi apa pun. Waktu dicek, `.env` yang sedang
berjalan **memang masih berisi placeholder itu** — jadi bukan risiko teoretis.
Dampaknya bukan satu endpoint: seluruh isolasi antar-dokter diturunkan dari
klaim JWT, jadi siapa pun yang bisa membaca repo ini bisa merakit token
`role: ADMIN` dan membaca pasien, hasil lab, serta jasa medis dokter mana pun,
tanpa kredensial. Port 3000 di-publish dan `.env` menunjuk host jaringan, jadi
permukaannya nyata.

**Temuan 2 (MEDIUM) — akun `admin`/`admin123` dari seed.** Belum diperbaiki,
lihat catatan lintas-hari.

#### Perbaikan Temuan 1 (`5b3c354`) dan kesalahan yang menyusul (`bb0d319`)

Tiga lapis:

1. `jwt.js` menolak secret kosong, < 32 karakter, atau placeholder. Dicek di
   **level modul** supaya server gagal start, bukan gagal saat login pertama.
   Gagal berisik lebih baik daripada aman-aman palsu.
2. `docker-compose.yml` pakai `${JWT_SECRET:?...}` — compose menolak start tanpa
   secret, tidak ada lagi nilai bawaan yang ikut ter-commit.
3. `.env.example` dikosongkan + instruksi generate.

Sekalian algoritma verifikasi dipin ke `HS256`. 6 test baru
(`jwtSecret.test.js`), termasuk penolakan token `alg: none` yang dirakit tangan.
Secret di `.env` dirotasi (Mac dan laptop backend terpisah, dua-duanya perlu
dirotasi sendiri karena `.env` tidak ter-commit). Rotasi membatalkan semua token
lama — sesi yang login harus login ulang.

**Kesalahan saya di commit itu:** pesan error `${JWT_SECRET:?wajib di-set,
generate dengan: openssl ...}` mengandung `": "`, dan YAML membacanya sebagai
awal mapping baru. **Seluruh** `docker-compose.yml` gagal di-parse — `up` dan
`logs` dua-duanya mati dengan `mapping values are not allowed in this context`.
Lolos dari pengujian karena Docker daemon tidak jalan di Mac tempat perubahan
itu dibuat, jadi compose file-nya tidak pernah benar-benar di-parse. Diperbaiki
di `bb0d319` (nilai dikutip, titik-dua dibuang) dan kali ini **diverifikasi
dengan parser YAML sungguhan** sebelum push.

**Pelajarannya, dan ini pola yang berulang:** perubahan pada file yang tidak
dieksekusi test (compose, Dockerfile, migration SQL) harus divalidasi dengan
alat yang memang memparsingnya, bukan dibaca sekilas. Sama kelasnya dengan
pelajaran dua Prisma Client di Hari 36 — "kelihatannya benar di satu mesin"
bukan verifikasi.

#### Status verifikasi

- 52/52 test backend lolos (naik dari 31 di Hari 36: +8 laporan operasi,
  +6 pendapatan, +6 guard JWT, +1 penyesuaian).
- `npx tsc --noEmit` lolos di tiap langkah.
- Semua endpoint diuji **lawan DB asli lewat Tailscale**, bukan cuma unit test:
  laporan operasi tampil/tidak sesuai status, jasa medis per periode, dan
  `jkn + nonJkn === bruto` diverifikasi dari respons sungguhan.
- Guard JWT diuji empat arah: boot dengan placeholder → gagal, boot tanpa
  secret → gagal, login normal → 200, token dipalsukan dengan secret lama →
  401.
- Hasil setelah reseed: Pendapatan 48 baris, Operasi 10. Juni dokter utama
  9 baris dengan JKN Rp 3.080.600 (50%) / Non-JKN Rp 3.052.000 (50%).
- **Tidak ada yang dites di perangkat.** Yang paling perlu dicoba langsung:
  section laporan di Detail Operasi untuk operasi Juni (yang sudah punya
  laporan), pemilih rentang tanggal di Jasa Medis, dan tampilan ledger-nya.

---

## Catatan lintas-hari yang masih terbuka
- **Temuan security MEDIUM belum diperbaiki — akun `admin`/`admin123`**
  (ditemukan Hari 37, 19 Ags): `seed.js` membuat akun ADMIN dengan password
  `admin123`, dan akun dokter berbagi satu password `Sidokmais#2026` dengan
  username yang diturunkan deterministik dari nama dokter (jadi bisa
  dienumerasi). Ini bukan fixture test — `seed.js` adalah jalur seed normal
  (`npm run prisma:seed`) yang jalan terhadap apa pun yang ditunjuk
  `DATABASE_URL`, saat ini host jaringan bersama. ADMIN bukan role rendah:
  `parseDokterIdFilter` menghormati `?dokterId=` **hanya** untuk ADMIN, dan itu
  persis saklar lintas-dokter di endpoint uang. Perbaikannya kecil: password
  seed dibaca dari env (`process.env.SEED_ADMIN_PASSWORD`) + guard
  `NODE_ENV !== "production"` di awal `seed.js`.
- **Bug korektness `kunjungan.routes.js:73`** (ditemukan Hari 37 lewat security
  review, bukan lewat test): `where.OR = [...]` menimpa key `OR` yang sudah
  dipasang `whereStatusEfektif("COMPLETED", KUNJUNGAN)` di baris 65. Untuk
  DOKTER, `GET /api/kunjungan?status=COMPLETED` diam-diam mengembalikan
  **semua** kunjungannya tanpa filter status. Fail-safe (yang bertahan justru
  scoping-nya), jadi bug tampilan, bukan celah keamanan. `operasi.routes.js`
  terhindar karena scoping-nya bersarang di bawah `where.kunjungan`.
- **`docs/rencana-revisi-modul-dokter.md` Tahap 4 sudah tidak sesuai kode**
  (Hari 37): dokumen itu masih menulis dua endpoint terpisah, ringkasan sebagai
  model tersimpan, dan tidak menyebut tarif tetap maupun `statusVerifikasi` yang
  sempat ada lalu dihapus. Yang berlaku adalah entri Hari 37 di jurnal ini.
- **Rotasi `JWT_SECRET` harus dikerjakan per mesin** (Hari 37): `.env` tidak
  ter-commit, jadi rotasi di satu mesin tidak ikut ke mesin lain. Sejak
  `5b3c354` server menolak start kalau secret-nya lemah — kalau nanti ada
  environment baru, generate dulu (`openssl rand -base64 48`) sebelum
  `docker compose up`, bukan sesudah bingung kenapa container crash-loop.
- **File yang tidak dieksekusi test butuh validasi tersendiri** (Hari 37):
  `docker-compose.yml` rusak sehari penuh karena `": "` di dalam nilai
  environment, dan tidak ketahuan sampai dijalankan di laptop backend — Docker
  daemon tidak jalan di mesin tempat perubahannya dibuat. Berlaku juga untuk
  `Dockerfile` dan migration SQL yang ditulis tangan.
- ~~ERD v2 (entity Konsultasi terpisah dari Operasi) belum di-merge resmi ke
  dokumen rencana, masih pending keputusan supervisor~~ — **selesai 18 Ags
  2026** (Hari 36): model `Konsultasi` masuk lewat migration
  `20260818064500_add_konsultasi_module`. Bentuknya **bukan** seperti dugaan
  ERD v2 (Konsultasi sebagai jadwal sejenis Operasi) melainkan surat konsul
  antar-dokter sesuai referensi Lembar Konsultasi. Yang masih perlu
  dikonfirmasi supervisor: apakah `dokterPengirimId` dan `tanggalPermintaan`
  yang ditambahkan di luar tabel field rencana sudah sesuai form aslinya.
- ~~Entity "Laporan Lab" belum ada modelnya di `schema.prisma`~~ — **selesai
  30 Jul 2026**: `PemeriksaanLab` + `HasilLabItem` masuk lewat migration
  `20260730024026_add_lab_module`. **Koreksi 4 Agustus 2026:** Hari 19 TIDAK
  menyambungkan `DetailLaporanLabScreen` ke data asli seperti rencana semula
  — yang dibangun justru alur baru terpisah ("Cari Hasil Lab":
  `PilihPasienHasilLabScreen`/`HasilLabListScreen`/`HasilLabDetailScreen`/
  `LihatPdfLabScreen`, lihat entri Hari 19). **Selesai 14 Ags 2026:**
  `DetailLaporanLabScreen` beserta `notifikasiMock.ts` dihapus total — alur
  Cari Hasil Lab sudah menutup kebutuhannya, jadi tidak ada lagi screen lab
  yang menggantung di mock.
- Pertanyaan terbuka ke supervisor: format data klinis (ICD-10, No. RM), kebijakan
  data ke LLM pihak ketiga, handover pasca-magang. Khusus modul lab, daftar
  pertanyaan terstruktur ada di `docs/pertanyaan-supervisor-modul-lab.md`.
- Hal-hal yang sengaja ditunda (bukan terlupa) dicatat di
  `docs/keputusan-tertunda.md`.
- **Docker/Prisma Client basi setelah `git pull`** (ditemukan Hari 28,
  10 Ags): `node_modules` container adalah volume terpisah dari bind mount
  source code, jadi perubahan `schema.prisma` butuh `npx prisma generate`
  manual di dalam container (`docker compose exec app npx prisma generate`)
  sebelum restart/recreate, tidak otomatis ikut `git pull`. Belum diputuskan
  apa didokumentasikan di README atau diwire ke start command container.
  **Diperluas Hari 36 (18 Ags):** ternyata ada **dua** Prisma Client, dan tiap
  perubahan schema butuh generate di dua-duanya — client container dipakai API
  server, client host (`node_modules` WSL2) dipakai `npm run prisma:seed` dan
  script host lain. Gejalanya beda: container basi → HTTP 500 hanya pada baris
  yang memakai nilai enum baru; host basi → `TypeError: Cannot read properties
  of undefined`. Ditambah `restart: unless-stopped` pada service `app`, yang
  bikin container tetap memegang port 3000 walau server di terminal sudah
  di-Ctrl-C. Perbaikan tuntasnya: pindahkan `prisma generate` dari `RUN` ke
  `CMD` di `backend/Dockerfile` supaya sisi container jalan tiap start.
- ~~**Gestur swipe iOS dimatikan, belum dibelokkan**~~ (Hari 30, 12 Ags) —
  **selesai 14 Ags 2026** (Hari 32): layar tile Menu pindah ke
  `HomeStackNavigator`, gestur geser tepi kiri aktif lagi dan mendarat di Home.
  `useMenuBack.ts` + param `fromHome` dihapus. Konsekuensi yang perlu diingat:
  tiga screen Hasil Lab kini terdaftar di dua stack sekaligus.
- **Animasi collapse filter masih mengubah layout** (Hari 30, 12 Ags):
  `useCollapseOnScroll` menganimasikan tinggi di thread JS, jadi frame
  `ScrollView` ikut berubah tiap frame. Dua penjaga sudah menutup loop
  buka-tutupnya, tapi penyebab dasarnya belum hilang. Perbaikan tuntasnya
  header dijadikan `position: absolute` + `paddingTop` di list. Ditandai
  komentar `ponytail:` di hook-nya.
- **Header berwarna solid belum diputuskan** (Hari 30, 12 Ags): lengkung
  `ContentSheet` baru benar-benar terbaca kalau header punya warna kontras
  (`primary` `#006a65` = 6.1:1, vs ~1.06:1 dengan skema sekarang). Sempat
  dicoba lalu dikembalikan — kalau diambil, harus diterapkan ke semua screen
  sekaligus, dan seluruh isi header ikut ditinjau (chip aktif, warna teks,
  `StatusBar`).

---

## Koreksi dokumentasi — audit 30 Jul 2026

Audit terhadap kode aktual menemukan 6 klaim di dokumentasi proyek yang sudah
tidak sesuai. Ini penting karena dokumentasi dipakai sebagai konteks untuk
prompt-prompt berikutnya, jadi selama salah ia terus menyuntikkan fakta keliru.

| Klaim di dokumentasi | Hasil verifikasi | Bukti |
|---|---|---|
| HTTP client: axios | **SALAH** — `fetch` native + `apiFetch<T>()` | `frontend/src/api/client.ts:18,26`; `axios` tidak ada di `frontend/package.json` |
| UI: React Native Paper | **SEBAGIAN** — terpasang & `PaperProvider` aktif, tapi 0 komponen Paper dipakai | `frontend/package.json:19`; `frontend/App.tsx:4` satu-satunya import; 220 `<View` + 72 `Pressable` di `src/screens`+`src/components` |
| Zustand untuk state modul | **SEBAGIAN** — benar dipakai, tapi hanya auth & tab bar | `frontend/src/store/` hanya `authStore.ts`, `tabBarStore.ts`, `authStorage.ts`; 12 dari 13 screen pakai `useState`/`useEffect` sendiri |
| Primary Teal `#27B4AC` | **SALAH** — itu `primaryContainer` | `frontend/src/theme/colors.ts:2` `primary: '#006a65'`, baris 4 `primaryContainer: '#27b4ac'` |
| Backend TypeScript | **SALAH** — JavaScript | 16 file `.js`, 0 file `.ts` di `backend/src`+`backend/prisma`; tidak ada `backend/tsconfig.json`; `backend/package.json:5` `main: src/server.js` |
| 10 entitas, nama `Assignment` | **SEBAGIAN** — nama benar `DokterPasienAssignment`, `AuditLog` memang luput, tapi jumlahnya **13** bukan 10 atau 11 | `backend/prisma/schema.prisma` — 13 `model` |

Yang dikoreksi: `CLAUDE.md` (Tech Stack, Entity naming, jadwal Minggu 3,
catatan pending Laporan Lab), `README.md` (struktur folder + tabel catatan
stack), `docs/jurnal-pengerjaan.md` (Hari 6, catatan lintas-hari, bagian ini).

**Belum bisa dikoreksi:** klaim `axios`, `TypeScript`, `#27B4AC`, dan
"10-entity schema (`Assignment`)" juga tersimpan di *project knowledge*
Claude.ai (`memory.md` dan `rencana-pengembangan-aplikasi-dokter.md`), yang
di-mount read-only dan tidak bisa diedit dari repo. Itu kemungkinan sumber
utama drift-nya — perlu diperbarui manual dari sisi Claude.ai.
