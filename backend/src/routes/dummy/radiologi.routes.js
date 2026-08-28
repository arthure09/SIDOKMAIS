const express = require("express");
const prisma = require("../../lib/prisma");
const { dokterPunyaAksesPasien } = require("../../utils/aksesPasien");
const { parsePagination, parseRentangTanggal } = require("../../utils/queryParams");

const router = express.Router();

// Modul Radiologi — bentuknya sengaja BEDA dari Lab. Hasil lab terstruktur per
// parameter, hasil radiologi berupa narasi satu laporan per pemeriksaan, jadi
// tidak ada endpoint item dan tidak ada pengelompokan per tanggal di frontend.
//
// Sama seperti Lab: `pasienId` wajib, tidak ada jalur "semua radiologi dokter
// ini". Itu sekaligus yang menjaga tiap query terbatas ke satu pasien.

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

function toRingkasan(p) {
  return {
    id: p.id,
    modalitas: p.modalitas,
    namaPemeriksaan: p.namaPemeriksaan,
    unit: p.unit,
    cito: p.cito,
    tanggalPermintaan: p.tanggalPermintaan,
    tanggalHasil: p.tanggalHasil,
    // Cuma penanda ada/tidaknya, bukan isinya: daftar tidak perlu memuat narasi
    // 600 karakter kali sekian baris.
    adaKesan: Boolean(p.kesan && p.kesan.trim()),
  };
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

  // "Pasien tidak ada" dan "bukan pasien Anda" sama-sama 403 — supaya endpoint
  // ini tidak jadi cara menebak pasienId mana yang valid.
  if (role === "DOKTER") {
    const punyaAkses = await dokterPunyaAksesPasien(ownDokterId, pasienId);
    if (!punyaAkses) {
      return res.status(403).json({ message: "Anda tidak memiliki akses ke data pasien ini" });
    }
  }

  const where = { pasienId };
  if (dariTanggal || sampaiTanggal) {
    where.tanggalPermintaan = {};
    if (dariTanggal) where.tanggalPermintaan.gte = dariTanggal;
    if (sampaiTanggal) where.tanggalPermintaan.lte = sampaiTanggal;
  }

  const [total, daftar] = await Promise.all([
    prisma.pemeriksaanRadiologi.count({ where }),
    prisma.pemeriksaanRadiologi.findMany({
      where,
      orderBy: { tanggalPermintaan: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({
    data: daftar.map(toRingkasan),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /api/radiologi/:id — satu laporan radiologi lengkap dengan narasinya.
router.get("/:id", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const pemeriksaan = await prisma.pemeriksaanRadiologi.findUnique({
    where: { id: req.params.id },
    include: {
      pasien: { select: { id: true, nama: true, norm: true } },
      dokterPeminta: { select: { id: true, nama: true, spesialisasi: true } },
      dokterPembaca: { select: { id: true, nama: true, spesialisasi: true } },
    },
  });

  if (!pemeriksaan) {
    return res.status(404).json({ message: "Pemeriksaan radiologi tidak ditemukan" });
  }

  if (role === "DOKTER") {
    const punyaAkses = await dokterPunyaAksesPasien(ownDokterId, pemeriksaan.pasienId);
    if (!punyaAkses) {
      return res
        .status(403)
        .json({ message: "Anda tidak memiliki akses ke data pemeriksaan radiologi ini" });
    }
  }

  res.json(pemeriksaan);
});

module.exports = router;
