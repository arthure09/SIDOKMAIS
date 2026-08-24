const express = require("express");
const { q } = require("../../lib/simrs");
const { simrsDokterId, dokterPunyaAksesPasien } = require("../../utils/simrsAkses");
const {
  parsePagination,
  parseRentangTanggal,
  parseHitungTotal,
} = require("../../utils/queryParams");
const { tanggalWIB, keWaktuSimrs, teks } = require("../../utils/simrsBentuk");

const router = express.Router();

// Modul Radiologi versi SIMRS — read-only, bentuk response identik dengan
// routes/radiologi.routes.js.
//
// JALUR KE PASIEN TIDAK LEWAT TABEL ORDER. Ini beda paling penting dari modul
// Lab, dan sudah diukur (24 Ags 2026, agregat sebulan, tanpa membaca baris
// pasien): kalau mengikuti pola lab lewat `layanan.order_detil_rad.REF`,
// 5.393 dari 13.685 hasil bulan Agustus (39%) TIDAK ketemu induknya — hasil
// yang REF-nya tidak punya baris detil order sama sekali, dan bukan nyasar
// dari radioterapi atau lab. Induk sebenarnya adalah `layanan.tindakan_medis`
// (17 juta baris, `ID` char(11) = REF) yang membawa `KUNJUNGAN` langsung.
// Lewat situ cocoknya 13.687 dari 13.687 = 100%.
//
// Rantainya:
//   pendaftaran.pendaftaran (NORM)
//     -> pendaftaran.kunjungan
//       -> layanan.tindakan_medis   KUNJUNGAN (ber-index), ID, TINDAKAN, TANGGAL
//         -> layanan.hasil_rad      TINDAKAN_MEDIS = tindakan_medis.ID (PRIMARY)
//
// `layanan.tindakan_medis` memuat SELURUH tindakan medis (bukan cuma
// radiologi); join ke hasil_rad lewat primary key-nya yang menyaring jadi
// radiologi saja. Tabel order tetap di-LEFT JOIN, tapi hanya untuk informasi
// tambahan (unit tujuan, cito, dokter pengirim) yang boleh kosong.
//
// Yang TIDAK dipakai, karena datanya memang tidak ada:
//   - `hasil_rad.USUL` — nol dari 13.687 baris Agustus terisi.
//   - `hasil_rad.STATUS_KONFIRMASI` — cuma 6% bernilai 1, jadi tidak bisa
//     dipakai menyaring "sudah selesai". Sama seperti `order_lab.STATUS` di
//     modul Lab, bukti "sudah jadi" diambil dari adanya baris hasil.
//   - `hasil_rad.KESAN` dipakai tapi WAJIB dianggap boleh kosong: cuma 15%
//     terisi, kesimpulan biasanya ditulis di dalam `HASIL`.

// Narasi radiologi hampir selalu teks polos (135 dari 13.687 baris Agustus
// memuat tag), tapi yang sedikit itu tetap harus dibersihkan — kalau tidak,
// dokter melihat "<p>" mentah di layar. Dipisah jadi fungsi murni supaya bisa
// diuji tanpa menyentuh database.
function bersihkanNarasi(nilai) {
  const mentah = teks(nilai);
  if (mentah === null) return null;

  const bersih = mentah
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r\n?/g, "\n")
    // Spasi/tab di ujung baris jadi kelihatan begitu teks dirender rata kiri.
    .replace(/[ \t]+\n/g, "\n")
    // Tiga baris kosong beruntun atau lebih tidak menambah arti, cuma membuat
    // laporan perlu discroll lebih jauh.
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return bersih === "" ? null : bersih;
}

function parseListQuery(query) {
  const errors = [];

  const pasienId = typeof query.pasienId === "string" ? query.pasienId.trim() : "";
  if (!pasienId) {
    errors.push("pasienId wajib diisi");
  }

  const pagination = parsePagination(query);
  errors.push(...pagination.errors);

  const rentang = parseRentangTanggal(query, "dariTanggal", "sampaiTanggal");
  errors.push(...rentang.errors);

  return {
    errors,
    values: {
      pasienId,
      page: pagination.page,
      limit: pagination.limit,
      dariTanggal: rentang.dari,
      sampaiTanggal: rentang.sampai,
    },
  };
}

const SUMBER = `
  FROM pendaftaran.pendaftaran pd
  JOIN pendaftaran.kunjungan k ON k.NOPEN = pd.NOMOR
  JOIN layanan.tindakan_medis tm ON tm.KUNJUNGAN = k.NOMOR
  JOIN layanan.hasil_rad h ON h.TINDAKAN_MEDIS = tm.ID
`;

