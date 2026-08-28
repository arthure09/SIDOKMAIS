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

// Modul Hasil Lab versi SIMRS — read-only, bentuk response identik dengan
// routes/dummy/lab.routes.js. Sama seperti versi dummy, `pasienId` WAJIB:
// tidak ada jalur "semua lab dokter ini", dan itu juga yang menjaga setiap
// query di sini tetap terbatas ke satu pasien.
//
// Sumbernya skema `layanan`, bukan `lis`. Skema `lis*` ada dan jauh lebih
// besar (lis.hasil_log 23,5 juta baris), tapi isinya jembatan mentah dari
// alat analyzer (LIS_KODE_TEST, LIS_NAMA_INSTRUMENT, VENDOR_LIS), tanpa
// kaitan ke kunjungan/dokter — yang dipakai SIMRS sendiri ada di `layanan`.
//
// Rantainya:
//   layanan.order_lab        NOMOR, KUNJUNGAN, TANGGAL, DOKTER_ASAL, TUJUAN
//     -> layanan.order_detil_lab  ORDER_ID = NOMOR, satu baris per tindakan
//       -> layanan.hasil_lab      TINDAKAN_MEDIS = order_detil_lab.REF
//
// Satu "PemeriksaanLab" di sini = satu (ORDER_ID, TINDAKAN), bukan satu REF.
// REF adalah nomor tindakan-medis dan bisa dipakai bersama oleh beberapa
// TINDAKAN dalam order yang sama, jadi memisahkan hasil per pemeriksaan
// butuh `parameter_tindakan_lab.TINDAKAN` sebagai penyaring kedua — tanpa
// itu, hasil dua pemeriksaan berbeda tercampur jadi satu daftar parameter.

// Kode flag dari LIS. Nilai yang benar-benar muncul cuma lima: '', L, H, VL, VH
// (dihitung dari sebulan data). Tidak ada padanan untuk ABNORMAL di enum
// SIDOKMAIS — flag SIMRS selalu berupa arah, bukan "abnormal" generik.
const FLAG = { H: "TINGGI", VH: "TINGGI", L: "RENDAH", VL: "RENDAH" };

// PENTING: 67% item TIDAK punya flag (116.260 dari 172.491 baris bulan ini).
// Kosong di sini berarti "tidak ditandai LIS", bukan "sudah dipastikan normal" —
// hasil non-numerik (kultur, deskripsi) memang tidak pernah dapat flag. Dipetakan
// ke NORMAL supaya bentuknya sama dengan versi dummy, dengan konsekuensi yang
// harus disadari: `adaFlagAbnormal` di mode SIMRS lebih konservatif daripada di
// mode dummy. Menghitung abnormal sendiri dari nilai vs rujukan tidak dilakukan
// di sini — itu penafsiran klinis, bukan pemetaan data.
function flagLab(kode) {
  return FLAG[teks(kode)?.toUpperCase()] ?? "NORMAL";
}

// id gabungan ORDER_ID + TINDAKAN. ORDER_ID char(21), TINDAKAN angka, jadi
// pemisah "." tidak pernah ambigu; dipisah dari belakang supaya tetap benar
// walau suatu saat ORDER_ID memuat titik.
function gabungId(orderId, tindakan) {
  return `${orderId}.${tindakan}`;
}

