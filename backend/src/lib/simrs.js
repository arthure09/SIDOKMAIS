const mysql = require("mysql2/promise");

// Koneksi ke replika MySQL SIMRS RS Dharmais. Sumber data asli untuk modul
// Pasien, Operasi, dan Konsultasi ketika SUMBER_DATA=simrs.
//
// PENTING — ini database berisi data pasien kanker ASLI, bukan dummy.
// Tiga lapis pembatas, sengaja bertumpuk:
//   1. Akun DB-nya read-only (GRANT SELECT ON *.*). Ini pembatas sebenarnya —
//      apa pun bug di app ini, SIMRS tidak bisa rusak.
//   2. `q()` di bawah menolak statement selain SELECT. Murah, dan menangkap
//      kesalahan ketik sebelum jadi error dari server.
//   3. Tidak ada baris hasil query yang boleh masuk ke console/log. Baris di
//      sini identitas pasien; log aplikasi bukan tempatnya. Blok catch di
//      bawah sengaja hanya mencatat kode error, tidak pernah `err.sql` atau
//      isi baris.
//
// Skema SIMRS tidak punya foreign key sama sekali, jadi semua join di modul
// ini adalah konvensi, bukan constraint yang dijamin DB — perlakukan hasil
// LEFT JOIN sebagai boleh-kosong di mana pun.
//
// Prisma tidak dipakai untuk koneksi ini: connector MySQL Prisma hanya melihat
// satu database per client, sementara query di sini menjangkau `master`,
// `pendaftaran`, `medis`, dan `perjanjian` sekaligus. Nama tabel selalu
// ditulis lengkap dengan skemanya.

let pool;

function getPool() {
  if (!pool) {
    const wajib = ["SIMRS_HOST", "SIMRS_USER", "SIMRS_PASSWORD"];
    const kurang = wajib.filter((k) => !process.env[k]);
    if (kurang.length > 0) {
      throw new Error(
        `SUMBER_DATA=simrs tapi env belum lengkap: ${kurang.join(", ")}. ` +
          "Lihat backend/.env.example."
      );
    }

    pool = mysql.createPool({
      host: process.env.SIMRS_HOST,
      port: Number(process.env.SIMRS_PORT) || 3306,
      user: process.env.SIMRS_USER,
      password: process.env.SIMRS_PASSWORD,
      connectionLimit: Number(process.env.SIMRS_POOL_LIMIT) || 5,
      // Tanpa ini mysql2 mengubah DATE/DATETIME jadi Date memakai timezone
      // proses. Server SIMRS mencatat waktu WIB; biarkan string mentah dan
      // biar pemanggil yang memutuskan (lihat tanggalWIB di utils/simrsBentuk).
      dateStrings: true,
      // Query di modul ini semuanya read-only dan dipanggil dari request HTTP.
      // Kalau replika lambat, lebih baik request-nya gagal cepat daripada
      // menggantung koneksi sampai penuh.
      connectTimeout: 10_000,
    });
  }
  return pool;
}

// Statement non-SELECT ditolak sebelum menyentuh jaringan. Akun DB-nya memang
// sudah read-only, tapi pesan error dari sini jauh lebih jelas daripada
// "command denied" dari MySQL, dan menutup kemungkinan modul lain memakai pool
// ini untuk menulis kalau suatu saat grant-nya berubah.
function q(sql, params = []) {
  if (!/^\s*select\b/i.test(sql)) {
    throw new Error("lib/simrs hanya untuk SELECT — koneksi SIMRS read-only");
  }
  return getPool()
    .execute(sql, params)
    .then(([rows]) => rows)
    .catch((err) => {
      // Sengaja tanpa isi baris & tanpa SQL: keduanya bisa memuat identitas
      // pasien (mis. parameter NORM) dan tidak boleh mendarat di log.
      console.error("Query SIMRS gagal:", err.code || err.name);
      throw new Error("Gagal membaca data dari SIMRS");
    });
}

const aktif = process.env.SUMBER_DATA === "simrs";

async function tutup() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = { q, aktif, tutup };
