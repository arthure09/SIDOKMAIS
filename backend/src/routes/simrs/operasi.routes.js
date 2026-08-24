const express = require("express");
const { q } = require("../../lib/simrs");
const { klausaAksesNorm, paramAkses, simrsDokterId } = require("../../utils/simrsAkses");
const {
  parsePagination,
  parseDokterIdFilter,
  parseRentangTanggal,
  parseHitungTotal,
  parseLingkupJadwal,
} = require("../../utils/queryParams");
const { OPERASI, terapkanStatusEfektif } = require("../../utils/statusJadwal");
const { rentangHariWIB } = require("../../utils/wib");
const { tanggalJamWIB, keWaktuSimrs, teks } = require("../../utils/simrsBentuk");

const router = express.Router();

// Modul Operasi versi SIMRS — READ-ONLY sepenuhnya, untuk kedua role.
//
// Sumbernya `medis.tb_waiting_list_operasi`: satu-satunya tabel operasi yang
// memuat `norm`, `nokun`, `id_dokter`, `tindakan`, dan `tanggal` sekaligus,
// jadi daftar jadwal tidak perlu join lintas-skema. Dua tabel lain dipakai
// sebagai pelengkap opsional:
//   - medis.tb_pendaftaran_operasi  -> jam operasi, ruang tujuan, dokter bedah
//   - perjanjian.penjadwalan_operasi -> status alur ruang (0-5)
// Keduanya LEFT JOIN dan boleh kosong — tidak ada FK yang menjamin barisnya ada.
//
// Mana dari ketiganya yang jadi sumber kebenaran di produksi masih pertanyaan
// terbuka ke DBA (§4 no.1 simrs-schema-mapping.md). Susunan ini dipilih karena
// paling sedikit menebak, bukan karena sudah dikonfirmasi.

const OPERASI_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

// Berapa hari ke belakang ikut ditampilkan di daftar bawaan. Lihat alasannya
// di bangunFilter(). 14 hari dipilih karena replika SIMRS sendiri sedang
// tertinggal beberapa hari — jendela yang lebih pendek berisiko kosong.
const HARI_MUNDUR = 14;

// perjanjian.penjadwalan_operasi.status, dari komentar kolomnya:
// 0=batal, 1=menunggu masuk, 2=ruang tunggu, 3=sedang op, 4=ruang observasi,
// 5=selesai op. Dipetakan ke enum OperasiStatus milik SIDOKMAIS.
//
// tb_waiting_list_operasi.status TIDAK dipakai: tinyint(1) tanpa komentar dan
// arti kodenya belum dikonfirmasi. Menebaknya berisiko menampilkan operasi
// batal sebagai terjadwal. Pembatalan dideteksi lewat `alasan_batal` yang
// terisi — itu bukti langsung, bukan kode yang perlu ditafsirkan.
function statusTersimpan(baris) {
  if (teks(baris.ALASAN_BATAL)) return "CANCELLED";
  const alur = baris.STATUS_ALUR === null ? null : Number(baris.STATUS_ALUR);
  if (alur === 0) return "CANCELLED";
  if (alur === 5) return "COMPLETED";
  if (alur === 2 || alur === 3 || alur === 4) return "IN_PROGRESS";
  // alur 1 atau tidak ada baris penjadwalan sama sekali: belum ada kepastian,
  // biar statusEfektif yang menurunkannya dari tanggal.
  return null;
}

