const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// ASUMSI BELUM DIKONFIRMASI SUPERVISOR (Day 18, docs/prompts/prompts-day-21-18-19.md):
// akses hasil lab discope lewat DokterPasienAssignment, BUKAN kunjungan.dokterId.
// Alasan: pasien onkologi sering ditangani lintas dokter dan order lab kadang
// dibuat oleh dokter lain dari yang bertanggung jawab — kalau scoping pakai
// kunjungan.dokterId, dokter penanggung jawab pasien bisa kehilangan akses ke
// hasil lab pasiennya sendiri. Kalau supervisor mengoreksi, cari fungsi ini +
// pemanggilnya di bawah dan ganti sumber scoping-nya.
async function dokterPunyaAksesPasien(dokterId, pasienId) {
  const assignment = await prisma.dokterPasienAssignment.findFirst({
    where: { dokterId, pasienId },
  });
  return Boolean(assignment);
}

function parseListQuery(query) {
  const errors = [];

  const pasienId = typeof query.pasienId === "string" ? query.pasienId.trim() : "";
  if (!pasienId) {
    errors.push("pasienId wajib diisi");
  }

  let page = 1;
  if (query.page !== undefined) {
    page = Number(query.page);
    if (!Number.isInteger(page) || page < 1) {
      errors.push("page harus bilangan bulat >= 1");
    }
  }

  let limit = DEFAULT_LIMIT;
  if (query.limit !== undefined) {
    limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      errors.push(`limit harus bilangan bulat antara 1 dan ${MAX_LIMIT}`);
    }
  }

  return { errors, values: { pasienId, page, limit } };
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
    adaFlagAbnormal: pemeriksaan.hasilLabItem.some((item) => item.flag !== "NORMAL"),
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

  const { pasienId, page, limit } = values;

  // Sama seperti pasien.routes.js GET /:id: tidak dibedakan "pasien tidak ada"
  // vs "bukan assignment kamu" — keduanya balik 403 supaya endpoint ini tidak
  // bocorin informasi soal pasienId mana yang valid.
  if (role === "DOKTER") {
    const punyaAkses = await dokterPunyaAksesPasien(ownDokterId, pasienId);
    if (!punyaAkses) {
      return res.status(403).json({ message: "Anda tidak memiliki akses ke data pasien ini" });
    }
  }

  const where = { pasienId };

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
