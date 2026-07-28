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

---

## Minggu 3 — Chatbot (28 Jul-3 Ags)
Hari 15-21: **tertunda**, nunggu Minggu 2 (Hari 12-14) beres dan hasil review
supervisor 28 Jul (khususnya kebijakan data ke LLM pihak ketiga). Scope aslinya:
desain intent schema, read-intents, validation layer, write-intents + konfirmasi,
multi-turn clarification, audit log integration, testing manual (~20-30 sample
perintah). Tanggal di jadwal awal kemungkinan perlu digeser menyesuaikan
keterlambatan ini.

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
