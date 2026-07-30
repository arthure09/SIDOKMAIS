# SIDOKMAIS

Sistem Informasi Dokter Dharmais — aplikasi mobile untuk dokter RS Dharmais
(SIMRS division). Monorepo backend + frontend, dikembangkan solo selama
magang 4 minggu. Detail lengkap arsitektur, aturan RBAC, dan jadwal
pengerjaan ada di [CLAUDE.md](CLAUDE.md).

## Struktur folder

```
sidokmais/
├── backend/    Node.js + Express + Prisma + PostgreSQL (JavaScript, JWT auth, RBAC)
├── frontend/   React Native + Expo + TypeScript (React Navigation, Zustand)
├── docs/       Dokumentasi umum (testing manual, laporan harian, ERD, dll)
└── CLAUDE.md   Context project lengkap (stack, aturan arsitektur, jadwal)
```

- **backend/** — API server, **JavaScript (`.js`, CommonJS)**. Lihat
  `backend/prisma/schema.prisma` untuk skema DB (13 model per 30 Jul 2026).
- **frontend/** — TypeScript. 13 screen sudah ada (list/detail pasien, jadwal
  operasi & konsultasi, notifikasi, pendapatan, profil, dll); sebagian
  tersambung API asli, sebagian masih `src/mocks/`.
- **docs/laporan-harian/** — laporan harian per hari untuk pelaporan magang.
  Jurnal teknis kronologis ada di [docs/jurnal-pengerjaan.md](docs/jurnal-pengerjaan.md).

### Catatan stack (hasil audit dokumentasi 30 Jul 2026)

Dokumentasi lama menyebut beberapa teknologi yang tidak dipakai di kode.
Yang berlaku:

| Klaim lama | Kondisi aktual |
|---|---|
| Backend TypeScript | **JavaScript** — 16 file `.js`, tanpa `tsconfig.json`. Tidak dimigrasi (prioritas fitur). |
| HTTP client axios | **`fetch` native** via helper `apiFetch<T>()` di `frontend/src/api/client.ts`. |
| UI React Native Paper | Terpasang & `PaperProvider` masih membungkus app, tapi **tidak ada komponen Paper dipakai** — UI disusun dari `View`/`Pressable`. |
| Zustand untuk state modul | Hanya `authStore` + `tabBarStore`. Data modul di-fetch per screen (`useState`/`useEffect`). |
| Primary Teal `#27B4AC` | `primary` = `#006a65`; `#27b4ac` = `primaryContainer`. Lihat `frontend/src/theme/colors.ts`. |
| 10 entitas, nama `Assignment` | **13 model**, namanya `DokterPasienAssignment`. Tidak ada model `Konsultasi`. |

Rincian dan alasannya ada di [CLAUDE.md](CLAUDE.md) bagian *Tech Stack* dan
*Entity naming*.

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

- [x] Isi detail environment variable frontend (base URL API) — selesai Hari 9
      (`frontend/.env.example`, dikonsumsi `src/api/client.ts`)
- [ ] Dokumentasi ERD final di `docs/` — perlu update, sudah 13 model
- [ ] Panduan pakai app (rencana Hari 27)
- [ ] Keputusan yang sengaja ditunda: lihat [docs/keputusan-tertunda.md](docs/keputusan-tertunda.md)