function pecahId(id) {
  const batas = String(id).lastIndexOf(".");
  if (batas <= 0) return null;
  const orderId = String(id).slice(0, batas);
  const tindakan = Number(String(id).slice(batas + 1));
  return Number.isInteger(tindakan) ? { orderId, tindakan } : null;
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

// Jalur pasien -> order lab. Digerakkan dari `pendaftaran.pendaftaran.NORM`
// (ber-index) lalu turun lewat kunjungan; arah sebaliknya memaksa MySQL memindai
// order_lab. `k.NOMOR = ol.KUNJUNGAN` memakai index KUNJUNGAN di order_lab.
const SUMBER = `
  FROM pendaftaran.pendaftaran pd
  JOIN pendaftaran.kunjungan k ON k.NOPEN = pd.NOMOR
  JOIN layanan.order_lab ol ON ol.KUNJUNGAN = k.NOMOR
  JOIN layanan.order_detil_lab od ON od.ORDER_ID = ol.NOMOR
`;

// Hanya pemeriksaan yang hasilnya memang sudah ada yang ditampilkan — padanan
// `status: "COMPLETED"` di versi dummy. Di SIMRS tidak ada kolom status yang
// artinya sudah dikonfirmasi (order_lab.STATUS tinyint tanpa komentar), jadi
// keberadaan baris hasil dipakai sebagai bukti langsung, bukan kode yang perlu
// ditafsirkan. Pola yang sama dipakai modul Operasi untuk `alasan_batal`.
const ADA_HASIL = `
  EXISTS (
    SELECT 1 FROM layanan.hasil_lab h
      JOIN master.parameter_tindakan_lab p ON p.ID = h.PARAMETER_TINDAKAN
     WHERE h.TINDAKAN_MEDIS = od.REF AND p.TINDAKAN = od.TINDAKAN
  )
`;

// Satu tindakan bisa terdaftar di lebih dari satu group_lab; diambil yang
// ID-nya terkecil supaya urutannya tetap sama tiap panggilan. Terisi untuk
// 84% pemeriksaan — sisanya null, dan frontend memang sudah memperlakukan
// kategori sebagai boleh-kosong.
const KATEGORI = `
  (SELECT gl.DESKRIPSI
     FROM master.group_tindakan_lab gtl
     JOIN master.group_lab gl ON gl.ID = gtl.GROUP_LAB
    WHERE gtl.TINDAKAN = od.TINDAKAN AND gtl.STATUS = 1
    ORDER BY gl.ID ASC LIMIT 1)
`;

function bangunFilter({ norm, dariTanggal, sampaiTanggal }) {
  // 51 dari 175 ribu order bertanggal di masa depan (satu di antaranya 2027) —
  // salah ketik tahun di entri. Jumlahnya sepele, tapi karena daftar ini urut
  // menurun, baris rusak itu justru selalu nangkring di paling atas. Dibuang.
  const klausa = ["pd.NORM = ?", ADA_HASIL, "ol.TANGGAL <= NOW()"];
  const params = [norm];

  if (dariTanggal) {
    klausa.push("ol.TANGGAL >= ?");
    params.push(keWaktuSimrs(dariTanggal));
  }
  if (sampaiTanggal) {
    klausa.push("ol.TANGGAL <= ?");
    params.push(keWaktuSimrs(sampaiTanggal));
  }

  return { where: klausa.join(" AND "), params };
}

// Ringkasan hasil per pemeriksaan untuk SATU halaman saja.
//
// Sengaja query kedua, bukan subquery skalar di SELECT halaman pertama:
// jumlah parameter, tanggal hasil, dan ada-tidaknya flag butuh tiga agregat
// dari tabel yang sama, dan tiga subquery skalar berarti tiga kali pemindaian
// per baris. Satu GROUP BY atas maksimal `limit` REF jauh lebih murah, dan
// SQL-nya tetap MySQL 5.7 (tanpa window function).
async function ringkasanHasil(barisHalaman) {
  if (barisHalaman.length === 0) return new Map();

  const refs = barisHalaman.map((b) => b.REF);
  const tanda = refs.map(() => "?").join(",");

  const agregat = await q(
    `SELECT h.TINDAKAN_MEDIS AS REF, p.TINDAKAN,
            COUNT(*) AS JUMLAH,
            MAX(h.TANGGAL) AS TGL_HASIL,
            SUM(h.LIS_FLAG IS NOT NULL AND h.LIS_FLAG <> '') AS ABNORMAL
       FROM layanan.hasil_lab h
       JOIN master.parameter_tindakan_lab p ON p.ID = h.PARAMETER_TINDAKAN
      WHERE h.TINDAKAN_MEDIS IN (${tanda})
      GROUP BY h.TINDAKAN_MEDIS, p.TINDAKAN`,
    refs
  );

  const peta = new Map();
  for (const a of agregat) {
    peta.set(`${a.REF}|${a.TINDAKAN}`, a);
  }
  return peta;
}

// GET /api/lab?pasienId=&page=&limit= — ringkasan hasil lab satu pasien.
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

  // Sama seperti versi dummy: "pasien tidak ada" dan "bukan pasien Anda" tidak
  // dibedakan — keduanya 403, supaya endpoint ini tidak jadi cara menebak NORM
  // mana yang valid.
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

  // Halaman dulu, COUNT belakangan dan hanya kalau diminta — alasannya sama
  // dengan pasien.routes.js (lihat parseHitungTotal di utils/queryParams.js).
  const [hitung, baris] = await Promise.all([
    parseHitungTotal(req.query)
      ? q(`SELECT COUNT(*) AS total ${SUMBER} WHERE ${where}`, params)
      : null,
    q(
      `SELECT ol.NOMOR, ol.TANGGAL AS TGL_PERMINTAAN, od.TINDAKAN, od.REF,
              t.NAMA AS NAMA_PEMERIKSAAN,
              r.DESKRIPSI AS LABORATORIUM,
              ${KATEGORI} AS KATEGORI
         ${SUMBER}
         LEFT JOIN master.tindakan t ON t.ID = od.TINDAKAN
         LEFT JOIN master.ruangan r ON r.ID = ol.TUJUAN
        WHERE ${where}
        ORDER BY ol.TANGGAL DESC
        LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
  ]);

  const peta = await ringkasanHasil(baris);

  res.json({
    data: baris.map((b) => {
      const a = peta.get(`${b.REF}|${b.TINDAKAN}`);
      return {
        id: gabungId(b.NOMOR, b.TINDAKAN),
        kategori: teks(b.KATEGORI),
        namaPemeriksaan: teks(b.NAMA_PEMERIKSAAN),
        laboratorium: teks(b.LABORATORIUM),
        // Selalu COMPLETED: daftar ini memang cuma memuat yang sudah ada
        // hasilnya (lihat ADA_HASIL).
        status: "COMPLETED",
        tanggalPermintaan: tanggalWIB(b.TGL_PERMINTAAN),
        tanggalHasil: a ? tanggalWIB(a.TGL_HASIL) : null,
        jumlahParameter: a ? Number(a.JUMLAH) : 0,
        // Jumlah, bukan boolean — SUM(LIS_FLAG terisi) memang sudah dihitung di
        // ringkasanHasil(), jadi angkanya gratis. Catatan konservatif di atas
        // tetap berlaku: yang tidak diberi flag oleh LIS tidak ikut terhitung.
        jumlahAbnormal: a ? Number(a.ABNORMAL) : 0,
      };
    }),
    pagination: {
      page,
      limit,
      total: hitung ? Number(hitung[0]?.total ?? 0) : null,
      totalPages: hitung ? Math.ceil(Number(hitung[0]?.total ?? 0) / limit) : null,
    },
  });
});

// GET /api/lab/:id — detail satu pemeriksaan + seluruh parameter hasilnya.
router.get("/:id", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const bagian = pecahId(req.params.id);
  if (!bagian) {
    return res.status(404).json({ message: "Pemeriksaan lab tidak ditemukan" });
  }

  const baris = await q(
    `SELECT ol.NOMOR, ol.KUNJUNGAN, ol.TANGGAL AS TGL_PERMINTAAN, ol.ALASAN,
            ol.DOKTER_ASAL, od.TINDAKAN, od.REF,
            t.NAMA AS NAMA_PEMERIKSAAN,
            r.DESKRIPSI AS LABORATORIUM,
            ${KATEGORI} AS KATEGORI,
            pd.NORM, pas.NAMA AS PASIEN_NAMA,
            pg.NAMA AS DOKTER_NAMA
       ${SUMBER}
       LEFT JOIN master.tindakan t ON t.ID = od.TINDAKAN
       LEFT JOIN master.ruangan r ON r.ID = ol.TUJUAN
       LEFT JOIN master.pasien pas ON pas.NORM = pd.NORM
       LEFT JOIN master.dokter dk ON dk.ID = ol.DOKTER_ASAL
       LEFT JOIN master.pegawai pg ON pg.NIP = dk.NIP
      WHERE ol.NOMOR = ? AND od.TINDAKAN = ?
      LIMIT 1`,
    [bagian.orderId, bagian.tindakan]
  );

  if (baris.length === 0) {
    return res.status(404).json({ message: "Pemeriksaan lab tidak ditemukan" });
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
        .json({ message: "Anda tidak memiliki akses ke data pemeriksaan lab ini" });
    }
  }

  // JANGAN tukar HASIL dan NILAI. Nama kolomnya menyesatkan dan tertukarnya
  // tidak akan memicu error apa pun — cuma seluruh nilai lab tampil di kolom
  // rujukan dan sebaliknya. Diukur dari sebulan data: HASIL rata-rata 3,5
  // karakter dan mayoritas angka murni (nilai ukur), NILAI rata-rata 6,9
  // karakter dan mayoritas memuat "-" (rentang rujukan).
  //
  // KETERANGAN tidak dipakai: terisi 99,99% tapi rata-rata panjangnya 1,09
  // karakter — hampir semuanya cuma "-". Pola yang sama dengan
  // master.diagnosa_masuk, lihat diagnosaBersih().
  const item = await q(
    `SELECT h.ID, h.TANGGAL, p.PARAMETER, h.HASIL, h.SATUAN, h.NILAI, h.LIS_FLAG,
            p.NILAI_RUJUKAN, p.INDEKS
       FROM layanan.hasil_lab h
       JOIN master.parameter_tindakan_lab p ON p.ID = h.PARAMETER_TINDAKAN
      WHERE h.TINDAKAN_MEDIS = ? AND p.TINDAKAN = ?
      ORDER BY p.INDEKS ASC, p.PARAMETER ASC`,
    [b.REF, bagian.tindakan]
  );

  const hasilLabItem = item.map((i) => ({
    id: String(i.ID),
    namaParameter: teks(i.PARAMETER),
    nilai: teks(i.HASIL),
    satuan: teks(i.SATUAN),
    // Rujukan per-hasil lebih diutamakan daripada rujukan master: master cuma
    // satu nilai per parameter, sementara rentang sebenarnya bisa beda menurut
    // umur/jenis kelamin dan itu yang tercatat di baris hasil.
    nilaiRujukan: teks(i.NILAI) ?? teks(i.NILAI_RUJUKAN),
    flag: flagLab(i.LIS_FLAG),
    urutan: i.INDEKS === null ? null : Number(i.INDEKS),
  }));

  res.json({
    id: gabungId(b.NOMOR, b.TINDAKAN),
    pasienId: String(b.NORM),
    kunjunganId: teks(b.KUNJUNGAN),
    dokterPemintaId: b.DOKTER_ASAL ? String(b.DOKTER_ASAL) : null,
    kategori: teks(b.KATEGORI),
    namaPemeriksaan: teks(b.NAMA_PEMERIKSAAN),
    laboratorium: teks(b.LABORATORIUM),
    tanggalPermintaan: tanggalWIB(b.TGL_PERMINTAAN),
    // Item diurutkan menurut INDEKS, bukan waktu — jadi tanggal hasil diambil
    // dari yang paling akhir keluar, bukan dari baris terakhir daftar.
    tanggalHasil: tanggalWIB(item.reduce((m, i) => (!m || i.TANGGAL > m ? i.TANGGAL : m), null)),
    status: "COMPLETED",
    catatan: teks(b.ALASAN),
    // SIMRS tidak mencatat kapan baris dibuat/diubah untuk order lab.
    createdAt: null,
    updatedAt: null,
    pasien: b.NORM ? { id: String(b.NORM), nama: teks(b.PASIEN_NAMA), norm: String(b.NORM) } : null,
    dokterPeminta: b.DOKTER_ASAL
      ? {
          id: String(b.DOKTER_ASAL),
          nama: teks(b.DOKTER_NAMA),
          // SMF di master.pegawai masih berupa kode dan tabel referensinya
          // belum dipetakan — null, bukan angka mentah.
          spesialisasi: null,
        }
      : null,
    // Nullable dengan sengaja, sama seperti versi dummy — frontend WAJIB
    // menganggap ini bisa null.
    hasilLabItem: hasilLabItem.length > 0 ? hasilLabItem : null,
  });
});

module.exports = router;
// Diekspor buat test — dua bagian yang salahnya tidak memicu error apa pun,
// cuma menampilkan hal yang keliru di layar dokter.
module.exports.flagLab = flagLab;
module.exports.gabungId = gabungId;
module.exports.pecahId = pecahId;
