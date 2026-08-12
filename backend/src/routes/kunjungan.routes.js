const express = require("express");
const prisma = require("../lib/prisma");
const { dokterPunyaAksesPasien } = require("../utils/aksesPasien");
const { parsePagination, parseDokterIdFilter } = require("../utils/queryParams");

const router = express.Router();

// Modul Konsul: read-only untuk kedua role (Kunjungan mensimulasikan sync
// dari SIMRS, sama seperti Operasi — lihat CLAUDE.md Aturan #1). Belum ada
// endpoint write di sini karena belum ada kebutuhan admin buat input manual;
// data selalu datang dari seed/simulasi sync.
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

  const dokterId = parseDokterIdFilter(query, role);

  return { errors, values: { status, page: pagination.page, limit: pagination.limit, dokterId } };
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

  const { status, page, limit, dokterId } = values;

  const where = {
    ...(status && { statusKunjungan: status }),
  };

  if (role === "DOKTER") {
    // Dokter juga berhak lihat kunjungan pasien yang di-assign kepadanya
    // (DokterPasienAssignment), bukan cuma kunjungan yang kebetulan tercatat
    // dokterId dia secara langsung — lihat utils/aksesPasien.js.
    where.OR = [
      { dokterId: ownDokterId },
      { pasien: { assignments: { some: { dokterId: ownDokterId } } } },
    ];
  } else if (dokterId) {
    where.dokterId = dokterId;
  }

  const [total, kunjungan] = await Promise.all([
    prisma.kunjungan.count({ where }),
    prisma.kunjungan.findMany({
      where,
      select: {
        id: true,
        tanggalMasuk: true,
        tanggalKeluar: true,
        diagnosa: true,
        statusKunjungan: true,
        isPasienBaru: true,
        ruangan: { select: { nama: true, jenis: true } },
        pasien: { select: { id: true, nama: true, norm: true } },
        dokter: { select: { id: true, nama: true } },
      },
      orderBy: { tanggalMasuk: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({
    data: kunjungan,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

router.get("/:id", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;
  const { id } = req.params;

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const kunjungan = await prisma.kunjungan.findUnique({
    where: { id },
    include: {
      pasien: true,
      dokter: { select: { id: true, nama: true, spesialisasi: true } },
      ruangan: true,
      operasi: { select: { id: true, status: true, tanggalOperasi: true } },
    },
  });

  if (!kunjungan) {
    return res.status(404).json({ message: "Kunjungan tidak ditemukan" });
  }

  if (role === "DOKTER" && kunjungan.dokterId !== ownDokterId) {
    // Bukan dokter yang tercatat langsung di kunjungan ini — masih boleh
    // lewat kalau dia di-assign ke pasiennya (lihat utils/aksesPasien.js).
    const punyaAkses = await dokterPunyaAksesPasien(ownDokterId, kunjungan.pasienId);
    if (!punyaAkses) {
      return res.status(403).json({ message: "Anda tidak memiliki akses ke data kunjungan ini" });
    }
  }

  res.json(kunjungan);
});

module.exports = router;
