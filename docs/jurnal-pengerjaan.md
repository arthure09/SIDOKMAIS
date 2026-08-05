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

**Review kode menyeluruh (`docs/prompts/review-kode-day-22-4-agustus-2026.md`):**
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

---

## Catatan lintas-hari yang masih terbuka
- ERD v2 (entity Konsultasi terpisah dari Operasi) belum di-merge resmi ke
  dokumen rencana, masih pending keputusan supervisor
- ~~Entity "Laporan Lab" belum ada modelnya di `schema.prisma`~~ — **selesai
  30 Jul 2026**: `PemeriksaanLab` + `HasilLabItem` masuk lewat migration
  `20260730024026_add_lab_module`. **Koreksi 4 Agustus 2026:** Hari 19 TIDAK
  menyambungkan `DetailLaporanLabScreen` ke data asli seperti rencana semula
  — yang dibangun justru alur baru terpisah ("Cari Hasil Lab":
  `PilihPasienHasilLabScreen`/`HasilLabListScreen`/`HasilLabDetailScreen`/
  `LihatPdfLabScreen`, lihat entri Hari 19). `DetailLaporanLabScreen` (screen
  dekoratif di tab Notifikasi) masih pakai
  `frontend/src/mocks/notifikasiMock.ts` sampai sekarang, belum ada rencana
  baru buat menyambungkannya.
- Pertanyaan terbuka ke supervisor: format data klinis (ICD-10, No. RM), kebijakan
  data ke LLM pihak ketiga, handover pasca-magang. Khusus modul lab, daftar
  pertanyaan terstruktur ada di `docs/pertanyaan-supervisor-modul-lab.md`.
- Hal-hal yang sengaja ditunda (bukan terlupa) dicatat di
  `docs/keputusan-tertunda.md`.

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
