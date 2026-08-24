const express = require("express");
const prisma = require("../lib/prisma");
const { dokterPunyaAksesPasien } = require("../utils/aksesPasien");
const { parsePagination, parseRentangTanggal } = require("../utils/queryParams");

const router = express.Router();

function parseListQuery(query) {
  const errors = [];

  const pasienId = typeof query.pasienId === "string" ? query.pasienId.trim() : "";
  if (!pasienId) {
    errors.push("pasienId wajib diisi");
  }

  const pagination = parsePagination(query);
  errors.push(...pagination.errors);
  const { page, limit } = pagination;

  // Nama paramnya `dariTanggal`/`sampaiTanggal` di modul ini (bukan
  // `dari`/`sampai`) — lihat catatan timezone di utils/wib.js.
  const rentang = parseRentangTanggal(query, "dariTanggal", "sampaiTanggal");
  errors.push(...rentang.errors);

  return {
    errors,
    values: { pasienId, page, limit, dariTanggal: rentang.dari, sampaiTanggal: rentang.sampai },
  };
}

function toRingkasan(pemeriksaan) {
  return {
    id: pemeriksaan.id,
    kategori: pemeriksaan.kategori,
    namaPemeriksaan: pemeriksaan.namaPemeriksaan,
    laboratorium: pemeriksaan.laboratorium,
    status: pemeriksaan.status,
    tanggalPermintaan: pemeriksaan.tanggalPermintaan,
    tanggalHasil: pemeriksaan.tanggalHasil,
    jumlahParameter: pemeriksaan.hasilLabItem.length,
    // Jumlah, bukan boolean: daftar hasil lab dikelompokkan per tanggal di
    // frontend, dan "2 dari 11 di luar rujukan" jauh lebih berguna buat dokter
    // yang memindai daftar daripada sekadar penanda "ada yang abnormal".
    jumlahAbnormal: pemeriksaan.hasilLabItem.filter((item) => item.flag !== "NORMAL").length,
  };
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

  // Sama seperti pasien.routes.js GET /:id: tidak dibedakan "pasien tidak ada"
  // vs "bukan assignment kamu" — keduanya balik 403 supaya endpoint ini tidak
  // bocorin informasi soal pasienId mana yang valid.
  if (role === "DOKTER") {
    const punyaAkses = await dokterPunyaAksesPasien(ownDokterId, pasienId);
    if (!punyaAkses) {
      return res.status(403).json({ message: "Anda tidak memiliki akses ke data pasien ini" });
    }
  }

  // List Hasil Lab pasien cuma nampilin pemeriksaan yang laporannya memang
  // sudah ada (COMPLETED) — PENDING (belum ada hasil) dan CANCELLED (batal,
  // tidak akan pernah ada hasil) sama-sama dikeluarkan di sini supaya tidak
  // perlu status/badge apa pun lagi di UI; semua item yang tampil pasti bisa
  // dibuka.
  const where = { pasienId, status: "COMPLETED" };
  if (dariTanggal || sampaiTanggal) {
    where.tanggalPermintaan = {};
    if (dariTanggal) where.tanggalPermintaan.gte = dariTanggal;
    if (sampaiTanggal) where.tanggalPermintaan.lte = sampaiTanggal;
  }

  const [total, pemeriksaanList] = await Promise.all([
    prisma.pemeriksaanLab.count({ where }),
    prisma.pemeriksaanLab.findMany({
      where,
      include: { hasilLabItem: { select: { flag: true } } },
      orderBy: { tanggalPermintaan: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({
    data: pemeriksaanList.map(toRingkasan),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/lab/:id — detail satu PemeriksaanLab + seluruh HasilLabItem terkait.
router.get("/:id", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;
  const { id } = req.params;

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const pemeriksaan = await prisma.pemeriksaanLab.findUnique({
    where: { id },
    include: {
      pasien: { select: { id: true, nama: true, norm: true } },
      dokterPeminta: { select: { id: true, nama: true, spesialisasi: true } },
      hasilLabItem: {
        orderBy: { urutan: "asc" },
        select: {
          id: true,
          namaParameter: true,
          nilai: true,
          satuan: true,
          nilaiRujukan: true,
          flag: true,
          urutan: true,
        },
      },
    },
  });

  if (!pemeriksaan) {
    return res.status(404).json({ message: "Pemeriksaan lab tidak ditemukan" });
  }

  if (role === "DOKTER") {
    const punyaAkses = await dokterPunyaAksesPasien(ownDokterId, pemeriksaan.pasienId);
    if (!punyaAkses) {
      return res.status(403).json({ message: "Anda tidak memiliki akses ke data pemeriksaan lab ini" });
    }
  }

  const { hasilLabItem, ...pemeriksaanFields } = pemeriksaan;

  res.json({
    ...pemeriksaanFields,
    // Nullable dgn sengaja (bukan cuma array kosong) — belum dikonfirmasi
    // Mas Fauzi apakah SIMRS asli simpan hasil lab terstruktur per-parameter
    // atau cuma dokumen (PDF). Frontend WAJIB anggap ini bisa null.
    hasilLabItem: hasilLabItem.length > 0 ? hasilLabItem : null,
  });
});

module.exports = router;
