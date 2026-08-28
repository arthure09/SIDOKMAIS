const express = require("express");
const { q } = require("../../lib/simrs");
const { simrsDokterId } = require("../../utils/simrsAkses");
const { parsePagination, parseDokterIdFilter, parseRentangTanggal } = require("../../utils/queryParams");
const {
  tanggalWIB,
  keWaktuSimrs,
  jenisKelamin,
  ruanganJenis,
  kategoriKunjungan,
  prioritasKonsul,
  statusKonsul,
  persetujuanKasus,
  penilaianKasus,
  teks,
} = require("../../utils/simrsBentuk");

const router = express.Router();

// Modul Konsultasi versi SIMRS — read-only, sama seperti versi dummy.
//
// Sumbernya medis.tb_konsul + medis.tb_konsul_jawab — kolomnya
// (diagnosis_kerja, konsul_yang_diminta, penemuan, anjuran, pengirim/tujuan)
// punya padanan langsung ke model Konsultasi.
//
// Hak aksesnya tetap `dokter_tujuan`, bukan DokterPasienAssignment: dokter
// melihat konsul yang DITUJUKAN kepadanya (sama dengan versi dummy).
//
// medis.tb_konsul.tujuan bernilai "1: Dokter, 2: SMF" — konsul yang
// dialamatkan ke SMF (bukan ke dokter tertentu) tidak akan muncul untuk siapa
// pun di sini karena `dokter_tujuan`-nya kosong. Pertanyaan terbuka buat DBA
// sebelum dipakai dokter beneran.

const STATUS_KONSULTASI = ["MENUNGGU_JAWABAN", "SUDAH_DIJAWAB"];
const PRIORITAS_KONSULTASI = ["BIASA", "CITO"];

function parseEnumFilter(query, key, daftar) {
  if (query[key] === undefined) return { errors: [] };
  if (!daftar.includes(query[key])) {
    return { errors: [`${key} harus salah satu dari: ${daftar.join(", ")}`] };
  }
  return { errors: [], nilai: query[key] };
}

function parseListQuery(query, role) {
  const errors = [];

  const status = parseEnumFilter(query, "status", STATUS_KONSULTASI);
  errors.push(...status.errors);

  const prioritas = parseEnumFilter(query, "prioritas", PRIORITAS_KONSULTASI);
  errors.push(...prioritas.errors);

  const pagination = parsePagination(query);
  errors.push(...pagination.errors);

  const rentang = parseRentangTanggal(query);
  errors.push(...rentang.errors);

  return {
    errors,
    values: {
      status: status.nilai,
      prioritas: prioritas.nilai,
      page: pagination.page,
      limit: pagination.limit,
      dokterId: parseDokterIdFilter(query, role),
      dari: rentang.dari,
      sampai: rentang.sampai,
    },
  };
}

// Rantai ke pasien lewat KUNJUNGAN, bukan `tk.nopen`: `medis.tb_konsul.nopen`
// kosong di 99,4% baris, sementara `tk.kunjungan` cocok di hampir semua baris
// (99,998%) — keduanya char(10) dan sama-sama masuk akal di atas kertas, jadi
// ini tidak kelihatan dari skema.
//
// Jadi: konsul -> kunjungan -> pendaftaran -> pasien. Urutan JOIN-nya penting,
// `pd` bergantung pada `k`.
const SUMBER = `
  FROM medis.tb_konsul tk
  LEFT JOIN medis.tb_konsul_jawab tj ON tj.id_konsul = tk.id AND tj.status <> 0
  LEFT JOIN pendaftaran.kunjungan k ON k.NOMOR = tk.kunjungan
  LEFT JOIN master.ruangan r ON r.ID = k.RUANGAN
  LEFT JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
  LEFT JOIN master.pasien pas ON pas.NORM = pd.NORM
  LEFT JOIN master.dokter dkp ON dkp.ID = tk.dokter_pengirim
  LEFT JOIN master.pegawai pgp ON pgp.NIP = dkp.NIP
`;

// FROM minimal khusus COUNT. Semua penyaring di modul ini cuma menyentuh `tk`,
// jadi enam LEFT JOIN di atas tidak memengaruhi hasil hitungan sama sekali —
// menyertakannya cuma menyuruh MySQL menggabung ratusan ribu baris untuk
// menghasilkan satu angka. Ini penyebab utama endpoint list terasa lambat.
const SUMBER_HITUNG = `FROM medis.tb_konsul tk`;

