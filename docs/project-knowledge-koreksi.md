# Koreksi Project Knowledge Claude.ai — 30 Juli 2026

**Kenapa file ini ada:** *project knowledge* di Claude.ai (`memory.md`) di-mount
read-only dari sisi repo, jadi tidak bisa dikoreksi lewat Claude Code. Isi di
bawah adalah **teks pengganti siap tempel** — buka project SIDOKMAIS di
Claude.ai, buka memory/knowledge-nya, ganti seluruh isinya dengan blok di bawah.

**Catatan soal `rencana-pengembangan-aplikasi-dokter.md`:** dokumen itu **tidak
perlu dikoreksi**. Isinya adalah *rencana awal*, dan sebagai rencana ia tidak
salah — React Native Paper dan axios memang direncanakan waktu itu. Yang salah
adalah `memory.md`, karena ia mengaku mendeskripsikan **kondisi saat ini**.
Biarkan dokumen rencana apa adanya sebagai arsip; penyimpangannya sudah dicatat
di `CLAUDE.md`.

---

## TEKS PENGGANTI (salin dari sini ke bawah)

**Purpose & context**

Arthuro is a Computer Engineering student completing a solo internship at RS Dharmais (a national cancer referral hospital in Indonesia), building **SIDOKMAIS** (Sistem Informasi Dokter Dharmais) — a mobile doctor information application for the hospital's SIMRS division. The project runs approximately mid-July to mid-August 2026 across a structured 4-week timeline. It serves dual purposes: an internship deliverable and portfolio work relevant to Arthuro's thesis on agentic AI systems and an Apple Developer Academy application.

