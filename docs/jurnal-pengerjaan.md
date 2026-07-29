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
Prisma migration untuk 10 entity (Dokter, Pasien, DokterPasienAssignment, Ruangan,
Kunjungan, Pengguna, Notifikasi, Operasi, Penjamin, Pendapatan, AuditLog). Seed
dummy data pakai `@faker-js/faker` locale Indonesia, password di-hash pakai bcrypt.

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

## Minggu 4 — Hardening, Testing, Dokumentasi (4-10 Ags)
Hari 22-28: belum dimulai. Scope: RBAC hardening, verifikasi audit log,
integration testing, bug fixing (2 round), user documentation, final review.

---

## Catatan lintas-hari yang masih terbuka
- ERD v2 (entity Konsultasi terpisah dari Operasi) belum di-merge resmi ke
  dokumen rencana, masih pending keputusan supervisor
- Entity "Laporan Lab" belum ada modelnya di `schema.prisma` — `DetailLaporanLabScreen`
  murni UI dekoratif untuk saat ini
- Pertanyaan terbuka ke supervisor: format data klinis (ICD-10, No. RM), kebijakan
  data ke LLM pihak ketiga, handover pasca-magang
