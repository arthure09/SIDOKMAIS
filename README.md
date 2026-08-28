# SIDOKMAIS

Sistem Informasi Dokter Dharmais — aplikasi mobile untuk dokter RS Dharmais
(SIMRS division). Monorepo backend (Express) + frontend (React Native/Expo).
Detail arsitektur, aturan RBAC, dan konteks project lengkap ada di
[CLAUDE.md](CLAUDE.md).

## Tech stack

- **Backend** — Node.js + Express, JavaScript (CommonJS), Prisma ORM,
  PostgreSQL, JWT + RBAC (role `DOKTER`/`ADMIN`).
- **Frontend** — React Native + Expo, TypeScript, React Navigation, Zustand
  (dipakai terbatas untuk state login + tab bar; data tiap modul di-fetch per
  screen).
- **Dua sumber data** di backend, dipilih lewat env `SUMBER_DATA`:
  - `dummy` — PostgreSQL lokal berisi data seed sintetis. Default untuk
    development, dan satu-satunya mode yang bisa dijalankan di luar jaringan
    RS Dharmais.
  - `simrs` — replika MySQL SIMRS RS Dharmais (data pasien asli, read-only).
    Hanya bisa diakses dari jaringan internal RS dan butuh kredensial replika
    yang tidak disertakan di repo ini.

## Struktur folder

```
sidokmais/
├── backend/    Node.js + Express + Prisma + PostgreSQL
├── frontend/   React Native + Expo + TypeScript
├── docs/       Dokumentasi teknis tambahan
└── CLAUDE.md   Konteks project lengkap (stack, aturan arsitektur, entity naming)
```

## Prasyarat

- Node.js 18+ dan npm
- Docker + Docker Compose (untuk PostgreSQL lokal)
- `openssl` (atau alat sejenis) untuk generate JWT secret
- Expo Go (app di HP) atau emulator Android/iOS, untuk menjalankan frontend

## Setup & jalankan backend

```bash
cd backend
cp .env.example .env
```

Isi `.env`:
- `DATABASE_URL` — arahkan ke Postgres lokal, mis.
  `postgresql://sidokmais:sidokmais@localhost:5432/sidokmais?schema=public`
- `JWT_SECRET` — generate dengan `openssl rand -base64 48`; server menolak
  start kalau kosong, terlalu pendek, atau masih placeholder
- `SUMBER_DATA` — set ke `"dummy"` untuk development lokal (`"simrs"` cuma
  jalan di jaringan RS dan butuh kredensial replika — lihat CLAUDE.md)

```bash
docker compose up -d db      # start PostgreSQL
npx prisma migrate deploy    # terapkan schema
npm run prisma:seed          # generate data dummy — catat username yang di-print
npm run prisma:seed:radiologi  # seed modul Radiologi (script terpisah)
npm run dev
```

Server default di `http://localhost:3000`. Cek `GET /health` untuk pastikan
jalan. Password login akun dummy hasil seed: `Sidokmais#2026` (role dokter) /
`admin123` (role admin) — detail lengkap di `backend/prisma/seed.js`.

Alternatif: `docker compose up -d` (tanpa `db` di akhir) menjalankan backend
+ database sekaligus lewat container, tanpa perlu Node.js terinstall lokal.

Test suite:
```bash
npm test
```
Selalu jalan di mode `dummy` (dipaksa lewat `jest.setup.js`), jadi tidak
butuh koneksi apapun ke SIMRS.

## Setup & jalankan frontend

```bash
cd frontend
cp .env.example .env    # sesuaikan EXPO_PUBLIC_API_URL kalau perlu
npm install
npx expo start
```

Scan QR code dengan Expo Go di HP. Kalau testing di device fisik dan backend
jalan di komputer lain pada jaringan yang sama, ganti `EXPO_PUBLIC_API_URL`
ke IP komputer itu (bukan `localhost`) — `localhost` di HP merujuk ke HP itu
sendiri, bukan komputer tempat backend jalan.

## Dokumentasi lebih lanjut

- [CLAUDE.md](CLAUDE.md) — arsitektur, aturan RBAC, entity naming, integrasi SIMRS
- [docs/testing-manual.md](docs/testing-manual.md) — checklist testing manual
- [docs/keputusan-tertunda.md](docs/keputusan-tertunda.md) — keputusan desain yang masih menunggu konfirmasi
