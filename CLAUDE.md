# SIDOKMAIS — Context Project

## Ringkasan
Aplikasi mobile dokter untuk RS Dharmais (SIMRS division), dikembangkan solo selama
magang 4 minggu (14 Jul–10 Ags 2026). Nama: SIDOKMAIS (Sistem Informasi Dokter Dharmais).
Fase saat ini: dummy data, backend independen — belum terintegrasi ke SIMRS produksi.

## Tech Stack
- Frontend: React Native + Expo, React Navigation, React Native Paper, Zustand
- Backend: Node.js + Express (satu backend, tanpa microservice terpisah)
- DB: PostgreSQL + Prisma ORM
- Auth: JWT + RBAC middleware
- Chatbot (Minggu 3, belum dimulai): panggil LLM (Gemini Flash primary, DeepSeek cadangan) langsung dari Express
- Infra: Docker + docker-compose lokal

## Entity naming
Model Prisma & domain object pakai nama Indonesia sesuai ERD: Dokter, Pasien,
PasienAssignment, Operasi, Konsultasi, Pendapatan, Notifikasi, AuditLog.
Kode (variable/function) tetap camelCase Inggris.

## Aturan arsitektur wajib diikuti
1. **RBAC**: 2 role — DOKTER, ADMIN. Dokter READ-ONLY untuk Operasi & Konsultasi
   (data ini mensimulasikan sync dari SIMRS lewat Admin). PATCH Pasien masih
   tentative — jangan diimplementasikan sebagai write bebas tanpa catatan eksplisit.
2. **dokterId selalu diambil dari JWT di server**, tidak pernah dari request
   body/query/params. Prinsip keamanan inti, akan direuse oleh chatbot nanti.
3. **Modul Pendapatan** sensitif — field `isDummy` wajib `true` sampai ada
   keputusan lain. Watermark UI "CONTOH DATA DUMMY" pada `DataPendapatanScreen`
   dihapus (keputusan Arthuro, 2026-07-24) — dianggap redundan karena seluruh
   aplikasi masih fase dummy data. Field `isDummy` di DB tetap dipertahankan.
4. **Audit log generik**: semua write action (manual/chatbot) dicatat ke
   AuditLog dengan entityType/entityId/beforeData/afterData JSON.
5. **Chatbot (future)**: arsitektur propose→validate→confirm→audit. LLM tidak
   pernah menulis langsung ke DB. Closed function-set whitelist, bukan freeform NLU.

## Testing
Jest + Supertest untuk API. Manual checklist untuk chatbot nanti (command
in-scope + out-of-scope yang disengaja).

## Jadwal Pengerjaan — 4 Minggu
Sumber: rencana-pengembangan-aplikasi-dokter.pdf (rencana awal magang). Mulai 14 Juli 2026.

### Minggu 1 — Brainstorming & Setup (14-20 Jul) — SELESAI
- Hari 1 (Sel 14 Jul): Kickoff — review kebutuhan, breakdown modul awal — selesai
- Hari 2 (Rab 15 Jul): Flowchart alur aplikasi (login → list pasien → aksi) — selesai (artefak di luar repo)
- Hari 3 (Kam 16 Jul): Identifikasi fitur final per modul, wireframe kasar — selesai (artefak di luar repo)
- Hari 4 (Jum 17 Jul): Desain arsitektur — ERD, daftar endpoint API, draft intent chatbot — selesai (artefak di luar repo)
- Hari 5 (Sab 18 Jul): Setup project — init repo, Docker compose, environment config — selesai
- Hari 6 (Min 19 Jul): Implementasi DB schema (Prisma migration) + seed dummy data — selesai
- Hari 7 (Sen 20 Jul): RBAC skeleton (JWT auth, middleware) + review Minggu 1 — selesai

