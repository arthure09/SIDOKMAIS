const express = require("express");
const { q } = require("../../lib/simrs");
const {
  klausaAksesNorm,
  paramAkses,
  simrsDokterId,
  dokterPunyaAksesPasien,
} = require("../../utils/simrsAkses");
const {
  parsePagination,
  parseDokterIdFilter,
  parseRentangTanggal,
  parseHitungTotal,
  parseLingkupJadwal,
} = require("../../utils/queryParams");
const { parseJenisKunjungan } = require("../../utils/jenisKunjungan");
const { KUNJUNGAN, statusEfektif } = require("../../utils/statusJadwal");
const { rentangHariWIB } = require("../../utils/wib");
const {
  tanggalWIB,
  tanggalJamWIB,
  keWaktuSimrs,
  jenisKelamin,
  ruanganJenis,
  kategoriKunjungan,
  diagnosaBersih,
  teks,
  SQL_KUNJUNGAN_KLINIS,
} = require("../../utils/simrsBentuk");

const router = express.Router();

// Modul Kunjungan versi SIMRS — sumber tab "Poliklinik" di layar Jadwal.
// Read-only, bentuk response identik dengan routes/kunjungan.routes.js.
//
// Tabelnya `pendaftaran.kunjungan`: 11,1 JUTA baris. Semua query di sini wajib
// terbatas — entah oleh rentang tanggal (yang memang selalu dikirim layar
// Poliklinik: dari == sampai == hari ini) atau oleh klausa akses dokter.
// Jangan pernah menambah jalur yang memindai tabel ini tanpa salah satunya.
//
// Dokter yang ditampilkan diambil dari `pendaftaran.tujuan_pasien.DOKTER`
// (DPJP utama pendaftaran itu) — kunjungan sendiri tidak menyimpan dokter,
// cuma `DITERIMA_OLEH` yang artinya petugas pendaftaran, bukan dokter.

const STATUS_KUNJUNGAN = ["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"];

function parseListQuery(query, role) {
  const errors = [];

  let status;
  if (query.status !== undefined) {
    if (!STATUS_KUNJUNGAN.includes(query.status)) {
      errors.push(`status harus salah satu dari: ${STATUS_KUNJUNGAN.join(", ")}`);
    } else {
      status = query.status;
    }
  }

  const pagination = parsePagination(query);
  errors.push(...pagination.errors);

  const jenis = parseJenisKunjungan(query);
  errors.push(...jenis.errors);

  const rentang = parseRentangTanggal(query);
  errors.push(...rentang.errors);

  return {
    errors,
    values: {
      status,
      ruanganJenis: jenis.ruanganJenis,
      page: pagination.page,
      limit: pagination.limit,
      dokterId: parseDokterIdFilter(query, role),
      dari: rentang.dari,
      sampai: rentang.sampai,
      // `?bolehMundur=1` — dikirim layar Poliklinik HANYA saat memakai tanggal
      // bawaan (hari ini), tidak saat dokter memilih tanggal sendiri. Lihat
      // cariTanggalTerisi() di bawah.
      bolehMundur: query.bolehMundur === "1",
      lingkup: parseLingkupJadwal(query),
    },
  };
}

function kondisiJenisRuangan(jenis) {
  if (jenis === "IGD") return "r.JENIS_KUNJUNGAN = 2";
  if (jenis === "RAWAT_INAP") return "r.JENIS_KUNJUNGAN = 3";
  // Rawat jalan = poliklinik saja (1, 14, 15). Dulu "apa pun selain 2 dan 3",
  // yang menyeret farmasi/lab/radiologi ikut masuk — lihat catatan panjang di
  // utils/simrsBentuk.js.
  return "r.JENIS_KUNJUNGAN IN (1, 14, 15)";
}