// Padanan SQL dari whereStatusEfektif() di utils/statusJadwal.js. Logikanya
// harus tetap sinkron dengan file itu: filter menyeleksi berdasar status
// EFEKTIF, bukan yang tersimpan, supaya hasil filter tidak bertentangan dengan
// apa yang tampil di kartu.
//
// `final` di sini = sudah batal (satu-satunya keadaan final yang bisa dibaca
// pasti dari SIMRS); COMPLETED tersimpan diwakili status alur 5.
// `<=>` (null-safe equal), BUKAN `=`. Ini bukan gaya penulisan — `po.status`
// datang dari LEFT JOIN, dan 3.958 dari 4.826 baris milik satu dokter tidak
// punya pasangan di penjadwalan_operasi sama sekali. Dengan `=`, `po.status = 0`
// bernilai NULL (bukan false), NULL itu merambat lewat NOT/AND, dan barisnya
// menghilang dari SEMUA filter status sekaligus — termasuk dari pengecekan
// "baris yang tidak kena filter manapun", karena `NOT NULL` juga NULL.
// Gejalanya: total 4.826 tapi jumlah semua filter cuma 868, tanpa error apa pun.
function kondisiStatusEfektif(status, now = new Date()) {
  const awalHariIni = keWaktuSimrs(rentangHariWIB(now).mulai);
  const sekarang = keWaktuSimrs(now);
  const batal = "(NULLIF(TRIM(wl.alasan_batal), '') IS NOT NULL OR po.status <=> 0)";
  const belumFinal = `NOT ${batal} AND NOT (po.status <=> 5)`;
  const tgl = "COALESCE(pd.tanggal_operasi, wl.tanggal)";

  if (status === "CANCELLED") return { sql: batal, params: [] };

  if (status === "COMPLETED") {
    return {
      sql: `(po.status <=> 5 OR (${belumFinal} AND ${tgl} < ?))`,
      params: [awalHariIni.slice(0, 10)],
    };
  }

  if (status === "IN_PROGRESS") {
    return {
      sql: `(${belumFinal} AND ${tgl} >= ? AND ${tgl} <= ?)`,
      params: [awalHariIni.slice(0, 10), sekarang.slice(0, 10)],
    };
  }

  return { sql: `(${belumFinal} AND ${tgl} > ?)`, params: [sekarang.slice(0, 10)] };
}

function parseListQuery(query, role) {
  const errors = [];

  let status;
  if (query.status !== undefined) {
    if (!OPERASI_STATUSES.includes(query.status)) {
      errors.push(`status harus salah satu dari: ${OPERASI_STATUSES.join(", ")}`);
    } else {
      status = query.status;
    }
  }

  const pagination = parsePagination(query);
  errors.push(...pagination.errors);

  const rentang = parseRentangTanggal(query);
  errors.push(...rentang.errors);

  return {
    errors,
    values: {
      status,
      page: pagination.page,
      limit: pagination.limit,
      dokterId: parseDokterIdFilter(query, role),
      lingkup: parseLingkupJadwal(query),
      dari: rentang.dari,
      sampai: rentang.sampai,
    },
  };
}

// FROM + JOIN yang sama persis dipakai COUNT, list, dan detail — satu definisi
// supaya ketiganya tidak bisa melihat himpunan baris yang berbeda.
const SUMBER = `
  FROM medis.tb_waiting_list_operasi wl
  LEFT JOIN medis.tb_pendaftaran_operasi pd ON pd.id = wl.id_pendaftaran_operasi
  LEFT JOIN perjanjian.penjadwalan_operasi po ON po.id_waiting_list_operasi = wl.id
  LEFT JOIN master.pasien pas ON pas.NORM = wl.norm
  LEFT JOIN master.dokter dk ON dk.ID = wl.id_dokter
  LEFT JOIN master.pegawai pg ON pg.NIP = dk.NIP
  LEFT JOIN master.ruangan rt ON rt.ID = pd.ruang_tujuan
`;

// FROM minimal khusus COUNT: `pd` dan `po` tetap perlu karena dipakai penyaring
// tanggal & status, tapi tiga join identitas (pasien, dokter, pegawai) tidak
// memengaruhi jumlah baris — semuanya LEFT JOIN satu-ke-satu. Membawa mereka
// ke query COUNT cuma kerja sia-sia.
const SUMBER_HITUNG = `
  FROM medis.tb_waiting_list_operasi wl
  LEFT JOIN medis.tb_pendaftaran_operasi pd ON pd.id = wl.id_pendaftaran_operasi
  LEFT JOIN perjanjian.penjadwalan_operasi po ON po.id_waiting_list_operasi = wl.id
`;