### Minggu 2 — Modul Inti & Notifikasi (21-27 Jul)
- Hari 8 (Sel 21 Jul): Backend — endpoint list pasien (GET, filter, search) — **selesai**
- Hari 9 (Rab 22 Jul): Frontend — screen list pasien + detail view — **selesai**
- Hari 10 (Kam 23 Jul): Backend — endpoint data operasi (CRUD jadwal, status) — **selesai**
- Hari 11 (Jum 24 Jul): Frontend — screen data operasi (list, detail, update status)
- Hari 12 (Sab 25 Jul): Setup Expo push notification + tabel notifications
- Hari 13 (Min 26 Jul): Integrasi notifikasi (pasien baru, reminder H-1/H-2)
- Hari 14 (Sen 27 Jul): Testing manual modul 1, 2, 4 + review Minggu 2

### Minggu 3 — Chatbot (28 Jul-3 Ags)
- Hari 15 (Sel 28 Jul): Desain intent schema final (daftar aksi + entity per aksi)
- Hari 16 (Rab 29 Jul): Implementasi read-intents (ringkasan, pasien minggu ini, jadwal besok)
- Hari 17 (Kam 30 Jul): Implementasi validation layer (bentrok jadwal, pasien valid)
- Hari 18 (Jum 31 Jul): Implementasi write-intents + confirmation step
- Hari 19 (Sab 1 Ags): Multi-turn clarification handling (kasus ambiguitas)
- Hari 20 (Min 2 Ags): Audit log integration untuk aksi chatbot
- Hari 21 (Sen 3 Ags): Testing manual chatbot (~20-30 sample perintah) + review Minggu 3

### Minggu 4 — Hardening, Testing, Dokumentasi (4-10 Ags)
- Hari 22 (Sel 4 Ags): RBAC hardening — review semua endpoint
- Hari 23 (Rab 5 Ags): Audit log — verifikasi semua aksi tercatat benar
- Hari 24 (Kam 6 Ags): Integration testing — end-to-end semua modul
- Hari 25 (Jum 7 Ags): Bug fixing round 1
- Hari 26 (Sab 8 Ags): Bug fixing round 2 + regression testing
- Hari 27 (Min 9 Ags): User documentation — panduan pakai app
- Hari 28 (Sen 10 Ags): Final review, wrap-up

Sisa masa magang (11 Ags–akhir Agustus): buffer murni — modul pendapatan,
nice-to-have yang dipangkas, atau tugas lain dari supervisor.

## Catatan pending (tidak menghalangi development)
- ERD v2 (entity Konsultasi, Operasi/Konsultasi view-only) adalah versi yang
  berlaku sampai ada instruksi lain — belum di-merge resmi ke dokumen rencana.
- Pertanyaan terbuka ke supervisor: format data klinis (ICD-10, No. RM),
  kebijakan data ke LLM pihak ketiga, handover pasca-magang.
- `DetailLaporanLabScreen` (screen Notifikasi → Detail Laporan Lab) dibangun
  sebagai UI dekoratif hasil eksplorasi desain Figma, di luar 4 modul resmi
  rencana awal. Entity "Laporan Lab" belum ada modelnya di `schema.prisma`.
  Dipertahankan sebagai bagian aplikasi (keputusan Arthuro), tapi belum jadi
  modul resmi — kalau mau jadi fitur beneran, perlu masuk ERD + jadwal dulu.
- `DetailPembatalanOperasiScreen` (screen bonus Figma di luar 6 screen batch
  ini) dihapus total (keputusan Arthuro, 2026-07-24) — dokter tidak punya
  wewenang mengatur/menindaklanjuti jadwal operasi (aplikasi ini SIMRS info
  system, read-only untuk Operasi sesuai aturan #1), jadi detail pembatalan
  tidak perlu screen terpisah. Kartu jadwal berstatus CANCELLED di
  `JadwalOperasiKonsulScreen` sekarang non-tappable (`disabled`), cukup
  ditampilkan inline di list.
