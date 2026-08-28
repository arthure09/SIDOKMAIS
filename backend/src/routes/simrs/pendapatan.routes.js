const express = require("express");
const { q } = require("../../lib/simrs");
const { simrsDokterId } = require("../../utils/simrsAkses");
const { parseDokterIdFilter } = require("../../utils/queryParams");
const { tanggalWIB, keWaktuSimrs, namaLengkap, teks } = require("../../utils/simrsBentuk");

const router = express.Router();

// Modul Jasa Medis (Pendapatan) versi SIMRS. View-only untuk kedua role —
// aplikasi ini tidak pernah menghitung maupun mengubah angka remunerasi.
//
// Sumbernya `db_remunmedis.tb_tampilsiremdis` (6,3 juta baris, PRIMARY di
// ID_SIREMDIS, ID_DOKTER ber-index) — namanya harfiah: baris yang DITAMPILKAN
// SIREMDIS ke dokternya. Bukan `tb_remun_new`: dibandingkan langsung di
// replika (agregat, tanpa membaca baris pasien),
//
//   tabel                    baris        TANGGALTINDAKAN terakhir
//   tb_remun_new             3,9 juta     15 Feb 2026     <- berhenti
//   tb_tampilsiremdis        6,3 juta     23 Ags 2026     <- berjalan
//   tb_tidaktampilsiremdis   0,6 juta     30 Nov 2023     <- mati
//
// KEDUANYA punya kolom ID_SIREMDIS dengan rentang angka bertumpuk, tapi itu
// BUKAN kunci yang sama — dua tabel ini auto-increment sendiri-sendiri.
// Dicocokkan lewat ID_SIREMDIS untuk satu dokter satu bulan, 803 dari 803
// baris "ketemu", padahal cuma 2 yang ID_DOKTER-nya sama dan 0 yang
// tanggalnya sama. Jangan pernah menjoin keduanya lewat ID_SIREMDIS.
//
// Angka historisnya juga tidak identik: dicocokkan lewat kunci alami
// (TINDAKAN_MEDIS + ID_DOKTER), 733 dari 834 baris tb_remun_new muncul di
// tb_tampilsiremdis — sisanya (~12%) memang tidak ditampilkan SIREMDIS.
// Pindah sumber menurunkan angka bulan lama juga, bukan cuma menambah bulan
// baru (dokter contoh, Jan 2026: Rp 235,9 jt -> Rp 206,1 jt) — yang benar
// adalah yang ditampilkan SIREMDIS, bukan seluruh isi tabel perhitungan.
//
// `ID_DOKTER` adalah dokter penerima jasa, bukan sekadar operator tindakan —
// diperiksa: nol baris yang ID_DOKTER_NUKLIR-nya dokter tertentu sementara
// ID_DOKTER-nya orang lain. Menyaring dengan ID_DOKTER saja sudah lengkap.
//
// JASA BISA NEGATIF (baris "DISKON KONSUL"): 156 dari 4.839 baris dokter
// contoh sepanjang 2026. Itu potongan sungguhan dan harus ikut dijumlah,
// jangan disaring — bar proporsi di layar sudah menjaga dirinya sendiri
// (`Math.max(total, 0)`).
//
// Kolom yang belum dipakai tapi tersedia di sini dan tidak ada di tabel lama:
// KATEGORI_REMUN (mis. "VISITE BPJS RAWAT INAP", "KEMOTERAPI UMUM/ASURANSI"),
// SMF, KELAS, TANGGAL_SK.
const SUMBER = "db_remunmedis.tb_tampilsiremdis";

// CARABAYAR berupa teks bebas nama penjamin ("BPJS / JKN", "TANPA ASURANSI /
// UMUM", "PT. PRUDENTIAL LIFE ASSURANCE", ...). Hanya satu yang berarti JKN.
// Dicocokkan dengan LIKE, bukan sama-dengan persis, supaya varian penulisan
// ("BPJS", "JKN") tetap terhitung — salah menggolongkan di sini langsung
// menggeser dua angka ringkasan sekaligus.
const SQL_IS_JKN = "(CARABAYAR LIKE '%JKN%' OR CARABAYAR LIKE '%BPJS%')";

function parsePeriode(query) {
  const errors = [];
  const nilai = {};

  for (const key of ["tanggalAwal", "tanggalAkhir"]) {
    if (query[key] === undefined) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query[key]) || Number.isNaN(Date.parse(query[key]))) {
      errors.push(`${key} harus berformat YYYY-MM-DD`);
    } else {
      nilai[key] = query[key];
    }
  }

  if (nilai.tanggalAwal && nilai.tanggalAkhir && nilai.tanggalAwal > nilai.tanggalAkhir) {
    errors.push("tanggalAwal tidak boleh setelah tanggalAkhir");
  }

  return { errors, ...nilai };
}

// Disalin apa adanya dari routes/dummy/pendapatan.routes.js supaya kedua mode
// memilih periode bawaan yang sama persis.
function periodeDefault(bulanTerbaru, sekarang) {
  // keWaktuSimrs() = instant -> jam dinding WIB; 10 karakter pertamanya tanggal
  // kalender WIB. tanggalWIB() arahnya kebalikan (string SIMRS -> Date), jadi
  // tidak dipakai di sini.
  const hariIni = keWaktuSimrs(sekarang).slice(0, 10);
  if (!bulanTerbaru) return { tanggalAwal: `${hariIni.slice(0, 7)}-01`, tanggalAkhir: hariIni };

  const [tahun, bulan] = bulanTerbaru.split("-").map(Number);
  // Hari terakhir bulan itu: hari ke-0 bulan berikutnya. Dihitung pada tengah
  // malam WIB supaya tidak meleset satu hari saat dikonversi balik.
  const akhirBulan = keWaktuSimrs(new Date(Date.UTC(tahun, bulan, 0) - 7 * 3600000)).slice(0, 10);
  return {
    tanggalAwal: `${bulanTerbaru}-01`,
    tanggalAkhir: akhirBulan < hariIni ? akhirBulan : hariIni,
  };
}