// Modalitas (Rontgen/CT Scan/USG/...) tidak disimpan di baris hasil; datangnya
// dari pemetaan tindakan. Terisi 98% (13.511 dari 13.778) — sisanya null, dan
// frontend memang memperlakukan modalitas sebagai boleh-kosong.
const MODALITAS = `
  (SELECT kl.KELOMPOK
     FROM master.tindakan_mapping_radiologi mp
     JOIN master.tindakan_klp_radiologi kl ON kl.ID = mp.ID_KELOMPOK
    WHERE mp.ID_TINDAKAN = tm.TINDAKAN AND mp.STATUS = 1
    ORDER BY kl.ID ASC LIMIT 1)
`;

function bangunFilter({ norm, dariTanggal, sampaiTanggal }) {
  // Sama seperti modul Lab: baris bertanggal masa depan (salah ketik tahun)
  // selalu nangkring di paling atas karena daftar ini urut menurun. Dibuang.
  const klausa = ["pd.NORM = ?", "tm.TANGGAL <= NOW()"];
  const params = [norm];

  if (dariTanggal) {
    klausa.push("tm.TANGGAL >= ?");
    params.push(keWaktuSimrs(dariTanggal));
  }
  if (sampaiTanggal) {
    klausa.push("tm.TANGGAL <= ?");
    params.push(keWaktuSimrs(sampaiTanggal));
  }

  return { where: klausa.join(" AND "), params };
}

