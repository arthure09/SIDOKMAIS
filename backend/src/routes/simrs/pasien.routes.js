const express = require("express");
const { q } = require("../../lib/simrs");
const {
  klausaAksesNorm,
  joinAksesNorm,
  paramAkses,
  simrsDokterId,
  dokterPunyaAksesPasien,
} = require("../../utils/simrsAkses");
const {
  parsePagination,
  parseDokterIdFilter,
  parseHitungTotal,
} = require("../../utils/queryParams");
const { parseJenisKunjungan } = require("../../utils/jenisKunjungan");
const { KUNJUNGAN, statusEfektif } = require("../../utils/statusJadwal");
const {
  tanggalWIB,
  jenisKelamin,
  ruanganJenis,
  kategoriKunjungan,
  diagnosaBersih,
  teks,
} = require("../../utils/simrsBentuk");

const router = express.Router();

// Modul Pasien versi SIMRS. Bentuk response-nya dijaga identik dengan
// routes/pasien.routes.js (versi dummy) — frontend tidak boleh tahu bedanya.
//
// Perbedaan yang tidak bisa dihindari, semuanya karena SIMRS memang tidak
// menyimpannya:
//   - `id` sekarang NORM (angka, dikirim sebagai string), bukan uuid.
//   - `assignment.id` null & `tanggalAssign` null — tidak ada tabel penugasan
//     di SIMRS, statusnya diturunkan dari ada/tidaknya pendaftaran aktif.
//   - `createdAt`/`updatedAt` -> master.pasien.TANGGAL (tanggal pendaftaran
//     pasien pertama kali); SIMRS tidak mencatat waktu update baris pasien.
const ASSIGNMENT_STATUSES = ["ACTIVE", "COMPLETED"];
const URUTAN = ["terbaru", "terlama"];

function parseListQuery(query, role) {
  const errors = [];

  const search = typeof query.search === "string" ? query.search.trim() : "";

  let status;
  if (query.status !== undefined) {
    if (!ASSIGNMENT_STATUSES.includes(query.status)) {
      errors.push(`status harus salah satu dari: ${ASSIGNMENT_STATUSES.join(", ")}`);
    } else {
      status = query.status;
    }
  }

  let urutkan;
  if (query.urutkan !== undefined) {
    if (!URUTAN.includes(query.urutkan)) {
      errors.push(`urutkan harus salah satu dari: ${URUTAN.join(", ")}`);
    } else {
      urutkan = query.urutkan;
    }
  }

  const pagination = parsePagination(query);
  errors.push(...pagination.errors);

  const jenis = parseJenisKunjungan(query);
  errors.push(...jenis.errors);

  return {
    errors,
    values: {
      search,
      status,
      urutkan,
      ruanganJenis: jenis.ruanganJenis,
      page: pagination.page,
      limit: pagination.limit,
      dokterId: parseDokterIdFilter(query, role),
    },
  };
}

// Padanan RuanganJenis -> kondisi SQL di master.ruangan.JENIS_KUNJUNGAN.
// Rawat jalan adalah "sisanya" (komentar kolomnya: "1 dll = Rawat Jalan"),
// jadi dinyatakan sebagai negasi, bukan daftar kode.
function kondisiJenisRuangan(jenis) {
  if (jenis === "IGD") return "r.JENIS_KUNJUNGAN = 2";
  if (jenis === "RAWAT_INAP") return "r.JENIS_KUNJUNGAN = 3";
  return "(r.JENIS_KUNJUNGAN IS NULL OR r.JENIS_KUNJUNGAN NOT IN (2, 3))";
}

// Jenis ruangan dari kunjungan TERAKHIR pasien, sebagai satu ekspresi utuh.
//
// Subquery-nya ditulis sekali dan dibungkus di sini, bukan disebut dua kali
// untuk menangani NULL — memanggilnya dua kali berarti dua kali biaya, dan
// biaya inilah yang jadi masalah di filter ini.
//
// `COALESCE(..., 1)`: kunjungan terakhir yang ruangannya tidak dikenal (atau
// pasien tanpa kunjungan sama sekali) dihitung rawat jalan, konsisten dengan
// ruanganJenis() yang mengembalikan POLI untuk kode di luar 2/3.
function kondisiJenisTerakhir(jenis, subquery) {
  if (jenis === "IGD") return `(${subquery}) <=> 2`;
  if (jenis === "RAWAT_INAP") return `(${subquery}) <=> 3`;
  return `COALESCE((${subquery}), 1) NOT IN (2, 3)`;
}