router.get("/", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const periode = parsePeriode(req.query);
  if (periode.errors.length > 0) {
    return res.status(400).json({ message: "Query params tidak valid", errors: periode.errors });
  }

  // dokterId untuk DOKTER selalu dari JWT. `?dokterId=` hanya dihormati untuk
  // ADMIN, dan parseDokterIdFilter sudah membuangnya kalau pemanggilnya
  // DOKTER. Modul ini tidak memakai scoping DPJP sama sekali — yang
  // ditampilkan adalah remunerasi dokter itu sendiri, bukan data pasien orang
  // lain.
  const dokterUuid = role === "DOKTER" ? ownDokterId : parseDokterIdFilter(req.query, role);
  if (!dokterUuid) {
    return res.status(400).json({ message: "dokterId wajib diisi untuk role ADMIN" });
  }

  const dokterId = await simrsDokterId(dokterUuid);
  if (!dokterId) {
    return res.status(403).json({ message: "Akun dokter ini tidak terdaftar di SIMRS" });
  }

  const [identitas, bulanBaris] = await Promise.all([
    q(
      `SELECT pg.NAMA, pg.GELAR_DEPAN, pg.GELAR_BELAKANG
         FROM master.dokter d
         LEFT JOIN master.pegawai pg ON pg.NIP = d.NIP
        WHERE d.ID = ? LIMIT 1`,
      [dokterId]
    ),
    // Bulan yang benar-benar ada isinya, dari SELURUH riwayat dokter — bukan
    // dari periode yang sedang dilihat, kalau tidak pintasan bulan di layar
    // cuma akan berisi bulan yang sedang dibuka.
    q(
      `SELECT DISTINCT DATE_FORMAT(TANGGALTINDAKAN, '%Y-%m') AS bulan
         FROM ${SUMBER}
        WHERE ID_DOKTER = ? AND TANGGALTINDAKAN IS NOT NULL
        ORDER BY bulan DESC`,
      [dokterId]
    ),
  ]);

  const bulanTersedia = bulanBaris.map((b) => b.bulan).filter(Boolean);

  const bawaan = periodeDefault(bulanTersedia[0], new Date());
  const tanggalAwal = periode.tanggalAwal ?? bawaan.tanggalAwal;
  const tanggalAkhir = periode.tanggalAkhir ?? bawaan.tanggalAkhir;

  const baris = await q(
    `SELECT ID_SIREMDIS, TANGGALTINDAKAN, NAMATINDAKAN, UNITPELAYANAN, JASA,
            NORM, NAMALENGKAP, CARABAYAR, ${SQL_IS_JKN} AS IS_JKN
       FROM ${SUMBER}
      WHERE ID_DOKTER = ?
        AND TANGGALTINDAKAN >= ?
        -- Batas atas inklusif: "s/d 17-08" berarti sepanjang tanggal 17 ikut,
        -- jadi pembandingnya awal hari BERIKUTNYA sebagai batas eksklusif.
        AND TANGGALTINDAKAN < DATE_ADD(?, INTERVAL 1 DAY)
      ORDER BY TANGGALTINDAKAN DESC`,
    [dokterId, `${tanggalAwal} 00:00:00`, tanggalAkhir]
  );

  const data = baris.map((b) => ({
    id: String(b.ID_SIREMDIS),
    tanggalTindakan: tanggalWIB(b.TANGGALTINDAKAN),
    namaTindakan: teks(b.NAMATINDAKAN),
    unitPelayanan: teks(b.UNITPELAYANAN),
    // JASA int(11) di SIMRS — sudah rupiah bulat, tidak ada pecahan sen.
    jasa: Number(b.JASA ?? 0),
    pasien: { norm: b.NORM === null ? null : String(b.NORM), nama: teks(b.NAMALENGKAP) },
    penjamin: { nama: teks(b.CARABAYAR), isJkn: Number(b.IS_JKN) === 1 },
  }));

  // Dijumlah dari baris yang SAMA PERSIS dengan yang ditampilkan, bukan lewat
  // query SUM terpisah — alasan yang sama seperti versi dummy: dua query bisa
  // menghasilkan dua angka berbeda tanpa ada yang sadar.
  const totalJkn = data.filter((b) => b.penjamin.isJkn).reduce((n, b) => n + b.jasa, 0);
  const totalNonJkn = data.filter((b) => !b.penjamin.isJkn).reduce((n, b) => n + b.jasa, 0);

  const pegawai = identitas[0];

  res.json({
    dokter: {
      id: dokterUuid,
      nama: pegawai
        ? namaLengkap({
            gelarDepan: pegawai.GELAR_DEPAN,
            nama: pegawai.NAMA,
            gelarBelakang: pegawai.GELAR_BELAKANG,
          })
        : null,
      // SMF berupa kode dan tabel referensinya belum dipetakan.
      smf: null,
    },
    periode: { tanggalAwal, tanggalAkhir },
    bulanTersedia,
    ringkasan: {
      totalJkn,
      totalNonJkn,
      totalRemunerasiBruto: totalJkn + totalNonJkn,
      jumlahPelayanan: data.length,
    },
    data,
  });
});

module.exports = router;