// Padanan SQL whereStatusEfektif() untuk Kunjungan.
//
// Kode `pendaftaran.kunjungan.STATUS` TIDAK dipakai: smallint(4) tanpa komentar,
// artinya belum dikonfirmasi DBA (§4 no.5 simrs-schema-mapping.md). Statusnya
// diturunkan dari waktu, persis seperti utils/statusJadwal.js — ditambah satu
// bukti langsung yang memang tersedia di SIMRS: `KELUAR` terisi berarti pasien
// sudah keluar, apa pun tanggalnya.
//
// Perbandingan ke KELUAR memakai IS NULL / IS NOT NULL, bukan `=`, supaya tidak
// mengulang jebakan NULL yang pernah kena di modul Operasi.
function kondisiStatusEfektif(status, now = new Date()) {
  const awalHariIni = keWaktuSimrs(rentangHariWIB(now).mulai);
  const sekarang = keWaktuSimrs(now);

  // SIMRS tidak punya penanda "kunjungan dibatalkan" yang bisa dibaca pasti,
  // jadi filter ini sengaja tidak pernah cocok — lebih baik kosong daripada
  // menampilkan kunjungan biasa sebagai batal.
  if (status === "CANCELLED") return { sql: "1 = 0", params: [] };

  if (status === "COMPLETED") {
    return { sql: "(k.KELUAR IS NOT NULL OR k.MASUK < ?)", params: [awalHariIni] };
  }

  if (status === "ONGOING") {
    return {
      sql: "(k.KELUAR IS NULL AND k.MASUK >= ? AND k.MASUK <= ?)",
      params: [awalHariIni, sekarang],
    };
  }

  return { sql: "(k.KELUAR IS NULL AND k.MASUK > ?)", params: [sekarang] };
}

// Status operasi terkait — semantiknya sama dengan routes/simrs/operasi.routes.js
// (alasan_batal terisi atau alur 0 = batal, alur 5 = selesai, 2-4 = berlangsung).
// Diulang kecil di sini daripada mengimpor route lain; kalau nanti ada tempat
// ketiga yang butuh, angkat ke utils.
function statusOperasi(o) {
  if (teks(o.ALASAN_BATAL)) return "CANCELLED";
  const alur = o.STATUS_ALUR === null ? null : Number(o.STATUS_ALUR);
  if (alur === 0) return "CANCELLED";
  if (alur === 5) return "COMPLETED";
  if (alur === 2 || alur === 3 || alur === 4) return "IN_PROGRESS";
  return "SCHEDULED";
}

const SUMBER = `
  FROM pendaftaran.kunjungan k
  JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
  LEFT JOIN master.ruangan r ON r.ID = k.RUANGAN
  LEFT JOIN master.pasien pas ON pas.NORM = pd.NORM
  LEFT JOIN master.diagnosa_masuk dm ON dm.ID = pd.DIAGNOSA_MASUK
  LEFT JOIN pendaftaran.tujuan_pasien tp ON tp.NOPEN = k.NOPEN
  LEFT JOIN master.dokter dk ON dk.ID = tp.DOKTER
  LEFT JOIN master.pegawai pg ON pg.NIP = dk.NIP
`;

// COUNT tidak butuh identitas pasien/dokter maupun teks diagnosa; `r` tetap
// ada karena dipakai filter jenis, `tp` karena dipakai klausa akses.
const SUMBER_HITUNG = `
  FROM pendaftaran.kunjungan k
  JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
  LEFT JOIN master.ruangan r ON r.ID = k.RUANGAN
  LEFT JOIN pendaftaran.tujuan_pasien tp ON tp.NOPEN = k.NOPEN
`;

const DIAGNOSA = `
  COALESCE(
    (SELECT dd.DIAGNOSA FROM pendaftaran.dpjp_diagnosa dd
      WHERE dd.KUNJUNGAN = k.NOMOR AND dd.STATUS = 1
      ORDER BY dd.KATEGORI_DIAGNOSA ASC, dd.ID DESC LIMIT 1),
    dm.DIAGNOSA
  )`;