// Pendaftaran aktif = pendaftaran.pendaftaran.STATUS 1 (komentar kolomnya:
// "0 = Batal / Non Aktif, 1 = Aktif, 2 = selesai"). Inilah pengganti
// AssignmentStatus: ACTIVE selama pasien masih punya pendaftaran berjalan.
const EXISTS_PENDAFTARAN_AKTIF = `
  EXISTS (SELECT 1 FROM pendaftaran.pendaftaran pa
           WHERE pa.NORM = pas.NORM AND pa.STATUS = 1)
`;

// Bangun JOIN + WHERE + params bersama untuk COUNT dan SELECT halaman, supaya
// keduanya tidak bisa diam-diam berbeda.
//
// Penyaring akses dipasang sebagai JOIN, bukan `IN (...)` di WHERE: bentuk JOIN
// membuat daftar NORM milik dokter jadi tabel penggerak, sehingga master.pasien
// cuma di-lookup lewat primary key. Lihat catatan di utils/simrsAkses.js —
// bentuk IN yang ditulis langsung berubah jadi DEPENDENT SUBQUERY.
//
// Params dikembalikan sudah terurut JOIN-dulu-baru-WHERE, karena itu urutan
// kemunculan placeholder di SQL-nya.
function bangunFilter({ search, status, ruanganJenis: jenis, aksesDokterId }) {
  const klausa = ["pas.STATUS = 1"];
  const params = [];
  let join = "";

  if (aksesDokterId) {
    join = joinAksesNorm("pas.NORM");
    params.push(...paramAkses(aksesDokterId));
  }

  if (search) {
    // NORM int(11) dibandingkan sebagai teks lewat CAST supaya pencarian
    // sebagian nomor RM ("1234") tetap kena, sama seperti `contains` di versi
    // dummy. Keduanya parameterised — `search` tidak pernah masuk ke SQL
    // sebagai literal.
    klausa.push("(pas.NAMA LIKE ? OR CAST(pas.NORM AS CHAR) LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (status === "ACTIVE") klausa.push(EXISTS_PENDAFTARAN_AKTIF);
  if (status === "COMPLETED") klausa.push(`NOT ${EXISTS_PENDAFTARAN_AKTIF}`);

  if (jenis) {
    // Semantiknya "kunjungan TERAKHIR pasien berjenis ini", bukan "pasien
    // pernah punya kunjungan jenis ini" (keputusan Arthuro, 21 Ags 2026).
    //
    // Bentuk penulisannya: subquery skalar ORDER BY ... LIMIT 1, BUKAN
    // `k.MASUK = (SELECT MAX(...))`. Keduanya benar, tapi bentuk MAX diukur
    // 74,8 detik melawan 16,2 detik untuk bentuk ini pada dokter dengan 14.298
    // pasien — MAX memaksa dua subquery berkorelasi bertingkat per pasien.
    //
    // ponytail: 16 detik tetap terlalu lambat untuk layar HP, dan itu LANTAI
    // untuk skema ini — sudah diuji 4 bentuk penulisan, termasuk membalik arah
    // query dan menyaring lewat pendaftaran aktif; semuanya 7-75 detik. Biang
    // lambatnya struktural: predikat ini harus dievaluasi untuk setiap pasien
    // dokter (14 ribu) supaya COUNT-nya benar, dan tidak ada index yang
    // menjawab "jenis ruangan kunjungan terakhir per NORM". Perbaikan
    // sebenarnya adalah tabel ringkasan lokal (NORM -> jenis kunjungan
    // terakhir) yang di-refresh berkala, bukan query yang lebih pintar.
    const jenisTerakhir = `SELECT r.JENIS_KUNJUNGAN
        FROM pendaftaran.kunjungan k
        JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
        LEFT JOIN master.ruangan r ON r.ID = k.RUANGAN
       WHERE pd.NORM = pas.NORM
       ORDER BY k.MASUK DESC LIMIT 1`;
    klausa.push(kondisiJenisTerakhir(jenis, jenisTerakhir));
  }

  return { join, where: klausa.join(" AND "), params };
}

// Tanggal kunjungan terakhir pasien, sebagai satu ekspresi skalar. Bentuk
// ORDER BY ... LIMIT 1 dipakai lagi di sini, bukan MAX(), sesuai temuan di
// kondisiJenisTerakhir di atas.
const SQL_MASUK_TERAKHIR = `SELECT k.MASUK
    FROM pendaftaran.kunjungan k
    JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
   WHERE pd.NORM = pas.NORM AND k.MASUK <= NOW()
   ORDER BY k.MASUK DESC LIMIT 1`;

// `pas.NORM` sebagai pemecah seri di semua arah: tanpa itu dua pasien dengan
// tanggal sama bisa bertukar posisi antar halaman, jadi ada yang terlewat.
//
// ponytail: mengurutkan pakai subquery ini berarti mengevaluasinya untuk setiap
// pasien milik dokter sebelum LIMIT bisa dipakai — LANTAI yang sama dengan
// filter jenis kunjungan di atas (dokter dengan 14 ribu pasien = hitungan belasan
// detik). Perbaikan sebenarnya juga sama: tabel ringkasan NORM -> kunjungan
// terakhir yang di-refresh berkala, bukan query yang lebih pintar.
function klausaUrutan(urutkan) {
  if (!urutkan) return "pas.NAMA ASC, pas.NORM ASC";
  // Pasien tanpa kunjungan selalu di bawah. MySQL menaruh NULL paling awal di
  // ASC — jadi arah DESC sudah benar sendiri, arah ASC yang perlu COALESCE.
  return urutkan === "terbaru"
    ? `(${SQL_MASUK_TERAKHIR}) DESC, pas.NORM ASC`
    : `COALESCE((${SQL_MASUK_TERAKHIR}), '9999-12-31') ASC, pas.NORM ASC`;
}

// Diagnosa satu kunjungan, dua sumber berjenjang.
//
// Pilihan pertama `pendaftaran.dpjp_diagnosa` — diagnosa kerja yang ditulis
// DPJP, paling spesifik, dan punya ICD10. Tapi tabel itu SANGAT jarang terisi:
// cuma 138.819 dari 11.109.782 kunjungan (1,25%). Dipakai sendirian, kartu
// pasien praktis selalu tanpa diagnosa.
//
// Cadangannya `pendaftaran.pendaftaran.DIAGNOSA_MASUK` (kode) yang di-lookup ke
// `master.diagnosa_masuk` (40.845 baris, ID -> ICD + teks). Kolom itu terisi di
// 3.754.834 dari 3.762.384 pendaftaran (99,8%). Levelnya pendaftaran, bukan
// kunjungan, jadi lebih kasar — tapi ada.
//
// Butuh `dm` sudah ter-LEFT JOIN oleh pemanggil.
const SQL_DIAGNOSA = `
  COALESCE(
    (SELECT dd.DIAGNOSA FROM pendaftaran.dpjp_diagnosa dd
      WHERE dd.KUNJUNGAN = k.NOMOR AND dd.STATUS = 1
      ORDER BY dd.KATEGORI_DIAGNOSA ASC, dd.ID DESC LIMIT 1),
    dm.DIAGNOSA
  )`;

// Status ACTIVE/COMPLETED untuk satu halaman NORM.
//
// Dulu ini kolom `EXISTS (...) AS AKTIF` di query halaman, dan di situlah biaya
// terbesar layar daftar pasien bersembunyi. Kelihatannya cuma dihitung untuk 20
// baris yang keluar, padahal MySQL mengevaluasinya SEBELUM LIMIT — jadi sekali
// untuk tiap pasien dokter itu. Diukur pada dokter dengan 14 ribu pasien:
// query halaman dengan kolom ini 11,2 detik, tanpa kolom ini 1,3 detik.
//
// Dipindah jadi satu query terpisah atas 20 NORM yang sudah pasti terpilih,
// pola yang sama dengan getKunjunganTerdekat di bawah. Biayanya ratusan
// milidetik.
async function getStatusAktif(normList) {
  if (normList.length === 0) return new Set();

  const slot = normList.map(() => "?").join(",");
  const baris = await q(
    `SELECT DISTINCT pa.NORM FROM pendaftaran.pendaftaran pa
      WHERE pa.NORM IN (${slot}) AND pa.STATUS = 1`,
    normList
  );
  return new Set(baris.map((b) => b.NORM));
}

// Kunjungan terakhir & berikutnya + diagnosa, untuk satu halaman NORM.
//
// Versi pertama menarik SELURUH kunjungan pasien-pasien di halaman ini lalu
// memilih yang teratas di JS. Terbaca rapi, tapi di data asli itu 12 detik:
// pasien onkologi bisa punya ratusan kunjungan lintas tahun, dan subquery
// diagnosa ikut jalan untuk setiap barisnya.
//
// Sekarang DB yang memilih: MAX/MIN + GROUP BY mengembalikan tepat satu baris
// per pasien, baru detailnya (ruangan + diagnosa) diambil untuk baris terpilih
// saja. Subquery diagnosa jadi jalan maksimal sebanyak ukuran halaman.
//
// MySQL-nya 5.7 — tidak ada window function, jadi pola MAX+GROUP BY lalu join
// balik ini memang cara yang tersedia, bukan pilihan gaya.
async function getKunjunganTerdekat(normList) {
  const terakhirMap = new Map();
  const berikutnyaMap = new Map();
  if (normList.length === 0) return { terakhirMap, berikutnyaMap };

  const slot = normList.map(() => "?").join(",");

  const [puncak, berikutnya] = await Promise.all([
    q(
      `SELECT pd.NORM, MAX(k.MASUK) AS MASUK
         FROM pendaftaran.kunjungan k
         JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
        WHERE pd.NORM IN (${slot}) AND k.MASUK <= NOW()
        GROUP BY pd.NORM`,
      normList
    ),
    q(
      `SELECT pd.NORM, MIN(k.MASUK) AS MASUK
         FROM pendaftaran.kunjungan k
         JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
        WHERE pd.NORM IN (${slot}) AND k.MASUK > NOW()
        GROUP BY pd.NORM`,
      normList
    ),
  ]);

  for (const k of berikutnya) berikutnyaMap.set(k.NORM, k);

  if (puncak.length > 0) {
    // Row constructor `(a, b) IN ((?,?), ...)` — didukung MySQL 5.7, dan
    // memastikan yang diambil persis pasangan (pasien, waktu) hasil MAX di
    // atas, bukan kunjungan lain yang kebetulan sewaktu.
    const pasangan = puncak.map(() => "(?, ?)").join(", ");
    const paramsPasangan = puncak.flatMap((p) => [p.NORM, p.MASUK]);

    const detail = await q(
      `SELECT pd.NORM, k.MASUK, r.JENIS_KUNJUNGAN, ${SQL_DIAGNOSA} AS DIAGNOSA
         FROM pendaftaran.kunjungan k
         JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
         LEFT JOIN master.ruangan r ON r.ID = k.RUANGAN
         LEFT JOIN master.diagnosa_masuk dm ON dm.ID = pd.DIAGNOSA_MASUK
        WHERE (pd.NORM, k.MASUK) IN (${pasangan})`,
      paramsPasangan
    );

    // Satu pasien bisa punya >1 kunjungan pada detik yang sama (ruangan beda);
    // yang pertama sudah cukup, sama seperti perilaku versi sebelumnya.
    for (const k of detail) if (!terakhirMap.has(k.NORM)) terakhirMap.set(k.NORM, k);
  }

  return { terakhirMap, berikutnyaMap };
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

  // DOKTER selalu dikunci ke dirinya sendiri (Aturan #2) — id SIMRS-nya
  // diterjemahkan dari klaim JWT, bukan diterima dari request.
  const dokterUuid = role === "DOKTER" ? ownDokterId : values.dokterId;
  const aksesDokterId = dokterUuid ? await simrsDokterId(dokterUuid) : null;

  if (role === "DOKTER" && !aksesDokterId) {
    return res.status(403).json({ message: "Akun dokter ini tidak terdaftar di SIMRS" });
  }

  const { join, where, params } = bangunFilter({ ...values, aksesDokterId });
  const { page, limit } = values;
  // page & limit sudah dijamin integer dalam batas oleh parsePagination, jadi
  // aman di-inline. mysql2 `execute` mengirim placeholder LIMIT sebagai string
  // dan MySQL menolaknya — ini alasannya tidak diparameterkan.
  const offset = (page - 1) * limit;

  // URUTANNYA PENTING — halaman dulu, sendirian, baru sisanya.
  //
  // Versi sebelumnya menjalankan COUNT dan query halaman bersamaan lewat
  // Promise.all. Terlihat seperti penghematan, ternyata kebalikannya: keduanya
  // memakai derived table akses DPJP yang sama, jadi MySQL membangun union 14
  // ribu NORM itu DUA KALI sekaligus, dan keduanya saling berebut. Diukur pada
  // dokter 117: bentuk paralel 34,6 detik, bentuk berurutan di bawah 4,8 detik.
  const baris = await q(
    `SELECT pas.NORM, pas.NAMA
       FROM master.pasien pas ${join}
      WHERE ${where}
      ORDER BY ${klausaUrutan(values.urutkan)}
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  const normList = baris.map((b) => b.NORM);

  const hitungTotal = parseHitungTotal(req.query);

  const [hitung, aktifSet, { terakhirMap, berikutnyaMap }] = await Promise.all([
    hitungTotal
      ? q(`SELECT COUNT(*) AS total FROM master.pasien pas ${join} WHERE ${where}`, params)
      : null,
    getStatusAktif(normList),
    getKunjunganTerdekat(normList),
  ]);

  const total = hitung ? Number(hitung[0]?.total ?? 0) : null;

  const data = baris.map((b) => {
    const terakhir = terakhirMap.get(b.NORM);
    const berikutnya = berikutnyaMap.get(b.NORM);

    return {
      id: String(b.NORM),
      norm: String(b.NORM),
      nama: b.NAMA,
      status: aktifSet.has(b.NORM) ? "ACTIVE" : "COMPLETED",
      diagnosaSingkat: diagnosaBersih(terakhir?.DIAGNOSA),
      jenisKunjungan: terakhir ? kategoriKunjungan(terakhir.JENIS_KUNJUNGAN) : null,
      tanggalKunjunganTerakhir: tanggalWIB(terakhir?.MASUK),
      tanggalKunjunganBerikutnya: tanggalWIB(berikutnya?.MASUK),
    };
  });

  res.json({
    data,
    // `total`/`totalPages` null kalau tidak diminta lewat ?hitungTotal=1.
    // Bentuk objeknya tetap sama supaya kontraknya tidak bercabang.
    pagination: {
      page,
      limit,
      total,
      totalPages: total === null ? null : Math.ceil(total / limit),
    },
  });
});

router.get("/:id", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;
  const norm = Number(req.params.id);

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }
  if (!Number.isInteger(norm)) {
    return res.status(404).json({ message: "Pasien tidak ditemukan" });
  }

  let aksesDokterId = null;
  if (role === "DOKTER") {
    aksesDokterId = await simrsDokterId(ownDokterId);
    if (!aksesDokterId) {
      return res.status(403).json({ message: "Akun dokter ini tidak terdaftar di SIMRS" });
    }
  }

  // Ambil barisnya dulu (lookup PK, murah), akses dicek terpisah.
  //
  // Dulu klausa akses ditempel ke WHERE query ini supaya "satu definisi boleh
  // lihat". Niatnya benar tapi harganya 1,4 detik: klausa itu membangun
  // himpunan seluruh pasien dokter demi menyaring SATU baris yang sudah
  // ditunjuk primary key. Definisinya tetap satu — sekarang tinggal di
  // dokterPunyaAksesPasien(), dipakai juga oleh detail Kunjungan dan Lab.
  const pasienBaris = await q(
    `SELECT pas.NORM, pas.NAMA, pas.JENIS_KELAMIN, pas.TANGGAL_LAHIR, pas.TEMPAT_LAHIR,
            pas.ALAMAT, pas.GOLONGAN_DARAH, pas.TANGGAL,
            ${EXISTS_PENDAFTARAN_AKTIF} AS AKTIF
       FROM master.pasien pas
      WHERE pas.NORM = ? AND pas.STATUS = 1
      LIMIT 1`,
    [norm]
  );

  const bolehLihat =
    pasienBaris.length > 0 &&
    (!aksesDokterId || (await dokterPunyaAksesPasien(aksesDokterId, norm)));

  if (!bolehLihat) {
    // Sengaja 403, bukan 404: membedakan "tidak ada" dari "ada tapi bukan
    // pasien Anda" akan membocorkan keberadaan nomor RM ke dokter yang tidak
    // berhak. Versi dummy berperilaku sama.
    return res.status(403).json({ message: "Anda tidak memiliki akses ke data pasien ini" });
  }

  const p = pasienBaris[0];

  const riwayat = await q(
    `SELECT k.NOMOR, k.MASUK, k.KELUAR, k.BARU, k.STATUS,
            r.DESKRIPSI AS RUANGAN_NAMA, r.JENIS_KUNJUNGAN,
            pg.NAMA AS DOKTER_NAMA, ${SQL_DIAGNOSA} AS DIAGNOSA
       FROM pendaftaran.kunjungan k
       JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
       LEFT JOIN master.ruangan r ON r.ID = k.RUANGAN
       LEFT JOIN master.diagnosa_masuk dm ON dm.ID = pd.DIAGNOSA_MASUK
       LEFT JOIN pendaftaran.tujuan_pasien tp ON tp.NOPEN = k.NOPEN
       LEFT JOIN master.dokter dk ON dk.ID = tp.DOKTER
       LEFT JOIN master.pegawai pg ON pg.NIP = dk.NIP
      WHERE pd.NORM = ?
      ORDER BY k.MASUK DESC`,
    [norm]
  );

  res.json({
    id: String(p.NORM),
    norm: String(p.NORM),
    nama: p.NAMA,
    jenisKelamin: jenisKelamin(p.JENIS_KELAMIN),
    tanggalLahir: tanggalWIB(p.TANGGAL_LAHIR),
    tempatLahir: teks(p.TEMPAT_LAHIR),
    alamat: teks(p.ALAMAT),
    // GOLONGAN_DARAH tinyint = kode master.referensi yang belum dipetakan.
    // Dikirim null daripada memancarkan angka mentah yang akan tampil sebagai
    // golongan darah "3" di layar dokter.
    golonganDarah: null,
    noRekamMedis: String(p.NORM),
    createdAt: tanggalWIB(p.TANGGAL),
    updatedAt: tanggalWIB(p.TANGGAL),
    assignment: {
      id: null,
      status: Number(p.AKTIF) === 1 ? "ACTIVE" : "COMPLETED",
      tanggalAssign: null,
    },
    riwayatKunjungan: riwayat.map((k) => {
      const masuk = tanggalWIB(k.MASUK);
      return {
        id: k.NOMOR,
        tanggalMasuk: masuk,
        tanggalKeluar: tanggalWIB(k.KELUAR),
        diagnosa: diagnosaBersih(k.DIAGNOSA),
        // Diturunkan dari tanggal, sama seperti versi dummy. SIMRS punya
        // kolom STATUS sendiri di kunjungan, tapi arti kodenya belum
        // dikonfirmasi DBA (pertanyaan §4 no.5 di simrs-schema-mapping.md),
        // jadi statusnya dihitung dari tanggal — bukan ditebak dari kode.
        statusKunjungan: statusEfektif(masuk, null, KUNJUNGAN),
        isPasienBaru: Number(k.BARU) === 1,
        jenisKunjungan: kategoriKunjungan(k.JENIS_KUNJUNGAN),
        ruangan: { nama: teks(k.RUANGAN_NAMA), jenis: ruanganJenis(k.JENIS_KUNJUNGAN) },
        dokter: k.DOKTER_NAMA ? { nama: k.DOKTER_NAMA } : null,
      };
    }),
  });
});

module.exports = router;
// Diekspor khusus untuk tes urutan di src/__tests__/simrs.test.js.
// Bukan bagian dari API modul ini.
module.exports.klausaUrutan = klausaUrutan;