const KOLOM = `
  wl.id, wl.norm, wl.nokun, wl.tindakan, wl.diagnosis, wl.tanggal, wl.alasan_batal AS ALASAN_BATAL,
  wl.id_dokter, pd.tanggal_operasi, pd.jam_operasi, pd.catatan_khusus,
  COALESCE(rt.DESKRIPSI, pd.ruang_tujuan) AS ruang_tujuan,
  po.status AS STATUS_ALUR, po.waktu_operasi,
  pas.NAMA AS PASIEN_NAMA, pg.NAMA AS DOKTER_NAMA
`;

function bangunFilter({ status, dari, sampai, aksesDokterId, lingkup }) {
  const klausa = [];
  const params = [];

  if (aksesDokterId) {
    if (lingkup === "pasien") {
      // Cakupan luas: semua operasi pasien yang pernah dia tangani, termasuk
      // yang dioperasi dokter lain. Perilaku lama, sekarang harus diminta
      // eksplisit lewat ?lingkup=pasien.
      klausa.push(`(wl.id_dokter = ? OR ${klausaAksesNorm("wl.norm")})`);
      params.push(aksesDokterId, ...paramAkses(aksesDokterId));
    } else {
      // Terlibat di operasi INI. `pd.dokter_bedah` ikut dihitung karena dokter
      // yang mengajukan waiting list (`wl.id_dokter`) belum tentu yang
      // mengoperasi.
      klausa.push("(wl.id_dokter = ? OR pd.dokter_bedah = ?)");
      params.push(aksesDokterId, aksesDokterId);
    }
  }

  if (status) {
    const k = kondisiStatusEfektif(status);
    klausa.push(k.sql);
    params.push(...k.params);
  }

  if (dari) {
    klausa.push("COALESCE(pd.tanggal_operasi, wl.tanggal) >= ?");
    params.push(keWaktuSimrs(dari).slice(0, 10));
  }
  if (sampai) {
    klausa.push("COALESCE(pd.tanggal_operasi, wl.tanggal) <= ?");
    params.push(keWaktuSimrs(sampai).slice(0, 10));
  }

  // Tanpa rentang tanggal DAN tanpa filter status, daftar dibatasi ke jendela
  // "beberapa hari terakhir + seterusnya". Dua bug nyata diperbaiki di sini:
  //
  // 1. Layar kosong. JadwalOperasiKonsulScreen mengambil 50 baris pertama lalu
  //    menyaring di client. Urutannya tanggal MENAIK, jadi 50 baris pertama
  //    dari 4.826 semuanya operasi 2024 — tersaring habis, layar kosong padahal
  //    ada 207 jadwal mendatang.
  //
  // 2. Chip "Selesai" selalu kosong. Layar itu menyaring status di CLIENT, dari
  //    50 baris yang sudah terlanjur diambil. Kalau server cuma mengirim
  //    hari-ini-dan-seterusnya, tidak ada satu pun baris COMPLETED yang sampai
  //    ke client, jadi chip-nya mustahil berisi. Jendela mundur beberapa hari
  //    membuat operasi yang baru selesai ikut terkirim.
  //
  // Mundurnya HARI_MUNDUR hari, bukan sebulan: cukup untuk "yang baru saja
  // selesai", tanpa mengubah daftar jadwal jadi arsip. Dokter yang benar-benar
  // menengok arsip mengirim dari/sampai eksplisit, dan cabang ini tidak aktif.
  const jendelaBawaan = !dari && !sampai && !status;
  if (jendelaBawaan) {
    const mundur = new Date(rentangHariWIB(new Date()).mulai.getTime() - HARI_MUNDUR * 86400000);
    klausa.push("COALESCE(pd.tanggal_operasi, wl.tanggal) >= ?");
    params.push(keWaktuSimrs(mundur).slice(0, 10));
  }

  return { where: klausa.length > 0 ? klausa.join(" AND ") : "1=1", params, jendelaBawaan };
}

