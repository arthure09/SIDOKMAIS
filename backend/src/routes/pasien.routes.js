const express = require("express");
const prisma = require("../lib/prisma");
const { parsePagination, parseDokterIdFilter } = require("../utils/queryParams");

const router = express.Router();

const ASSIGNMENT_STATUSES = ["ACTIVE", "COMPLETED"];

// Parsing & validasi query params list pasien. Return { errors, values } —
// errors non-kosong berarti request tidak valid (caller balikin 400).
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

  const pagination = parsePagination(query);
  errors.push(...pagination.errors);

  const dokterId = parseDokterIdFilter(query, role);

  return { errors, values: { search, status, page: pagination.page, limit: pagination.limit, dokterId } };
}

// Untuk daftar pasienId, ambil kunjungan terakhir (tanggalMasuk <= now, paling
// baru) dan kunjungan berikutnya (tanggalMasuk > now, paling dekat) per pasien.
// Dilakukan lewat dua query + reduce di JS, bukan nested `include.take`, karena
// Prisma tidak menjamin `take` per-parent yang benar untuk relasi to-many di
// dalam findMany.
async function getKunjunganTerdekat(pasienIds) {
  const terakhirMap = new Map();
  const berikutnyaMap = new Map();

  if (pasienIds.length === 0) {
    return { terakhirMap, berikutnyaMap };
  }

  const now = new Date();

  const [terakhirList, berikutnyaList] = await Promise.all([
    prisma.kunjungan.findMany({
      where: { pasienId: { in: pasienIds }, tanggalMasuk: { lte: now } },
      orderBy: { tanggalMasuk: "desc" },
      select: { pasienId: true, tanggalMasuk: true, diagnosa: true },
    }),
    prisma.kunjungan.findMany({
      where: { pasienId: { in: pasienIds }, tanggalMasuk: { gt: now } },
      orderBy: { tanggalMasuk: "asc" },
      select: { pasienId: true, tanggalMasuk: true },
    }),
  ]);

  for (const k of terakhirList) {
    if (!terakhirMap.has(k.pasienId)) terakhirMap.set(k.pasienId, k);
  }
  for (const k of berikutnyaList) {
    if (!berikutnyaMap.has(k.pasienId)) berikutnyaMap.set(k.pasienId, k);
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

  const { search, status, page, limit, dokterId } = values;
  // DOKTER selalu dipaksa ke assignment miliknya sendiri. ADMIN melihat semua
  // pasien lintas dokter, kecuali secara eksplisit filter lewat ?dokterId=.
  const assignmentDokterId = role === "DOKTER" ? ownDokterId : dokterId;

  const where = {
    ...(assignmentDokterId && { dokterId: assignmentDokterId }),
    ...(status && { status }),
    ...(search && {
      pasien: {
        OR: [
          { nama: { contains: search, mode: "insensitive" } },
          { norm: { contains: search, mode: "insensitive" } },
        ],
      },
    }),
  };

  const [total, assignments] = await Promise.all([
    prisma.dokterPasienAssignment.count({ where }),
    prisma.dokterPasienAssignment.findMany({
      where,
      include: { pasien: true },
      orderBy: { pasien: { nama: "asc" } },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const pasienIds = assignments.map((a) => a.pasienId);
  const { terakhirMap, berikutnyaMap } = await getKunjunganTerdekat(pasienIds);

  const data = assignments.map((a) => {
    const kunjunganTerakhir = terakhirMap.get(a.pasienId);
    const kunjunganBerikutnya = berikutnyaMap.get(a.pasienId);

    return {
      id: a.pasien.id,
      norm: a.pasien.norm,
      nama: a.pasien.nama,
      status: a.status,
      diagnosaSingkat: kunjunganTerakhir?.diagnosa ?? null,
      tanggalKunjunganTerakhir: kunjunganTerakhir?.tanggalMasuk ?? null,
      tanggalKunjunganBerikutnya: kunjunganBerikutnya?.tanggalMasuk ?? null,
    };
  });

  res.json({
    data,
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

  // DOKTER cuma boleh lihat pasien yang di-assign ke dirinya. ADMIN boleh
  // lihat pasien manapun — assignment yang dipakai buat field `assignment`
  // di response diambil dari assignment terbaru pasien ini, dokter manapun.
  const assignment = await prisma.dokterPasienAssignment.findFirst({
    where: role === "DOKTER" ? { dokterId: ownDokterId, pasienId: id } : { pasienId: id },
    orderBy: { tanggalAssign: "desc" },
  });

  if (!assignment) {
    return res.status(403).json({ message: "Anda tidak memiliki akses ke data pasien ini" });
  }

  const pasien = await prisma.pasien.findUnique({
    where: { id },
    include: {
      kunjungan: {
        orderBy: { tanggalMasuk: "desc" },
        include: {
          ruangan: { select: { nama: true, jenis: true } },
          dokter: { select: { nama: true } },
        },
      },
    },
  });

  const { kunjungan, ...pasienFields } = pasien;

  res.json({
    ...pasienFields,
    assignment: {
      id: assignment.id,
      status: assignment.status,
      tanggalAssign: assignment.tanggalAssign,
    },
    riwayatKunjungan: kunjungan.map((k) => ({
      id: k.id,
      tanggalMasuk: k.tanggalMasuk,
      tanggalKeluar: k.tanggalKeluar,
      diagnosa: k.diagnosa,
      statusKunjungan: k.statusKunjungan,
      isPasienBaru: k.isPasienBaru,
      ruangan: k.ruangan,
      dokter: k.dokter,
    })),
  });
});

module.exports = router;
