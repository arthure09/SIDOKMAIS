// Penjaga untuk skrip seed, yang menghapus SELURUH isi tabel lewat deleteMany().
// Di-require di baris pertama tiap seed; melempar (membatalkan skrip) kalau
// DATABASE_URL menunjuk host yang bukan DB lokal.
//
// Yang diperiksa host di DATABASE_URL, BUKAN NODE_ENV: skenario bahayanya
// adalah hari kita dapat akses DB SIMRS — waktu itu DATABASE_URL sudah
// menunjuk server sungguhan sementara NODE_ENV kemungkinan besar masih kosong,
// jadi cek NODE_ENV tidak akan menangkap apa pun.
const HOST_LOKAL = ["localhost", "127.0.0.1", "::1", "db"]; // "db" = nama service di docker-compose

const url = process.env.DATABASE_URL;

// DATABASE_URL belum ke-load (mis. dijalankan tanpa lewat CLI prisma) bukan
// kasus berbahaya — Prisma sendiri yang akan gagal dengan pesannya sendiri.
if (url) {
  const host = new URL(url).hostname;

  if (!HOST_LOKAL.includes(host)) {
    if (process.env.SEED_IZINKAN_NONLOKAL === "1") {
      console.warn(`PERINGATAN: seed jalan melawan host non-lokal "${host}" (SEED_IZINKAN_NONLOKAL=1).`);
    } else {
      throw new Error(
        `Seed dibatalkan: DATABASE_URL menunjuk host "${host}", bukan DB lokal. ` +
          "Skrip ini MENGHAPUS seluruh isi tabel. Kalau memang disengaja, " +
          "jalankan ulang dengan SEED_IZINKAN_NONLOKAL=1."
      );
    }
  }
}