const KOLOM_RINGKAS = `
  tk.id, tk.tanggal, tk.cito, tk.status, tk.diagnosis_kerja,
  tj.tanggal AS TANGGAL_JAWAB,
  pas.NORM AS PASIEN_NORM, pas.NAMA AS PASIEN_NAMA,
  tk.dokter_pengirim, pgp.NAMA AS PENGIRIM_NAMA,
  r.JENIS_KUNJUNGAN
`;

function bangunFilter({ status, prioritas, dari, sampai, dokterTujuan }) {
  // status 0 = dibatalkan. Tidak punya padanan di StatusKonsultasi, jadi
  // disaring di sini — bukan ditampilkan dengan status yang salah.
  const klausa = ["tk.status <> 0"];
  const params = [];

  if (dokterTujuan) {
    klausa.push("tk.dokter_tujuan = ?");
    params.push(dokterTujuan);
  }

  if (status === "SUDAH_DIJAWAB") klausa.push("tk.status = 2");
  if (status === "MENUNGGU_JAWABAN") klausa.push("tk.status = 1");

  // cito: 799 = Biasa, 800 = Cito (komentar kolom). "Bukan 800" dipakai untuk
  // BIASA supaya baris dengan kode lain/NULL tetap ikut, sesuai prioritasKonsul.
  if (prioritas === "CITO") klausa.push("tk.cito = 800");
  if (prioritas === "BIASA") klausa.push("(tk.cito IS NULL OR tk.cito <> 800)");

  if (dari) {
    klausa.push("tk.tanggal >= ?");
    params.push(keWaktuSimrs(dari));
  }
  if (sampai) {
    klausa.push("tk.tanggal <= ?");
    params.push(keWaktuSimrs(sampai));
  }

  return { where: klausa.join(" AND "), params };
}