// Dokter terlibat di kunjungan INI — bukan "pernah menangani pasiennya".
// Ketiga peran DPJP dihitung, karena DPJP pendamping pun tetap punya
// kepentingan atas kunjungan itu. Diperiksa per-NOPEN lewat EXISTS, jadi tidak
// perlu union NORM se-riwayat pasien.
const TERLIBAT_KUNJUNGAN = `(
  tp.DOKTER = ?
  OR EXISTS (SELECT 1 FROM pendaftaran.dpjp_bersama db
              WHERE db.NOPEN = k.NOPEN AND db.DOKTER = ?)
  OR EXISTS (SELECT 1 FROM pendaftaran.dpjp_pendamping dp
              WHERE dp.NOPEN = k.NOPEN AND dp.DOKTER = ?)
)`;

function bangunFilter({ status, ruanganJenis: jenis, dari, sampai, aksesDokterId, lingkup }) {
  // Selalu, tanpa menunggu diminta: layar ini daftar PERTEMUAN dokter-pasien.
  // Satu pendaftaran menghasilkan banyak baris `kunjungan` — poliklinik, lalu
  // farmasi, lab, radiologi. Tanpa penyaring ini, 197 pendaftaran satu dokter
  // hari itu muncul sebagai 421 kartu, 136 di antaranya pengambilan obat.
  const klausa = [SQL_KUNJUNGAN_KLINIS];
  const params = [];

  if (aksesDokterId) {
    if (lingkup === "pasien") {
      // Cakupan luas: semua kunjungan pasien yang pernah dia tangani, termasuk
      // yang ditangani dokter lain. Ini perilaku lama, sekarang harus diminta
      // eksplisit lewat ?lingkup=pasien.
      klausa.push(`(tp.DOKTER = ? OR ${klausaAksesNorm("pd.NORM")})`);
      params.push(aksesDokterId, ...paramAkses(aksesDokterId));
    } else {
      klausa.push(TERLIBAT_KUNJUNGAN);
      params.push(aksesDokterId, aksesDokterId, aksesDokterId);
    }
  }

  if (status) {
    const k = kondisiStatusEfektif(status);
    klausa.push(k.sql);
    params.push(...k.params);
  }

  if (jenis) klausa.push(kondisiJenisRuangan(jenis));

  if (dari) {
    klausa.push("k.MASUK >= ?");
    params.push(keWaktuSimrs(dari));
  }
  if (sampai) {
    klausa.push("k.MASUK <= ?");
    params.push(keWaktuSimrs(sampai));
  }

  return { where: klausa.length > 0 ? klausa.join(" AND ") : "1=1", params };
}

function bentuk(b) {
  const masuk = tanggalWIB(b.MASUK);
  return {
    id: b.NOMOR,
    tanggalMasuk: masuk,
    tanggalKeluar: tanggalWIB(b.KELUAR),
    diagnosa: diagnosaBersih(b.DIAGNOSA),
    // Diturunkan dari waktu — kode STATUS SIMRS belum dikonfirmasi artinya.
    // `KELUAR` yang terisi dihormati sebagai bukti sudah selesai.
    statusKunjungan: b.KELUAR ? "COMPLETED" : statusEfektif(masuk, null, KUNJUNGAN),
    isPasienBaru: Number(b.BARU) === 1,
    ruangan: { nama: teks(b.RUANGAN_NAMA), jenis: ruanganJenis(b.JENIS_KUNJUNGAN) },
    pasien: b.PASIEN_NORM
      ? { id: String(b.PASIEN_NORM), nama: b.PASIEN_NAMA, norm: String(b.PASIEN_NORM) }
      : null,
    dokter: b.DOKTER_ID ? { id: String(b.DOKTER_ID), nama: b.DOKTER_NAMA ?? null } : null,
    jenisKunjungan: kategoriKunjungan(b.JENIS_KUNJUNGAN),
  };
}

const KOLOM = `
  k.NOMOR, k.MASUK, k.KELUAR, k.BARU,
  r.DESKRIPSI AS RUANGAN_NAMA, r.JENIS_KUNJUNGAN,
  pas.NORM AS PASIEN_NORM, pas.NAMA AS PASIEN_NAMA,
  tp.DOKTER AS DOKTER_ID, pg.NAMA AS DOKTER_NAMA,
  ${DIAGNOSA} AS DIAGNOSA
`;