function bentukRingkas(b) {
  const record = {
    id: String(b.id),
    tanggalOperasi: tanggalJamWIB(b.tanggal_operasi || b.tanggal, b.jam_operasi || b.waktu_operasi),
    jenisTindakan: teks(b.tindakan),
    status: statusTersimpan(b),
    // `jenis` selalu OK: baris ini memang jadwal operasi.
    //
    // `pd.ruang_tujuan` DULU dikira teks bebas. Sebagian besar ternyata KODE
    // master.ruangan.ID: dari 16.180 baris terisi, 14.365 (89%) cocok, dan
    // tanpa join yang muncul di layar dokter adalah "105020710", bukan
    // "Poliklinik Onkologi 5" (ditemukan 24 Ags 2026 lewat pengingat jadwal).
    // Sisa 11% memang teks nama ruangan ("Poliklinik Onkologi 2", "PICU"),
    // jadi COALESCE: kode diterjemahkan, teks dibiarkan apa adanya.
    //
    // Kolom kode ruang operasi (penjadwalan_operasi.kamar_operasi) tetap tidak
    // dipakai, tipenya int(11) sementara master.ruangan.ID char(10) (§4 no.3).
    ruangan: { nama: teks(b.ruang_tujuan), jenis: "OK" },
    kunjungan: {
      dokterId: b.id_dokter === null ? null : String(b.id_dokter),
      dokter: b.DOKTER_NAMA ? { nama: b.DOKTER_NAMA } : null,
      pasien: { nama: b.PASIEN_NAMA ?? null, norm: b.norm === null ? null : String(b.norm) },
    },
  };
  return terapkanStatusEfektif(record, OPERASI);
}

