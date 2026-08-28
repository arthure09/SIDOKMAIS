# SIDOKMAIS — Context Project

## Ringkasan
Aplikasi mobile dokter untuk RS Dharmais (SIMRS division), dikembangkan solo selama
magang 4 minggu (14 Jul–10 Ags 2026). Nama: SIDOKMAIS (Sistem Informasi Dokter Dharmais).
Fase saat ini: dummy data, backend independen — belum terintegrasi ke SIMRS produksi.

## Tech Stack

> Bagian ini diverifikasi ulang terhadap kode aktual pada 30 Jul 2026 (audit
> dokumentasi Day 17). Beberapa baris sebelumnya menyebut teknologi yang
> direncanakan tapi tidak (atau tidak sepenuhnya) dipakai — sudah dikoreksi
> di bawah, dengan penyimpangannya dicatat eksplisit supaya tidak terulang.

- **Frontend:** React Native + Expo, React Navigation, TypeScript, Zustand
  - **UI:** komponen disusun manual dari primitif React Native (`View`,
    `Pressable`, `Text`) + `StyleSheet`, mengacu ke desain Figma/Stitch.
    *Penyimpangan dari rencana awal* (rencana: "React Native Paper — tampilan
    profesional cepat tanpa desain custom"); dalam praktiknya desain custom
    dari Figma yang dipakai. **`react-native-paper` sudah dilepas seluruhnya** —
    diverifikasi 25 Ags 2026: nol kecocokan di `frontend/package.json` maupun
    `frontend/App.tsx`. Catatan lama di dokumen ini ("masih terpasang",
    "`PaperProvider` masih membungkus app", "nol consumer tapi belum dilepas")
    sudah tidak berlaku dan jangan dipakai sebagai rujukan.
  - **HTTP client:** `fetch` native, dibungkus helper `apiFetch<T>()` di
    `frontend/src/api/client.ts`. **Bukan axios** — axios tidak ada di
    `frontend/package.json` dan tidak pernah dipakai.
  - **State:** Zustand dipakai terbatas untuk 2 hal saja — `authStore` (token
    + identitas dokter) dan `tabBarStore` (state dock tab bar). Data per modul
    (pasien, operasi, notifikasi) **tidak** disimpan di Zustand; tiap screen
    fetch sendiri dengan `useState`/`useEffect`.
  - **Warna:** sumber kebenaran ada di `frontend/src/theme/colors.ts`.
    `primary` = `#006a65`; `#27b4ac` dipakai sebagai `primaryContainer`, bukan
    sebagai primary. Kalau dokumen lain menyebut "Primary Teal `#27B4AC`", itu
    palet brand awal, bukan token yang berlaku di kode.
- **Backend:** Node.js + Express (satu backend, tanpa microservice terpisah).
  **JavaScript (`.js`, CommonJS `require`)** — seluruh 16 file di
  `backend/src/` dan `backend/prisma/` berekstensi `.js`, tidak ada
  `backend/tsconfig.json`, tidak ada dependency `typescript`, dan
  `package.json` menunjuk `main: src/server.js`.
  - *Penyimpangan dari rencana awal:* rencana/dokumentasi lama menyebut backend
    TypeScript (alasan waktu itu: tipe Prisma hampir "gratis", RBAC/JWT lebih
    aman dengan pengecekan saat compile). Ditemukan saat audit dokumentasi
    30 Jul 2026. **Keputusan: tidak dimigrasi.** Sisa waktu magang dipakai
    untuk prioritas fitur; migrasi 16 file di tengah jalan berisiko merusak
    modul yang sudah jalan dan tidak menambah fungsionalitas apa pun.
    Frontend tetap TypeScript. Lihat `docs/keputusan-tertunda.md`.
- DB: PostgreSQL + Prisma ORM
- Auth: JWT + RBAC middleware
- Chatbot: digeser keluar dari Minggu 3 (keputusan Arthuro, 2026-07-29), rencana
  panggil LLM (Gemini Flash primary, DeepSeek cadangan) langsung dari Express —
  status jadi buffer/nice-to-have, belum pasti dikerjakan sebelum akhir magang
- Infra: Docker + docker-compose lokal

## Entity naming
Model Prisma & domain object pakai nama Indonesia sesuai ERD. Kode
(variable/function) tetap camelCase Inggris.

**14 model aktual di `backend/prisma/schema.prisma`** (Radiologi ditambahkan
24 Ags 2026, migration `20260824065505_add_radiologi_module`):
`PemeriksaanRadiologi` — sengaja tanpa tabel item dan tanpa kolom status,
mengikuti bentuk SIMRS (lihat §Integrasi SIMRS no.11).

Daftar sebelumnya (diverifikasi 30 Jul 2026):
`Dokter`, `Pasien`, `Ruangan`, `DokterPasienAssignment`, `Kunjungan`,
`Pengguna`, `Notifikasi`, `Operasi`, `Penjamin`, `Pendapatan`,
`PemeriksaanLab`, `HasilLabItem`, `AuditLog`.

Koreksi dari dokumentasi lama:
- Nama modelnya **`DokterPasienAssignment`**, bukan `Assignment` atau
  `PasienAssignment`.
- **Tidak ada model `Konsultasi`.** Data konsultasi diturunkan dari
  `Kunjungan`; entity `Konsultasi` terpisah masih ERD v2 yang belum diputuskan
  supervisor.
- `AuditLog` sudah ada sejak migration awal — sebelumnya luput dicatat di
  daftar entitas.
- `PemeriksaanLab` + `HasilLabItem` masuk 30 Jul 2026 (migration
  `20260730024026_add_lab_module`). Jumlah entitas: 10 → 11 (AuditLog
  dihitung) → 13.
- 7 enum: `Role`, `JenisKelamin`, `RuanganJenis`, `AssignmentStatus`,
  `StatusKunjungan`, `NotifikasiTipe`, `OperasiStatus`, ditambah 2 enum lab
  `StatusPemeriksaanLab` dan `FlagHasilLab` (total 9).
- Tidak ada `@@map`/`@map` dipakai di schema — nama tabel di DB sama dengan
  nama model.

## Aturan arsitektur wajib diikuti
1. **RBAC**: 2 role — DOKTER, ADMIN. Dokter READ-ONLY untuk Operasi & Konsultasi
   (data ini mensimulasikan sync dari SIMRS lewat Admin). PATCH Pasien masih
   tentative — jangan diimplementasikan sebagai write bebas tanpa catatan eksplisit.
2. **dokterId selalu diambil dari JWT di server**, tidak pernah dari request
   body/query/params. Prinsip keamanan inti, akan direuse oleh chatbot nanti.
3. **Modul Pendapatan** sensitif. Sejak `SUMBER_DATA=simrs` (24 Ags 2026)
   angka jasa medis dibaca dari SIMRS dan `isDummy` TIDAK ikut di respons —
   field itu hanya milik tabel `Pendapatan` PostgreSQL (mode dummy), di mana
   nilainya tetap wajib `true`. Watermark UI "CONTOH DATA DUMMY" pada `DataPendapatanScreen`
   dihapus (keputusan Arthuro, 2026-07-24) — dianggap redundan karena seluruh
   aplikasi masih fase dummy data. Field `isDummy` di DB tetap dipertahankan.
4. **Audit log generik**: semua write action (manual/chatbot) dicatat ke
   AuditLog dengan entityType/entityId/beforeData/afterData JSON.
5. **Chatbot (future)**: arsitektur propose→validate→confirm→audit. LLM tidak
   pernah menulis langsung ke DB. Closed function-set whitelist, bukan freeform NLU.

## Integrasi SIMRS (21 Ags 2026)
Backend bisa membaca modul **Pasien, Kunjungan, Operasi, Konsultasi, Dashboard,
Pendapatan, Lab, dan Radiologi** langsung dari replika MySQL SIMRS RS Dharmais,
dikendalikan env `SUMBER_DATA`:
- `SUMBER_DATA=simrs` — **mode yang berlaku sejak 24 Ags 2026**, replika SIMRS,
  **data pasien asli**. Izin pemakaian sebagai datasource sudah diberikan.
- `SUMBER_DATA=dummy` — PostgreSQL lokal. Bukan lagi mode kerja sehari-hari,
  tapi route-nya TETAP ADA dan tidak boleh dihapus: seluruh test suite berjalan
  di atasnya (dipaksa lewat `backend/jest.setup.js`), dan itu satu-satunya cara
  menguji perilaku endpoint tanpa menyentuh data pasien.

Modul lain (Notifikasi, Kalender, AuditLog, Pengguna) selalu ke PostgreSQL:
SIMRS tidak menyimpannya.

Bentuknya jalur baca kedua, **bukan migrasi** — Postgres tetap rumah untuk
Notifikasi/AuditLog/Pengguna/Konsultasi lokal. File terkait:
`src/lib/simrs.js` (pool + guard read-only), `src/utils/simrsBentuk.js`
(konversi WIB + kode referensi), `src/utils/simrsAkses.js` (scoping).
Route dummy tidak diubah sama sekali; `server.js` memilih salah satu saat boot.

**Layout `src/routes/` (dirapikan 25 Ags 2026 — pemindahan file murni, nol
perubahan logika, 135 tes tetap hijau):**

| Folder | Isi | Terpengaruh `SUMBER_DATA`? |
|---|---|---|
| `routes/dummy/` | 8 modul, PostgreSQL + Prisma | ya — dipakai saat `dummy` |
| `routes/simrs/` | 8 modul, MySQL replika (SQL mentah) | ya — dipakai saat `simrs` |
| `routes/bersama/` | `auth`, `notifikasi`, `kalender` | **tidak** — selalu PostgreSQL |

`dummy/` dan `simrs/` sengaja memakai **nama file yang persis sama** (mis.
`pasien.routes.js` ada di dua-duanya), supaya tiap modul punya pasangan yang
bisa langsung dibandingkan berdampingan. `bersama/` isinya modul yang memang
tidak punya versi SIMRS. Sebelum ini, route dummy tergeletak di akar
`src/routes/` sehingga tidak simetris dengan `simrs/`.

Konsekuensi buat siapa pun yang menambah modul: menambah satu modul bermode
berarti menambah **dua** file dengan nama sama di `dummy/` dan `simrs/`, lalu
satu baris ternary di `server.js`. Modul yang tidak ada di SIMRS masuk
`bersama/` dan tidak perlu ternary sama sekali.

Hal yang wajib diingat:
1. **Prisma tidak dipakai untuk SIMRS.** Connector MySQL Prisma cuma melihat
   satu database per client, sementara query di sini menjangkau `master`,
   `pendaftaran`, `medis`, `perjanjian` sekaligus. Pakai SQL mentah lewat
   `mysql2`, nama tabel selalu lengkap dengan skemanya.
2. **Scoping berubah semantik.** Mode dummy pakai `DokterPasienAssignment`
   (penugasan, tidak terikat waktu). SIMRS tidak punya tabel itu — penggantinya
   gabungan DPJP per-pendaftaran: `pendaftaran.tujuan_pasien.DOKTER` ∪
   `dpjp_bersama` ∪ `dpjp_pendamping`. Akibatnya akses dokter mengikuti
   keterlibatannya di pendaftaran, tidak permanen.
3. **Jangan tulis `kolom IN (<union>)` langsung** di klausa akses — MySQL
   mengubahnya jadi DEPENDENT SUBQUERY (union dijalankan ulang tiap baris).
   Pakai `joinAksesNorm()` atau `klausaAksesNorm()` dari `utils/simrsAkses.js`;
   keduanya membungkus union dalam derived table. Ada tes penjaganya.
4. **Jembatan identitas lewat NIP**, bukan kolom baru. `Dokter.nip` sudah
   `@unique` dan `master.dokter.NIP` ber-index, jadi tidak ada perubahan schema
   maupun bentuk JWT. Aturan #2 tetap utuh — `req.user.dokterId` diterjemahkan
   ke `master.dokter.ID`, tidak pernah diterima dari request.
5. **Mode SIMRS read-only mutlak.** POST/PATCH/DELETE `/api/operasi` membalas
   405. Akun DB-nya `GRANT SELECT` saja.
6. **Jangan log baris hasil query SIMRS.** Blok catch di `lib/simrs.js` sengaja
   hanya mencatat kode error, tidak pernah SQL atau isi baris.
7. **Tes selalu mode dummy**, dipaksa lewat `backend/jest.setup.js`. Tanpa itu,
   `.env` bernilai `simrs` membuat suite Supertest diam-diam menguji route SIMRS
   dengan fixture PostgreSQL (10 tes merah, penyebabnya tidak kelihatan).
8. **MySQL SIMRS versi 5.7** — tidak ada window function maupun CTE. Pola
   "satu baris teratas per grup" harus MAX/MIN + GROUP BY lalu join balik.
9. **Lab ada di skema `layanan`, bukan `lis`.** `lis*` itu jembatan mentah alat
   analyzer, tanpa kaitan ke kunjungan/dokter. Rantainya
   `layanan.order_lab` → `order_detil_lab` → `hasil_lab`. Satu pemeriksaan =
   `(ORDER_ID, TINDAKAN)`, bukan `REF` — satu `REF` dipakai beberapa TINDAKAN,
   jadi pemisahnya `parameter_tindakan_lab.TINDAKAN`. Detail lengkap +
   4 pertanyaan terbuka: `simrs-schema-mapping.md` §5.
10a. **Jasa medis dibaca dari `db_remunmedis.tb_tampilsiremdis`**, bukan
   `tb_remun_new` (dikoreksi 24 Ags 2026). Yang lama berhenti 15 Feb 2026;
   yang dipakai SIREMDIS berjalan sampai sekarang. Dua tabel ini punya kolom
   `ID_SIREMDIS` dengan rentang angka bertumpuk tapi **auto-increment
   sendiri-sendiri** — menjoin keduanya lewat kolom itu menghasilkan
   pasangan baris yang sama sekali tidak berhubungan. Pindah sumber juga
   menurunkan angka bulan-bulan lama ~12%, karena `tb_remun_new` memuat baris
   yang memang tidak ditampilkan SIREMDIS.
10. **`hasil_lab.HASIL` = nilai ukur, `hasil_lab.NILAI` = rentang rujukan.**
   Nama kolomnya menyesatkan dan tertukarnya tidak memicu error apa pun.
11. **Radiologi TIDAK boleh menyalin pola Lab.** Jalur ke pasien lewat
   `layanan.tindakan_medis` (`ID` = REF, membawa `KUNJUNGAN`), bukan lewat
   `order_detil_rad` — 39% hasil (5.393 dari 13.685 baris Agustus 2026) tidak
   punya baris detil order sama sekali, jadi pola lab membuat riwayat radiologi
   bolong sepertiga tanpa error apa pun. Lewat `tindakan_medis` cocoknya 100%.
   Isi laporannya NARASI (`hasil_rad.HASIL`), bukan parameter: `KESAN` cuma 15%
   terisi (kesimpulan ditulis di dalam narasi), `USUL` 0%, `DOKTER_SATU` 7%,
   `STATUS_KONFIRMASI` 6% — tidak satu pun bisa dipakai menyaring.

Pelajaran dari uji coba data asli (21 Ags 2026) — semuanya hal yang TIDAK
terlihat dari skema, cuma ketahuan waktu query data sungguhan:
- `medis.tb_konsul.nopen` kosong di 99,4% baris. Jalur ke pasien harus lewat
  `tk.kunjungan`, bukan `tk.nopen` (dua-duanya char(10), sama-sama masuk akal).
- `pendaftaran.dpjp_diagnosa` cuma mengisi 1,25% kunjungan. Sumber diagnosa
  yang benar-benar terisi adalah `pendaftaran.pendaftaran.DIAGNOSA_MASUK`
  (99,8%) lewat lookup `master.diagnosa_masuk` (ID → ICD + teks).
- Teks di `master.diagnosa_masuk` sebagian sampah (".", "-"). Disaring
  `diagnosaBersih()`.
- Query COUNT jangan bawa LEFT JOIN identitas yang tidak dipakai penyaring —
  itu saja menurunkan konsultasi dari 3,4s ke 0,13s.
- Satu dokter senior bisa terkait 200 ribu pendaftaran / 14 ribu pasien unik.
  Asumsi "dokter pegang belasan pasien" dari data dummy tidak berlaku.

Verifikasi query tanpa membaca data pasien: `simrs-exploration/verify-queries.js`
(EXPLAIN semua query, mengembalikan rencana eksekusi, nol baris). Pemetaan skema
lengkap + daftar pertanyaan terbuka ke DBA: `simrs-exploration/docs/simrs-schema-mapping.md`.

**Status izin:** izin memakai replika sebagai datasource aplikasi SUDAH
DIBERIKAN (Arthuro, 24 Ags 2026).

**Dua file env, dipilih per lokasi (dipisah 25 Ags 2026).** Replika SIMRS ada
di alamat LAN internal (`SIMRS_HOST`), jadi mode `simrs` hanya bisa jalan di
jaringan RS — di luar RS backend wajib mode `dummy`. Karena itu env-nya dipecah:

| File | Kapan | Butuh WiFi RS? |
|---|---|---|
| `backend/.env.dummy` | di luar RS | tidak |
| `backend/.env.simrs` | di dalam RS | ya |
| `backend/.env` | salinan aktif salah satunya — **jangan diedit langsung** | — |

Perintahnya `npm run dev:dummy` / `npm run dev:simrs` (menyalin file env yang
sesuai ke `.env`, lalu `nodemon`). `.env.dummy` sengaja **tidak memuat
`SIMRS_HOST/USER/PASSWORD` sama sekali** — di mode dummy tidak ada satu pun
query ke SIMRS, jadi kredensial replika tidak perlu ikut di laptop yang dibawa
keluar RS.

Ketiganya di-gitignore. Polanya sekarang `**/.env.*` dengan pengecualian
`!**/.env.example`, bukan daftar nama satu per satu: `**/.env` cuma cocok persis
dengan `.env`, jadi turunan seperti `.env.dummy` akan lolos dan ter-commit kalau
tidak disapu secara umum.

Default di KODE (`server.js`) sengaja tetap `dummy` dan tidak diubah: itu bukan
soal izin, tapi pengaman kalau env gagal termuat — env kosong yang otomatis
membuka data pasien asli adalah kegagalan diam-diam. Menyalakan mode SIMRS
harus selalu berupa tindakan sadar (memilih file env), bukan kebetulan.

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

### Minggu 3 — Hasil Lab & Dashboard Kinerja (28 Jul-3 Ags)
Chatbot digeser keluar dari minggu ini (keputusan Arthuro, 2026-07-29), diganti
2 fitur dummy-data: Cari Hasil Lab (by No. RM) dan Dashboard Kinerja Dokter.
Lihat `docs/prompts/fitur-cari-hasil-lab.md` dan `docs/prompts/desain-hasil-lab-stitch.md`.
- Hari 15 (Sel 28 Jul): Catch-up modul Notifikasi (Prioritas 1 & 2, tertinggal dari Minggu 2) — **selesai**
- Hari 16 (Rab 29 Jul): Desain & struktur data Hasil Lab — `labMock.ts` (dummy,
  dikelompokkan per laboratorium — nama masih placeholder), desain visual
  (prompt Stitch), rencana restrukturisasi navigasi (tab Notifikasi disembunyikan
  dari tab bar, tetap diakses lewat bel di Home), susun pertanyaan buat supervisor
  (daftar laboratorium asli, metrik dashboard kinerja)
- Hari 17 (Kam 30 Jul): **REVISI — dikerjakan: fondasi data backend modul lab**
  (2 entitas `PemeriksaanLab`/`HasilLabItem`, 2 enum, migration
  `20260730024026_add_lab_module`, konstanta `LAB_KATEGORI`, seed lab, hygiene
  seed) — **selesai**. Rencana awal hari ini adalah `CariHasilLabScreen`, tapi
  screen tanpa data asli hanya akan jadi mock kedua; jadi urutannya dibalik
  jadi data → endpoint → screen. Lihat `docs/laporan-harian/day-17-30-juli-2026.md`.
- Hari 18 (Jum 31 Jul): **REVISI** — endpoint backend modul lab (list + detail
  hasil lab, scoped lewat `DokterPasienAssignment`). Rencana awal
  (restrukturisasi navigasi tab Notifikasi → Hasil Lab) digeser.
- Hari 19 (Sab 1 Ags): **REVISI** — frontend screen hasil lab, mengganti sumber
  data `labMock.ts` ke endpoint asli. Rencana awal (desain Dashboard Kinerja)
  digeser ke buffer Minggu 4.
- Hari 20 (Min 2 Ags): Implementasi UI Dashboard Kinerja (kartu ringkasan +
  grafik, reuse pola "Statistik Pasien Mingguan" di Home)
- Hari 21 (Sen 3 Ags): Testing manual kedua fitur, update jurnal +
  testing-manual, review Minggu 3 — idealnya feedback supervisor soal daftar
  lab & metrik dashboard sudah masuk di titik ini buat disesuaikan

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
  kebijakan data ke LLM pihak ketiga, handover pasca-magang, daftar
  laboratorium asli RS Dharmais (dipakai fitur Cari Hasil Lab), metrik apa
  saja yang relevan untuk Dashboard Kinerja Dokter.
- Chatbot digeser keluar dari Minggu 3 (keputusan Arthuro, 2026-07-29) —
  status jadi buffer/nice-to-have, prioritas final belum diputuskan.
  Diganti fitur Cari Hasil Lab (dummy, dikelompokkan per laboratorium
  placeholder) dan Dashboard Kinerja Dokter (dummy, metrik masih tentative).
  Tab bottom-nav "Notifikasi" diganti "Hasil Lab" secara visual, tapi route
  Notifikasi tetap ada (disembunyikan dari tab bar, diakses lewat bel di
  header Home) — modul itu sudah tersambung backend asli & sudah dites,
  jadi tidak dihapus.
- `DetailLaporanLabScreen` (screen Notifikasi → Detail Laporan Lab) **dihapus
  total** (keputusan Arthuro, 2026-08-14) — screen dekoratif dari eksplorasi
  Figma ini sudah digantikan modul Cari Hasil Lab yang tersambung backend asli
  (`HasilLabListScreen`/`HasilLabDetailScreen`), jadi tidak perlu ada dua jalur
  ke data yang sama. Ikut dihapus: kartu demo statis kategori "Lab" +
  chip filter "Hasil Lab" di `NotifikasiScreen`, route `DetailLaporanLab`, dan
  `frontend/src/mocks/notifikasiMock.ts` (jadi nol consumer). Notifikasi
  sekarang murni dari `/api/notifikasi` dengan 2 kategori: Pasien Baru & Jadwal.
- `DetailPembatalanOperasiScreen` (screen bonus Figma di luar 6 screen batch
  ini) dihapus total (keputusan Arthuro, 2026-07-24) — dokter tidak punya
  wewenang mengatur/menindaklanjuti jadwal operasi (aplikasi ini SIMRS info
  system, read-only untuk Operasi sesuai aturan #1), jadi detail pembatalan
  tidak perlu screen terpisah. Kartu jadwal berstatus CANCELLED di
  `JadwalOperasiKonsulScreen` sekarang non-tappable (`disabled`), cukup
  ditampilkan inline di list.