**Key stakeholders:** A supervisor (providing institutional oversight and scope approval) and Mas Fauzi (a database administrator managing access to the hospital's existing SIMRS).

**Core modules:** Patient list, surgery/operation schedule (view-only), consultation schedule (view-only), doctor revenue (dummy), in-app notifications, and lab results. The AI chatbot was moved out of Week 3 scope on 2026-07-29 and is now a buffer/nice-to-have that may not be built before the internship ends.

**Portfolio context:** Arthuro has prior relevant experience — RiverEye (IoT flood monitoring with React Native + WebSocket) and A.U.R.A. (fraud detection) — which informed the tech stack choices.

**Critical architectural constraint:** `dokterId` must **always** come from server-side JWT claims, never from client, request body, or LLM input — this is a non-negotiable security principle established early and reinforced repeatedly. Doctors are READ-ONLY for Operasi and Konsultasi (these simulate a sync from SIMRS via Admin).

---

**Current state (as of Day 17, 2026-07-30)**

- **Active phase:** Week 3. Days 1–16 complete. Day 17 (30 Jul) delivered the lab module data foundation. Days 18–19 were re-sequenced to backend endpoint → frontend screen for the lab module; the Dashboard Kinerja Dokter feature no longer has a Week 3 slot and has effectively slipped to Week 4 buffer.
- **Infrastructure:** Docker environment on a Windows/WSL2 laptop in Surabaya, accessed from Arthuro's MacBook via Tailscale. The Windows PostgreSQL 17 service (`postgresql-x64-17`) should be set to Manual startup to prevent port 5432 conflicts on reboot. Tailscale dropping mid-session will cause Prisma migrations to fail — reconnect and re-run, do not create a new migration.
- **Backend:** Node.js + Express + Prisma + PostgreSQL. **JavaScript, not TypeScript** — all 16 files in `backend/src/` and `backend/prisma/` are `.js` using CommonJS `require`. There is no `backend/tsconfig.json` and no `typescript` dependency; `package.json` points to `main: src/server.js`.
- **Schema: 13 models** (`Dokter`, `Pasien`, `Ruangan`, `DokterPasienAssignment`, `Kunjungan`, `Pengguna`, `Notifikasi`, `Operasi`, `Penjamin`, `Pendapatan`, `PemeriksaanLab`, `HasilLabItem`, `AuditLog`) and 9 enums. The assignment model is named **`DokterPasienAssignment`**, not `Assignment`. **There is no `Konsultasi` model** — consultation data is derived from `Kunjungan`; a separate `Konsultasi` entity remains unapproved ERD v2. No `@@map`/`@map` is used, so DB table names match model names.
- **Frontend:** React Native + Expo, **TypeScript**. 13 screens exist. Some are wired to real API endpoints (patient list/detail, operations schedule, notifications); others still read from `frontend/src/mocks/` (revenue, home summary, profile, lab detail).
  - **HTTP client: native `fetch`**, wrapped in an `apiFetch<T>()` helper at `frontend/src/api/client.ts`. **Not axios** — axios is not a dependency and was never used.
  - **UI: hand-built from React Native primitives** (`View`, `Pressable`, `Text`) + `StyleSheet`, following Figma/Stitch designs. `react-native-paper` is still installed and `PaperProvider` still wraps the app in `App.tsx`, but **zero Paper components are used anywhere in `src/`**. The provider was left in place because removing it is risky and not urgent.
  - **State: Zustand, but narrowly** — only `authStore` (token + doctor identity) and `tabBarStore` (tab bar dock state). Per-module data (patients, operations, notifications) is **not** in Zustand; each screen fetches with `useState`/`useEffect`.
  - **Colors:** source of truth is `frontend/src/theme/colors.ts`. `primary` is `#006a65`. `#27b4ac` is `primaryContainer`, **not** primary. Older docs calling `#27B4AC` "Primary Teal" describe the original brand palette, not the tokens in code.
- **Testing:** Jest + Supertest exist for the patient list endpoints (7/7 passing). Later modules (operations, notifications) were verified manually via curl against the dev DB rather than with Jest. Frontend has not been smoke-tested on Expo Go / a physical device; verification so far is `npx tsc --noEmit` plus code review.
- **Repository:** monorepo (`backend/`, `frontend/`, `docs/`) with root `CLAUDE.md` as the context file.

---

**Lab module (Day 17, 2026-07-30) — decisions and open risk**

Two tables: `PemeriksaanLab` (one lab order) and `HasilLabItem` (one parameter value within an order). Plus enums `StatusPemeriksaanLab` / `FlagHasilLab`, `NotifikasiTipe.HASIL_LAB`, `relatedId`/`relatedType` on `Notifikasi`, `LAB_KATEGORI` (6 categories) in `backend/src/constants/lab.js`, and migration `20260730024026_add_lab_module`.

Design decisions:
1. Two entities, not one — one order yields many parameters.
2. **`pasienId` required, `kunjunganId` nullable; access is granted via `DokterPasienAssignment`, not `kunjungan.dokterId`.** Clinical reasoning: oncology patients are managed across multiple doctors, and orders are often placed by someone other than the responsible physician. Access-by-visit would prevent a responsible doctor from seeing their own patient's results. **This is still an unconfirmed assumption baked into the schema — the single most important thing to confirm with the supervisor.**
3. `kategori` is String, not enum — the hospital's official category list is unconfirmed; String → enum is far cheaper than the reverse.
4. `nilai` is String, not Decimal — many results are qualitative ("Reaktif", "3+", "Tidak ditemukan sel ganas").
5. `flag` is derived by comparing the generated value against the same reference range used to generate it, never randomized independently.

**Unresolved scope question (raised 2026-07-30, not yet decided):** Arthuro's actual intent is narrower than what was built — a doctor sees their own patients and views a **PDF already generated by SIMRS**. If the end state is PDF-only, `HasilLabItem` and the per-parameter seed logic are speculative and may never ship. The decision is blocked on Mas Fauzi confirming whether SIMRS stores lab results as structured per-parameter rows, as documents, or both. Until that answer arrives, the Day 18 endpoint should be shaped so the per-parameter payload is **optional**, so the Day 19 screen does not become dependent on data that may be discarded.

---

**On the horizon**

- Day 18 (31 Jul): backend endpoints for the lab module — list + detail, scoped via `DokterPasienAssignment`.
- Day 19 (1 Aug): frontend lab screen, replacing `labMock.ts` with real endpoint data.
- Day 21 (3 Aug): seed data-quality fixes — hematology parameter coupling (Hb/Hematocrit/Erythrocytes move together), abnormal-flag direction (post-chemo patients should skew RENDAH not TINGGI), and optionally Kimia Klinik panel weighting.
- Week 4 (4–10 Aug): RBAC hardening, audit log verification, integration testing, bug fixing, user documentation, final review.
- Post-internship / buffer: SIMRS integration, revenue module depth, chatbot, remote push notifications, backend TypeScript migration.
- **Pending supervisor answers:** lab access policy (most urgent), lab feature scope (document vs per-parameter), download/share policy for lab results, clinical data formats (ICD-10, No. RM), third-party LLM data policy, post-internship handover.
- **Pending from Mas Fauzi:** lab result storage structure, official lab category and unit names, plus `Operasi` and `Penjamin` table structures still outstanding from an earlier request.

---

**Key learnings & principles**

- **Security:** `dokterId` always from server-side JWT — never from request input or LLM output.
- **Access control follows clinical reality, not schema convenience.** The lab access decision is the clearest example: the technically easy path (scope by visit) would have made the feature useless for cross-managed oncology patients.
- **Backend stayed JavaScript.** Earlier documentation claimed TypeScript was chosen deliberately (Prisma types nearly free, safer RBAC/JWT with compile-time checks). In reality the backend was written in JavaScript from the start; the discrepancy surfaced during the 2026-07-30 documentation audit. **Decision: not migrating.** Fewer than two weeks remain, migrating 16 files mid-project risks breaking tested modules, and it adds no functionality. Frontend stays TypeScript.
- **Documentation drift is a real failure mode.** Six stack claims in project docs had diverged from the code. Because these docs are fed back as prompt context, wrong facts kept re-injecting themselves into subsequent work. Verify claims against code before reusing them as context.
- **Determinism that looks verified can be fake.** `faker.seed()` was in place but `pickOne`/`pickMany` still used `Math.random()`, so row counts stayed stable while contents varied. The same pattern still exists, unfixed, in `backend/prisma/seed-kunjungan-operasi.js:67,71`.
- **Dummy data must be clinically plausible, not just internally consistent.** A flag that contradicts its own reference range is spotted by a doctor in seconds and discredits the parts of the app that are correct.
- **Docker/WSL2:** `db` hostname for container-to-container, `localhost` in `.env` for host-side Prisma CLI. `seed.js` needs manual dotenv loading or `export $(grep -v '^#' .env | xargs)`.
- **Revenue complexity:** BPJS patients yield roughly 20% of what the hospital receives (not 20% of the original tariff).
- **Scope discipline:** the doctor app is view-only for operations/consultations. This was discovered mid-planning and cascaded into ERD revisions and chatbot scope reduction.

---

**Approach & patterns**

- **Claude as prompt generator:** Arthuro's primary workflow is receiving structured prompts from Claude formatted for direct input into Claude Code, rather than having Claude write code in chat. This is the established and preferred pattern.
- **Prompt format:** Indonesian with English technical terms; includes a mandatory pre-check section instructing Claude Code to inspect the actual schema and file structure before writing code; explicitly scopes what is out of bounds.
- **Daily reports:** `docs/laporan-harian/day-NN-DD-month-YYYY.md` — plain-language Indonesian, understandable without deep technical background, for internship reporting. A parallel chronological technical journal lives at `docs/jurnal-pengerjaan.md`. Deferred decisions are tracked in `docs/keputusan-tertunda.md`.
- **Communication preference:** Indonesian; direct and structured; options with explicit trade-offs rather than a single prescribed direction; minimal padding. Push back when the premise looks wrong rather than executing it silently.
- **Verification discipline:** distinguishes planning artifacts from actual deliverables — verifies with concrete checks (tests passing, migrations applied, row counts queried) before marking a day complete.

---

**Tools & resources**

- **Frontend:** React Native + Expo, Expo Go, TypeScript, Zustand (auth + tab bar only), native `fetch` via `apiFetch<T>()`. `react-native-paper` installed but unused.
- **Backend:** Node.js, Express, **JavaScript (CommonJS)**, Prisma ORM, PostgreSQL, JWT + RBAC middleware, Docker + docker-compose.
- **Database tooling:** DBeaver, @faker-js/faker (`fakerID_ID` locale), bcrypt.
- **Chatbot LLM (if ever built):** Gemini Flash primary, DeepSeek backup.
- **Networking:** Tailscale for Mac↔WSL2 connectivity.
- **Dev environment:** MacBook Air 2019 (frontend/Expo), Windows laptop with WSL2 in Surabaya (Docker, backend, DB).
- **Build:** EAS Build. Note: Expo Go dropped remote push notification support in SDK 53, so push requires a development build.
- **UI design:** brand palette origin — Deep Teal `#0D3D3B`, Accent Lime `#D0D72C`, Near-black Teal `#052329`. **In code, `primary` is `#006a65` and `#27b4ac` is `primaryContainer`** (`frontend/src/theme/colors.ts` is authoritative). Poppins and Nunito fonts.
- **Design tools:** Figma ("aplikasi-dokter-dharmais"), Google Stitch, pptxgenjs.
- **Version control:** Git monorepo.
