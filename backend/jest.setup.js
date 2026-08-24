// Tes SELALU dijalankan terhadap route mode dummy.
//
// Kenapa perlu: server.js memilih route berdasarkan SUMBER_DATA, dan nilainya
// dibaca dari backend/.env lewat dotenv. Begitu .env disetel ke "simrs",
// seluruh suite yang memakai Supertest diam-diam berpindah menguji route SIMRS
// memakai fixture PostgreSQL — 10 tes langsung merah, dan penyebabnya sama
// sekali tidak kelihatan dari pesan errornya.
//
// Disetel di sini (jest `setupFiles`, jalan sebelum modul apa pun di-require)
// karena dotenv.config() TIDAK menimpa nilai yang sudah ada di process.env.
// Jadi baris ini menang atas isi .env, bukan sebaliknya.
//
// Route versi SIMRS diuji terpisah lewat src/__tests__/simrs.test.js (fungsi
// murni) dan simrs-exploration/verify-queries.js (validasi SQL via EXPLAIN) —
// keduanya tidak butuh koneksi ke data pasien.
process.env.SUMBER_DATA = "dummy";
