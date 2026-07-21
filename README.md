# SIDOKMAIS

Sistem Informasi Dokter Dharmais — aplikasi mobile untuk dokter RS Dharmais
(SIMRS division). Monorepo backend + frontend, dikembangkan solo selama
magang 4 minggu. Detail lengkap arsitektur, aturan RBAC, dan jadwal
pengerjaan ada di [CLAUDE.md](CLAUDE.md).

## Struktur folder

```
sidokmais/
├── backend/    Node.js + Express + Prisma + PostgreSQL (JWT auth, RBAC)
├── frontend/   React Native + Expo (React Navigation, React Native Paper, Zustand)
├── docs/       Dokumentasi umum (testing manual, ERD, dll — bukan spesifik backend/frontend)
└── CLAUDE.md   Context project lengkap (stack, aturan arsitektur, jadwal)
```

- **backend/** — API server. Lihat `backend/prisma/schema.prisma` untuk skema DB.
- **frontend/** — Belum ada screen/logic, baru scaffold Expo kosong.

## Menjalankan backend

```bash
cd backend
cp .env.example .env        # sesuaikan kalau perlu
docker compose up -d        # start Postgres + app (atau: docker compose up -d db kalau mau jalanin app-nya manual)
npx prisma migrate deploy   # atau `migrate dev` kalau ada schema baru
npm run prisma:seed         # catat username yang di-print, password: Sidokmais#2026
```

Server default di `http://localhost:3000`. Cek `GET /health` untuk pastikan jalan.

Checklist testing manual lebih lengkap ada di [docs/testing-manual.md](docs/testing-manual.md).

## Menjalankan frontend

```bash
cd frontend
npx expo start
```

Scan QR code dengan Expo Go di HP. Kalau testing di HP fisik dan backend
jalan di laptop, pakai Tailscale IP laptop (bukan `localhost`) untuk
`DATABASE_URL`/base URL API di frontend — `localhost` di HP akan merujuk ke
HP itu sendiri, bukan laptop.

## TODO

- [ ] Isi detail environment variable frontend (base URL API) setelah screen pertama dibuat (Hari 9)
- [ ] Dokumentasi ERD final di `docs/`
- [ ] Panduan pakai app (rencana Hari 27)