function bentukRingkas(b) {
  return {
    id: String(b.id),
    tanggalPermintaan: tanggalWIB(b.tanggal),
    prioritas: prioritasKonsul(b.cito),
    status: statusKonsul(b.status),
    diagnosisKerja: teks(b.diagnosis_kerja),
    tanggalJawaban: tanggalWIB(b.TANGGAL_JAWAB),
    pasien: b.PASIEN_NORM
      ? { id: String(b.PASIEN_NORM), nama: b.PASIEN_NAMA, norm: String(b.PASIEN_NORM) }
      : null,
    dokterPengirim: b.dokter_pengirim
      ? {
          id: String(b.dokter_pengirim),
          nama: b.PENGIRIM_NAMA ?? null,
          // SMF (spesialisasi) tersimpan sebagai kode di master.pegawai.SMF
          // dan tabel referensinya belum dipetakan — null lebih jujur daripada
          // memancarkan angka mentah ke layar.
          spesialisasi: null,
        }
      : null,
    jenisKunjungan: kategoriKunjungan(b.JENIS_KUNJUNGAN),
  };
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

  // dokterTujuan untuk DOKTER selalu dari JWT; `?dokterId=` cuma dihormati
  // untuk ADMIN, dan parseDokterIdFilter sudah membuangnya kalau pemanggilnya
  // DOKTER.
  const dokterUuid = role === "DOKTER" ? ownDokterId : values.dokterId;
  const dokterTujuan = dokterUuid ? await simrsDokterId(dokterUuid) : null;

  if (role === "DOKTER" && !dokterTujuan) {
    return res.status(403).json({ message: "Akun dokter ini tidak terdaftar di SIMRS" });
  }

  const { where, params } = bangunFilter({ ...values, dokterTujuan });
  const { page, limit } = values;
  const offset = (page - 1) * limit;

  const [hitung, baris] = await Promise.all([
    q(`SELECT COUNT(*) AS total ${SUMBER_HITUNG} WHERE ${where}`, params),
    q(
      `SELECT ${KOLOM_RINGKAS} ${SUMBER} WHERE ${where}
        ORDER BY tk.status ASC, tk.tanggal DESC
        LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
  ]);

  res.json({
    data: baris.map(bentukRingkas),
    pagination: {
      page,
      limit,
      total: Number(hitung[0]?.total ?? 0),
      totalPages: Math.ceil(Number(hitung[0]?.total ?? 0) / limit),
    },
  });
});

router.get("/:id", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;
  const id = Number(req.params.id);

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }
  if (!Number.isInteger(id)) {
    return res.status(404).json({ message: "Konsultasi tidak ditemukan" });
  }

  const baris = await q(
    `SELECT ${KOLOM_RINGKAS},
            tk.dokter_tujuan, tk.konsul_yang_diminta, tk.ikhtisar_klinis, tk.penilaian_kasus,
            tk.kunjungan AS NOKUN,
            pas.JENIS_KELAMIN AS PASIEN_JK, pas.TANGGAL_LAHIR AS PASIEN_LAHIR,
            pgt.NAMA AS TUJUAN_NAMA,
            tj.penemuan, tj.diagnosa AS DIAGNOSA_JAWAB, tj.anjuran, tj.persetujuan_kasus,
            k.MASUK AS KUNJUNGAN_MASUK, r.DESKRIPSI AS KUNJUNGAN_RUANGAN
       ${SUMBER}
       LEFT JOIN master.dokter dkt ON dkt.ID = tk.dokter_tujuan
       LEFT JOIN master.pegawai pgt ON pgt.NIP = dkt.NIP
      WHERE tk.id = ? AND tk.status <> 0
      LIMIT 1`,
    [id]
  );

  if (baris.length === 0) {
    return res.status(404).json({ message: "Konsultasi tidak ditemukan" });
  }

  const b = baris[0];

  // Tidak ada jalan lolos lewat akses pasien di sini: konsul yang ditujukan ke
  // dokter lain bukan urusan dokter ini, meski pasiennya sama. Sama persis
  // dengan versi dummy.
  if (role === "DOKTER") {
    const dokterTujuan = await simrsDokterId(ownDokterId);
    if (!dokterTujuan || Number(b.dokter_tujuan) !== dokterTujuan) {
      return res.status(403).json({ message: "Anda tidak memiliki akses ke konsultasi ini" });
    }
  }

  res.json({
    ...bentukRingkas(b),
    pasien: b.PASIEN_NORM
      ? {
          id: String(b.PASIEN_NORM),
          nama: b.PASIEN_NAMA,
          norm: String(b.PASIEN_NORM),
          jenisKelamin: jenisKelamin(b.PASIEN_JK),
          tanggalLahir: tanggalWIB(b.PASIEN_LAHIR),
        }
      : null,
    dokterTujuan: b.dokter_tujuan
      ? { id: String(b.dokter_tujuan), nama: b.TUJUAN_NAMA ?? null, spesialisasi: null }
      : null,
    konsulYangDiminta: teks(b.konsul_yang_diminta),

    // SIMRS menyimpan ikhtisar klinis sebagai SATU blok teks bebas
    // (tk.ikhtisar_klinis), sementara model SIDOKMAIS memecahnya jadi 8 field
    // bernama (kesadaran, tekananDarah, nadi, ...). Blok itu tidak bisa
    // dipecah dengan andal tanpa membaca isinya, jadi kedelapan field dikirim
    // null dan teks aslinya diteruskan apa adanya lewat `ikhtisarKlinis`.
    // Field tambahan aman: frontend mengabaikan key yang tidak dikenal.
    kesadaran: null,
    tekananDarah: null,
    nadi: null,
    pernapasan: null,
    suhu: null,
    tinggiBadan: null,
    beratBadan: null,
    nyeri: null,
    ikhtisarKlinis: teks(b.ikhtisar_klinis),

    penemuan: teks(b.penemuan),
    diagnosisJawaban: teks(b.DIAGNOSA_JAWAB),
    anjuran: teks(b.anjuran),
    setujuUntuk: persetujuanKasus(b.persetujuan_kasus),
    penilaianKasus: penilaianKasus(b.penilaian_kasus),

    kunjunganId: b.NOKUN ?? null,
    kunjungan: b.NOKUN
      ? {
          id: b.NOKUN,
          tanggalMasuk: tanggalWIB(b.KUNJUNGAN_MASUK),
          ruangan: {
            nama: teks(b.KUNJUNGAN_RUANGAN),
            jenis: b.JENIS_KUNJUNGAN === null ? null : ruanganJenis(b.JENIS_KUNJUNGAN),
          },
        }
      : null,
  });
});

module.exports = router;