// GET /api/radiologi?pasienId=&page=&limit= — riwayat radiologi satu pasien.
router.get("/", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const { errors, values } = parseListQuery(req.query);
  if (errors.length > 0) {
    return res.status(400).json({ message: "Query params tidak valid", errors });
  }

  const { pasienId, page, limit, dariTanggal, sampaiTanggal } = values;

  if (role === "DOKTER") {
    const aksesDokterId = await simrsDokterId(ownDokterId);
    if (!aksesDokterId) {
      return res.status(403).json({ message: "Akun dokter ini tidak terdaftar di SIMRS" });
    }
    const punyaAkses = await dokterPunyaAksesPasien(aksesDokterId, pasienId);
    if (!punyaAkses) {
      return res.status(403).json({ message: "Anda tidak memiliki akses ke data pasien ini" });
    }
  }

  const { where, params } = bangunFilter({ norm: Number(pasienId), dariTanggal, sampaiTanggal });
  const offset = (page - 1) * limit;

  // Daftar TIDAK mengambil kolom narasi. `hasil_rad.HASIL` longtext rata-rata
  // 632 karakter; 50 baris berarti ~30 KB teks yang tidak satu pun ditampilkan
  // di layar daftar. Yang dibutuhkan cuma ada/tidaknya kesan.
  const [hitung, baris] = await Promise.all([
    parseHitungTotal(req.query)
      ? q(`SELECT COUNT(*) AS total ${SUMBER} WHERE ${where}`, params)
      : null,
    q(
      `SELECT tm.ID, tm.TANGGAL AS TGL_TINDAKAN, h.TANGGAL AS TGL_HASIL,
              t.NAMA AS NAMA_PEMERIKSAAN,
              ${MODALITAS} AS MODALITAS,
              o.CITO, r.DESKRIPSI AS UNIT,
              CHAR_LENGTH(TRIM(h.KESAN)) AS PANJANG_KESAN
         ${SUMBER}
         LEFT JOIN master.tindakan t ON t.ID = tm.TINDAKAN
         LEFT JOIN layanan.order_detil_rad od ON od.REF = tm.ID
         LEFT JOIN layanan.order_rad o ON o.NOMOR = od.ORDER_ID
         LEFT JOIN master.ruangan r ON r.ID = o.TUJUAN
        WHERE ${where}
        ORDER BY tm.TANGGAL DESC
        LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
  ]);

  res.json({
    data: baris.map((b) => ({
      id: String(b.ID),
      modalitas: teks(b.MODALITAS),
      namaPemeriksaan: teks(b.NAMA_PEMERIKSAAN),
      unit: teks(b.UNIT),
      cito: b.CITO === 1,
      tanggalPermintaan: tanggalWIB(b.TGL_TINDAKAN),
      tanggalHasil: tanggalWIB(b.TGL_HASIL),
      adaKesan: Number(b.PANJANG_KESAN) > 1,
    })),
    pagination: {
      page,
      limit,
      total: hitung ? Number(hitung[0]?.total ?? 0) : null,
      totalPages: hitung ? Math.ceil(Number(hitung[0]?.total ?? 0) / limit) : null,
    },
  });
});

// GET /api/radiologi/:id — satu laporan radiologi lengkap dengan narasinya.
router.get("/:id", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const baris = await q(
    `SELECT tm.ID, tm.KUNJUNGAN, tm.TANGGAL AS TGL_TINDAKAN,
            h.TANGGAL AS TGL_HASIL, h.KLINIS, h.KESAN, h.HASIL, h.DOKTER_SATU,
            t.NAMA AS NAMA_PEMERIKSAAN,
            ${MODALITAS} AS MODALITAS,
            o.CITO, o.ALASAN, o.DOKTER_ASAL,
            r.DESKRIPSI AS UNIT,
            pd.NORM, pas.NAMA AS PASIEN_NAMA,
            pgb.NAMA AS PEMBACA_NAMA, pgk.NAMA AS PEMINTA_NAMA
       FROM layanan.tindakan_medis tm
       JOIN layanan.hasil_rad h ON h.TINDAKAN_MEDIS = tm.ID
       JOIN pendaftaran.kunjungan k ON k.NOMOR = tm.KUNJUNGAN
       JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
       LEFT JOIN master.tindakan t ON t.ID = tm.TINDAKAN
       LEFT JOIN layanan.order_detil_rad od ON od.REF = tm.ID
       LEFT JOIN layanan.order_rad o ON o.NOMOR = od.ORDER_ID
       LEFT JOIN master.ruangan r ON r.ID = o.TUJUAN
       LEFT JOIN master.pasien pas ON pas.NORM = pd.NORM
       LEFT JOIN master.dokter dkb ON dkb.ID = h.DOKTER_SATU
       LEFT JOIN master.pegawai pgb ON pgb.NIP = dkb.NIP
       LEFT JOIN master.dokter dkk ON dkk.ID = o.DOKTER_ASAL
       LEFT JOIN master.pegawai pgk ON pgk.NIP = dkk.NIP
      WHERE tm.ID = ?
      LIMIT 1`,
    [req.params.id]
  );

  if (baris.length === 0) {
    return res.status(404).json({ message: "Pemeriksaan radiologi tidak ditemukan" });
  }

  const b = baris[0];

  if (role === "DOKTER") {
    const aksesDokterId = await simrsDokterId(ownDokterId);
    if (!aksesDokterId) {
      return res.status(403).json({ message: "Akun dokter ini tidak terdaftar di SIMRS" });
    }
    const punyaAkses = await dokterPunyaAksesPasien(aksesDokterId, b.NORM);
    if (!punyaAkses) {
      return res
        .status(403)
        .json({ message: "Anda tidak memiliki akses ke data pemeriksaan radiologi ini" });
    }
  }

  res.json({
    id: String(b.ID),
    pasienId: String(b.NORM),
    kunjunganId: teks(b.KUNJUNGAN),
    modalitas: teks(b.MODALITAS),
    namaPemeriksaan: teks(b.NAMA_PEMERIKSAAN),
    unit: teks(b.UNIT),
    cito: b.CITO === 1,
    tanggalPermintaan: tanggalWIB(b.TGL_TINDAKAN),
    tanggalHasil: tanggalWIB(b.TGL_HASIL),
    // Keterangan klinis: kolom di baris hasil lebih diutamakan, `order_rad.ALASAN`
    // jadi cadangan — order-nya sendiri cuma ada di 61% kasus.
    klinis: bersihkanNarasi(b.KLINIS) ?? bersihkanNarasi(b.ALASAN),
    hasil: bersihkanNarasi(b.HASIL),
    kesan: bersihkanNarasi(b.KESAN),
    createdAt: null,
    updatedAt: null,
    pasien: b.NORM ? { id: String(b.NORM), nama: teks(b.PASIEN_NAMA), norm: String(b.NORM) } : null,
    dokterPeminta: b.DOKTER_ASAL
      ? { id: String(b.DOKTER_ASAL), nama: teks(b.PEMINTA_NAMA), spesialisasi: null }
      : null,
    // Terisi cuma 7% di SIMRS — nullable ini normal, bukan tanda data rusak.
    dokterPembaca: b.DOKTER_SATU
      ? { id: String(b.DOKTER_SATU), nama: teks(b.PEMBACA_NAMA), spesialisasi: null }
      : null,
  });
});

module.exports = router;
// Diekspor buat test: satu-satunya logika di file ini yang salahnya tidak
// memicu error apa pun, cuma menampilkan hal keliru di layar dokter.
module.exports.bersihkanNarasi = bersihkanNarasi;
