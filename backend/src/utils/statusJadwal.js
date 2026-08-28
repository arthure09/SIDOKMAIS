const { rentangHariWIB } = require("./wib");

// Status jadwal (Operasi & Kunjungan) yang DITURUNKAN dari tanggal/jam saat
// dibaca, bukan yang tersimpan apa adanya di DB.
//
// Masalah yang diselesaikan: status di DB itu snapshot saat record dibuat/
// disync, dan tidak ikut bergerak seiring waktu. Akibatnya jadwal 10 Agustus
// masih tampil "Terjadwal" padahal harinya sudah lewat dua hari.
//
// PENTING — kolom di DB TIDAK diubah. Modul ini cuma menghitung ulang nilai
// yang dikirim di respons GET: aplikasi tidak pernah menulis status klinis
// sendiri, dan status asli dari SIMRS tetap utuh di DB. Endpoint tulis
// (POST/PATCH) sengaja tidak memakai modul ini — responsnya harus
// mengonfirmasi apa yang benar-benar disimpan.
//
// Batas "sudah lewat" memakai HARI kalender WIB, bukan jam persis. Operasi yang
// dijadwalkan 06:52 tidak boleh berubah jadi "Selesai" pada 06:53 — durasinya
// tidak tersimpan di mana pun, jadi selama masih di hari yang sama statusnya
// diturunkan jadi "berlangsung", dan baru jadi "Selesai" setelah harinya habis.

// Bentuk tiap model beda (nama kolom status, kolom tanggal, dan nama status
// "berlangsung"-nya), jadi dipisah sebagai konfigurasi.
const OPERASI = {
  kolomStatus: "status",
  kolomTanggal: "tanggalOperasi",
  berlangsung: "IN_PROGRESS",
};

const KUNJUNGAN = {
  kolomStatus: "statusKunjungan",
  kolomTanggal: "tanggalMasuk",
  berlangsung: "ONGOING",
};

/**
 * Status efektif satu record.
 *
 * COMPLETED & CANCELLED tidak pernah diubah — dua-duanya keadaan final yang
 * sudah dikonfirmasi, dan menurunkannya justru akan menghapus informasi
 * (mis. operasi batal jadi kelihatan "selesai").
 */
function statusEfektif(tanggal, tersimpan, konfig, now = new Date()) {
  if (tersimpan === "COMPLETED" || tersimpan === "CANCELLED") return tersimpan;

  const awalHariIni = rentangHariWIB(now).mulai;
  if (tanggal < awalHariIni) return "COMPLETED";
  if (tanggal <= now) return konfig.berlangsung;
  return "SCHEDULED";
}

/** Salin record dengan kolom statusnya diganti hasil turunan. */
function terapkanStatusEfektif(record, konfig, now = new Date()) {
  const tanggal = record[konfig.kolomTanggal];
  if (!tanggal) return record;
  return {
    ...record,
    [konfig.kolomStatus]: statusEfektif(tanggal, record[konfig.kolomStatus], konfig, now),
  };
}

/**
 * Terjemahan filter `?status=` ke klausa Prisma `where`.
 *
 * Tanpa ini filter jadi tidak nyambung dengan yang tampil: record yang
 * ditampilkan "Selesai" (hasil turunan) tapi tersimpan SCHEDULED akan hilang
 * waktu difilter "Selesai", dan malah muncul waktu difilter "Terjadwal".
 * Kondisi di bawah dibangun supaya filter menyeleksi berdasar status EFEKTIF,
 * bukan status tersimpan.
 */
function whereStatusEfektif(status, konfig, now = new Date()) {
  const { kolomStatus, kolomTanggal, berlangsung } = konfig;
  const awalHariIni = rentangHariWIB(now).mulai;
  // Record yang statusnya masih bisa berubah seiring waktu.
  const belumFinal = { [kolomStatus]: { in: ["SCHEDULED", berlangsung] } };

  if (status === "CANCELLED") return { [kolomStatus]: "CANCELLED" };

  if (status === "COMPLETED") {
    return {
      OR: [
        { [kolomStatus]: "COMPLETED" },
        { ...belumFinal, [kolomTanggal]: { lt: awalHariIni } },
      ],
    };
  }

  if (status === berlangsung) {
    return { ...belumFinal, [kolomTanggal]: { gte: awalHariIni, lte: now } };
  }

  // SCHEDULED — hanya yang jamnya benar-benar belum tiba.
  return { ...belumFinal, [kolomTanggal]: { gt: now } };
}

module.exports = { OPERASI, KUNJUNGAN, statusEfektif, terapkanStatusEfektif, whereStatusEfektif };