router.get("/", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const { errors, values } = parseListQuery(req.query, role);
  if (errors.length > 0) {
    return res.status(400).json({ message: "Query params tidak valid", errors });
  }

  const dokterUuid = role === "DOKTER" ? ownDokterId : values.dokterId;
  const aksesDokterId = dokterUuid ? await simrsDokterId(dokterUuid) : null;

  if (role === "DOKTER" && !aksesDokterId) {
    return res.status(403).json({ message: "Akun dokter ini tidak terdaftar di SIMRS" });
  }

  const { where, params, jendelaBawaan } = bangunFilter({ ...values, aksesDokterId });
  const { page, limit } = values;
  const offset = (page - 1) * limit;

  // Pada jendela bawaan, 50 baris yang dikirim harus yang PALING DEKAT ke hari
  // ini — bukan yang paling tua. Urutan kronologis biasa membuat halaman
  // pertama habis dipakai operasi dua minggu lalu, dan jadwal mendatang tidak
  // pernah sampai ke layar (persis bug yang sedang diperbaiki, dua kali).
  // Layar tetap mengurutkan ulang sendiri lewat sortByStatusThenNearestDate,
  // jadi yang ditentukan di sini murni "50 yang mana", bukan tampilannya.
  const urutan = jendelaBawaan
    ? "ABS(DATEDIFF(COALESCE(pd.tanggal_operasi, wl.tanggal), CURDATE())) ASC, wl.id ASC"
    : "COALESCE(pd.tanggal_operasi, wl.tanggal) ASC, wl.id ASC";

  // Berurutan, bukan Promise.all — alasannya sama dengan pasien.routes.js:
  // COUNT dan query halaman memakai derived table akses DPJP yang sama, dan
  // menjalankannya bersamaan membuat MySQL membangun union itu dua kali
  // sekaligus sambil berebut sumber daya.
  const baris = await q(
    `SELECT ${KOLOM} ${SUMBER} WHERE ${where}
      ORDER BY ${urutan}
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const hitung = parseHitungTotal(req.query)
    ? await q(`SELECT COUNT(*) AS total ${SUMBER_HITUNG} WHERE ${where}`, params)
    : null;

  const total = hitung ? Number(hitung[0]?.total ?? 0) : null;

  res.json({
    data: baris.map(bentukRingkas),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === null ? null : Math.ceil(total / limit),
    },
  });
});

// Endpoint tulis ditolak tegas, bukan dihilangkan diam-diam. Di mode dummy,
// POST/PATCH/DELETE dipegang ADMIN untuk mensimulasikan sync dari SIMRS
// (Aturan #1). Kalau SIMRS-nya sendiri yang jadi sumber, simulasi itu tidak
// punya arti — dan akun DB-nya read-only, jadi tulisan apa pun akan gagal di
// tengah jalan. 405 + pesan jelas lebih baik daripada 500 dari driver.
const TOLAK_TULIS = (req, res) =>
  res.status(405).json({
    message:
      "Operasi bersumber dari SIMRS (read-only). Perubahan jadwal dilakukan di SIMRS, bukan lewat aplikasi ini.",
  });

router.post("/", TOLAK_TULIS);
router.patch("/:id", TOLAK_TULIS);
router.delete("/:id", TOLAK_TULIS);

router.get("/:id", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;
  const id = Number(req.params.id);

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }
  if (!Number.isInteger(id)) {
    return res.status(404).json({ message: "Operasi tidak ditemukan" });
  }

  let aksesDokterId = null;
  if (role === "DOKTER") {
    aksesDokterId = await simrsDokterId(ownDokterId);
    if (!aksesDokterId) {
      return res.status(403).json({ message: "Akun dokter ini tidak terdaftar di SIMRS" });
    }
  }

  const baris = await q(
    `SELECT ${KOLOM}, wl.nokun, pd.rencana_tindakan_operasi, pd.diagnosa_medis,
            k.MASUK AS KUNJUNGAN_MASUK, r.DESKRIPSI AS KUNJUNGAN_RUANGAN
       ${SUMBER}
       LEFT JOIN pendaftaran.kunjungan k ON k.NOMOR = wl.nokun
       LEFT JOIN master.ruangan r ON r.ID = k.RUANGAN
      WHERE wl.id = ? LIMIT 1`,
    [id]
  );

  if (baris.length === 0) {
    return res.status(404).json({ message: "Operasi tidak ditemukan" });
  }

  const b = baris[0];

  if (aksesDokterId && Number(b.id_dokter) !== aksesDokterId) {
    const punyaAkses = await q(
      `SELECT 1 AS ada FROM master.pasien pas
        WHERE pas.NORM = ? AND ${klausaAksesNorm("pas.NORM")} LIMIT 1`,
      [b.norm, ...paramAkses(aksesDokterId)]
    );
    if (punyaAkses.length === 0) {
      return res.status(403).json({ message: "Anda tidak memiliki akses ke data operasi ini" });
    }
  }

  const ringkas = bentukRingkas(b);

  res.json({
    ...ringkas,
    catatanPreOp: teks(b.catatan_khusus),
    catatanPostOp: null,
    diagnosaPraBedah: teks(b.diagnosis) ?? teks(b.diagnosa_medis),
    // Laporan operasi lengkap (medicalrecord.operasi) belum ikut dipetakan —
    // tabel itu terhubung lewat KUNJUNGAN, bukan lewat waiting list, dan
    // kaitannya ke baris ini belum dikonfirmasi DBA. Dikirim null supaya
    // frontend menampilkan "belum ada laporan", bukan laporan pasien lain.
    diagnosaPascaBedah: null,
    tim: [],
    kunjungan: {
      ...ringkas.kunjungan,
      id: b.nokun ?? null,
      tanggalMasuk: b.KUNJUNGAN_MASUK ? tanggalJamWIB(b.KUNJUNGAN_MASUK) : null,
      ruangan: teks(b.KUNJUNGAN_RUANGAN),
    },
  });
});

module.exports = router;
// Diekspor khusus untuk tes regresi NULL-safety di src/__tests__/simrs.test.js.
// Bukan bagian dari API modul ini.
module.exports.kondisiStatusEfektif = kondisiStatusEfektif;
