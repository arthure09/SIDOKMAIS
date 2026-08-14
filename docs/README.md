# Isi folder `docs/`

Panduan singkat supaya tiap dokumen baru mendarat di tempat yang benar.

## Yang masuk repo

| Lokasi | Isi | Contoh |
|---|---|---|
| `docs/*.md` | Dokumen proyek yang berlaku terus — dibaca ulang, bukan sekali pakai | `jurnal-pengerjaan.md`, `testing-manual.md`, `keputusan-tertunda.md`, `project-knowledge-koreksi.md`, `pertanyaan-supervisor-modul-lab.md` |
| `docs/laporan-harian/` | Laporan pekerjaan satu hari yang **sudah selesai** | `day-17-30-juli-2026.md` |

Catatan belajar bertanggal (mis. `catatan-belajar-frontend-12-agustus-2026.md`)
juga masuk repo di `docs/` — isinya alasan di balik keputusan, bukan instruksi
sekali pakai.

## Catatan lokal — tidak masuk repo

Ketiga folder di bawah ada di `.gitignore`. Isinya bahan kerja pribadi, bukan
dokumentasi proyek.

| Lokasi | Isi | Cara mengenali |
|---|---|---|
| `docs/prompts/` | Prompt eksekusi — instruksi yang ditempel ke Claude Code atau Stitch | Judulnya "Prompt: …", isinya perintah kerja, punya pre-check/verifikasi |
| `docs/latihan/` | Materi latihan berjenjang untuk dikerjakan sendiri | Judulnya "Challenge", isinya Level 1..n dengan cara cek tiap level |
| `docs/analisa/` | Review & brief — analisa temuan, bukan perintah kerja | Menjelaskan masalah + rekomendasi, tidak menyuruh menulis kode |

Pembagian ini dibuat 12 Agustus 2026; sebelumnya ketiganya menumpuk di
`docs/prompts/`. Kalau salah satu folder nanti perlu ikut masuk repo, hapus
barisnya dari `.gitignore` — bukan pindahkan berkasnya.

## Aturan singkat menaruh dokumen baru

1. Menyuruh seseorang (atau agen) mengerjakan sesuatu → `docs/prompts/`.
2. Laporan pekerjaan yang sudah selesai → `docs/laporan-harian/`.
3. Analisa/review temuan → `docs/analisa/`.
4. Sisanya, kalau akan dibaca lagi berbulan-bulan ke depan → `docs/` langsung.