// Tanggal terakhir yang benar-benar punya kunjungan untuk dokter ini.
//
// Alasannya bukan estetika: replika SIMRS berhenti tersinkronisasi 18 Ags 2026
// 14:35 WIB — seluruh tabel transaksional (kunjungan, pendaftaran, konsul,
// waiting list operasi) mentok di menit yang sama. Selama itu belum diperbaiki
// tim SIMRS, "kunjungan hari ini" akan selalu nol untuk SELURUH rumah sakit,
// bukan cuma satu dokter.
//
// Fungsi ini membuat layar Poliklinik tetap ada isinya waktu itu terjadi.
// Tanggalnya DIKEMBALIKAN ke pemanggil (`tanggalData` di response) supaya UI
// bisa menyebutkan tanggal yang sebenarnya — menampilkan data 18 Agustus
// dengan label "hari ini" justru lebih berbahaya daripada layar kosong.
// TIDAK di-scope ke dokter, dan itu disengaja. Versi pertama menyaring lewat
// klausa akses DPJP dan makan 156 detik — MAX() memaksa seluruh himpunan
// kunjungan dokter (ratusan ribu baris) dievaluasi. Tanpa penyaring, MySQL
// cukup membaca ujung index `MASUK`: 0,0 detik.
//
// Aman karena yang dicari memang bukan "kapan dokter ini terakhir praktik",
// melainkan "sampai tanggal berapa replika ini punya data" — dan itu
// se-rumah-sakit, karena replikasinya berhenti serentak.
//
// Kalau kebetulan dokter ini tidak punya kunjungan di tanggal itu, hasilnya
// tetap kosong dan `tanggalData` tetap null. Itu jujur; lebih baik daripada
// menunggu dua setengah menit untuk jawaban yang sama.
async function cariTanggalTerisi() {
  const baris = await q("SELECT MAX(MASUK) AS TERBARU FROM pendaftaran.kunjungan");
  return baris[0]?.TERBARU ?? null;
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

  // ADMIN tanpa filter apa pun akan memindai 11 juta baris. Ditolak dengan
  // pesan yang menyebut jalan keluarnya, bukan dibiarkan menggantung sampai
  // timeout.
  if (!aksesDokterId && !values.dari && !values.sampai) {
    return res.status(400).json({
      message:
        "Butuh filter: isi rentang tanggal (dari/sampai) atau dokterId. " +
        "Tabel kunjungan SIMRS terlalu besar untuk dibaca tanpa batas.",
    });
  }

  const { page, limit } = values;
  const offset = (page - 1) * limit;
  const hitungTotal = parseHitungTotal(req.query);

  async function ambil(nilai) {
    const { where, params } = bangunFilter({ ...nilai, aksesDokterId });
    // Berurutan, bukan Promise.all — alasannya sama dengan pasien.routes.js:
    // dua query ini memakai derived table akses DPJP yang sama, dan berbarengan
    // membuat MySQL membangunnya dua kali sekaligus.
    const baris = await q(
      `SELECT ${KOLOM} ${SUMBER} WHERE ${where}
        ORDER BY k.MASUK ASC
        LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const hitung = hitungTotal
      ? await q(`SELECT COUNT(*) AS total ${SUMBER_HITUNG} WHERE ${where}`, params)
      : null;
    return { total: hitung ? Number(hitung[0]?.total ?? 0) : null, baris };
  }

  let hasil = await ambil(values);
  let tanggalData = null;

  // Kosong + pemanggil mengizinkan mundur -> ulangi di tanggal terakhir yang
  // ada datanya. Hanya untuk permintaan satu hari; rentang yang dipilih dokter
  // sendiri tidak pernah diam-diam digeser.
  //
  // Diperiksa lewat `baris.length`, BUKAN `total` — sejak COUNT jadi opsional,
  // `total` bisa null dan `null === 0` selalu false, yang diam-diam mematikan
  // seluruh mekanisme mundur ini.
  if (hasil.baris.length === 0 && values.bolehMundur && values.dari && values.sampai) {
    const terbaru = await cariTanggalTerisi();
    if (terbaru) {
      const hari = String(terbaru).slice(0, 10);
      hasil = await ambil({
        ...values,
        dari: new Date(`${hari}T00:00:00+07:00`),
        sampai: new Date(`${hari}T23:59:59+07:00`),
      });
      if (hasil.baris.length > 0) tanggalData = hari;
    }
  }

  res.json({
    data: hasil.baris.map(bentuk),
    // Diisi HANYA kalau hasilnya bukan dari tanggal yang diminta. UI wajib
    // menyebutkan tanggal ini — kalau tidak, data lama tampil seolah hari ini.
    tanggalData,
    pagination: {
      page,
      limit,
      total: hasil.total,
      totalPages: hasil.total === null ? null : Math.ceil(hasil.total / limit),
    },
  });
});

router.get("/:id", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;
  const { id } = req.params;

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const baris = await q(
    `SELECT ${KOLOM}, pd.NORM, pas.JENIS_KELAMIN, pas.TANGGAL_LAHIR
       ${SUMBER}
      WHERE k.NOMOR = ? LIMIT 1`,
    [id]
  );

  if (baris.length === 0) {
    return res.status(404).json({ message: "Kunjungan tidak ditemukan" });
  }

  const b = baris[0];

  if (role === "DOKTER") {
    const aksesDokterId = await simrsDokterId(ownDokterId);
    if (!aksesDokterId) {
      return res.status(403).json({ message: "Akun dokter ini tidak terdaftar di SIMRS" });
    }
    if (Number(b.DOKTER_ID) !== aksesDokterId) {
      // Lewat helper, bukan klausa union yang ditulis ulang di sini: untuk
      // pertanyaan "satu NORM ini punya saya atau tidak", membangun himpunan
      // seluruh pasien dokter itu 1,4 detik terbuang. Lihat catatan arah query
      // di dokterPunyaAksesPasien().
      const punya = await dokterPunyaAksesPasien(aksesDokterId, b.NORM);
      if (!punya) {
        return res.status(403).json({ message: "Anda tidak memiliki akses ke data kunjungan ini" });
      }
    }
  }

  const dasar = bentuk(b);

  // Operasi yang tertaut ke kunjungan ini, lewat tb_waiting_list_operasi.nokun.
  // Satu query kecil (index `nokun`), dipakai layar detail untuk menautkan
  // kunjungan ke jadwal operasinya.
  const operasi = await q(
    `SELECT wl.id, COALESCE(pd.tanggal_operasi, wl.tanggal) AS tgl, pd.jam_operasi AS jam,
            po.status AS STATUS_ALUR, wl.alasan_batal AS ALASAN_BATAL
       FROM medis.tb_waiting_list_operasi wl
       LEFT JOIN medis.tb_pendaftaran_operasi pd ON pd.id = wl.id_pendaftaran_operasi
       LEFT JOIN perjanjian.penjadwalan_operasi po ON po.id_waiting_list_operasi = wl.id
      WHERE wl.nokun = ?
      ORDER BY COALESCE(pd.tanggal_operasi, wl.tanggal) DESC
      LIMIT 10`,
    [id]
  );

  res.json({
    ...dasar,
    pasien: dasar.pasien
      ? {
          ...dasar.pasien,
          jenisKelamin: jenisKelamin(b.JENIS_KELAMIN),
          tanggalLahir: tanggalWIB(b.TANGGAL_LAHIR),
        }
      : null,
    dokter: dasar.dokter
      ? // SMF di master.pegawai berupa kode dan tabel referensinya belum
        // dipetakan (§4 no.20) — null, bukan angka mentah.
        { ...dasar.dokter, spesialisasi: null }
      : null,
    ruangan: {
      ...dasar.ruangan,
      // SIMRS menyimpan lantai sebagai kode referensi (ref jenis=125), belum
      // dipetakan; id ruangan dipakai apa adanya.
      id: teks(b.RUANGAN_ID),
      lantai: null,
    },
    operasi: operasi.map((o) => ({
      id: String(o.id),
      status: statusOperasi(o),
      tanggalOperasi: tanggalJamWIB(o.tgl, o.jam),
    })),
  });
});

module.exports = router;
module.exports.kondisiStatusEfektif = kondisiStatusEfektif;
