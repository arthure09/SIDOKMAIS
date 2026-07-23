const express = require("express");
const { Prisma } = require("@prisma/client");
const prisma = require("../lib/prisma");
const authorize = require("../middleware/rbac.middleware");
const { logAudit } = require("../utils/auditLog");

const router = express.Router();

const OPERASI_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// Parsing & validasi query params list operasi. `dokterId` cuma diterima
// kalau role ADMIN (dipakai buat filter lintas dokter) — DOKTER tidak pernah
// boleh nge-override filter kepemilikannya sendiri lewat query.
function parseListQuery(query, role) {
  const errors = [];

  let status;
  if (query.status !== undefined) {
    if (!OPERASI_STATUSES.includes(query.status)) {
      errors.push(`status harus salah satu dari: ${OPERASI_STATUSES.join(", ")}`);
    } else {
      status = query.status;
    }
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

  let dokterId;
  if (role === "ADMIN" && typeof query.dokterId === "string" && query.dokterId.trim() !== "") {
    dokterId = query.dokterId.trim();
  }

  return { errors, values: { status, page, limit, dokterId } };
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
  const kunjunganDokterId = role === "DOKTER" ? ownDokterId : dokterId;

  const where = {
    ...(status && { status }),
    ...(kunjunganDokterId && { kunjungan: { dokterId: kunjunganDokterId } }),
  };

  const [total, operasi] = await Promise.all([
    prisma.operasi.count({ where }),
    prisma.operasi.findMany({
      where,
      select: {
        id: true,
        tanggalOperasi: true,
        jenisTindakan: true,
        status: true,
        ruangan: { select: { nama: true, jenis: true } },
        kunjungan: {
          select: {
            dokterId: true,
            dokter: { select: { nama: true } },
            pasien: { select: { nama: true, norm: true } },
          },
        },
      },
      orderBy: { tanggalOperasi: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({
    data: operasi,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

function validateCreateBody(body) {
  const errors = [];

  if (typeof body.kunjunganId !== "string" || !body.kunjunganId.trim()) {
    errors.push("kunjunganId wajib diisi");
  }
  if (typeof body.ruanganId !== "string" || !body.ruanganId.trim()) {
    errors.push("ruanganId wajib diisi");
  }
  if (typeof body.jenisTindakan !== "string" || !body.jenisTindakan.trim()) {
    errors.push("jenisTindakan wajib diisi");
  }
  if (
    !Array.isArray(body.tim) ||
    body.tim.length === 0 ||
    !body.tim.every((t) => typeof t === "string" && t.trim())
  ) {
    errors.push("tim wajib berupa array nama (minimal 1)");
  }

  let tanggalOperasi;
  if (typeof body.tanggalOperasi !== "string" || Number.isNaN(Date.parse(body.tanggalOperasi))) {
    errors.push("tanggalOperasi wajib berupa tanggal ISO yang valid");
  } else {
    tanggalOperasi = new Date(body.tanggalOperasi);
  }

  if (body.catatanPreOp !== undefined && typeof body.catatanPreOp !== "string") {
    errors.push("catatanPreOp harus string");
  }

  return { errors, tanggalOperasi };
}

function validatePatchBody(body) {
  const errors = [];
  const data = {};

  if (body.ruanganId !== undefined) {
    if (typeof body.ruanganId !== "string" || !body.ruanganId.trim()) {
      errors.push("ruanganId harus string");
    } else {
      data.ruanganId = body.ruanganId;
    }
  }

  if (body.tanggalOperasi !== undefined) {
    if (typeof body.tanggalOperasi !== "string" || Number.isNaN(Date.parse(body.tanggalOperasi))) {
      errors.push("tanggalOperasi harus tanggal ISO yang valid");
    } else {
      data.tanggalOperasi = new Date(body.tanggalOperasi);
    }
  }

  if (body.jenisTindakan !== undefined) {
    if (typeof body.jenisTindakan !== "string" || !body.jenisTindakan.trim()) {
      errors.push("jenisTindakan harus string");
    } else {
      data.jenisTindakan = body.jenisTindakan.trim();
    }
  }

  if (body.tim !== undefined) {
    if (!Array.isArray(body.tim) || !body.tim.every((t) => typeof t === "string" && t.trim())) {
      errors.push("tim harus array nama");
    } else {
      data.tim = body.tim.map((t) => t.trim());
    }
  }

  if (body.status !== undefined) {
    if (!OPERASI_STATUSES.includes(body.status)) {
      errors.push(`status harus salah satu dari: ${OPERASI_STATUSES.join(", ")}`);
    } else {
      data.status = body.status;
    }
  }

  if (body.catatanPreOp !== undefined) {
    if (typeof body.catatanPreOp !== "string") {
      errors.push("catatanPreOp harus string");
    } else {
      data.catatanPreOp = body.catatanPreOp;
    }
  }

  if (body.catatanPostOp !== undefined) {
    if (typeof body.catatanPostOp !== "string") {
      errors.push("catatanPostOp harus string");
    } else {
      data.catatanPostOp = body.catatanPostOp;
    }
  }

  return { errors, data };
}

router.post("/", authorize("ADMIN"), async (req, res) => {
  const { errors, tanggalOperasi } = validateCreateBody(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: "Body tidak valid", errors });
  }

  const { kunjunganId, ruanganId, jenisTindakan, tim, catatanPreOp } = req.body;

  const [kunjungan, ruangan] = await Promise.all([
    prisma.kunjungan.findUnique({ where: { id: kunjunganId } }),
    prisma.ruangan.findUnique({ where: { id: ruanganId } }),
  ]);

  if (!kunjungan) {
    return res.status(400).json({ message: "kunjunganId tidak ditemukan" });
  }
  if (!ruangan) {
    return res.status(400).json({ message: "ruanganId tidak ditemukan" });
  }

  const created = await prisma.operasi.create({
    data: {
      kunjunganId,
      ruanganId,
      tanggalOperasi,
      jenisTindakan: jenisTindakan.trim(),
      tim: tim.map((t) => t.trim()),
      catatanPreOp: catatanPreOp ?? null,
    },
  });

  await logAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: "CREATE",
    entityType: "Operasi",
    entityId: created.id,
    beforeData: null,
    afterData: created,
  });

  res.status(201).json(created);
});

router.patch("/:id", authorize("ADMIN"), async (req, res) => {
  const { id } = req.params;

  const before = await prisma.operasi.findUnique({ where: { id } });
  if (!before) {
    return res.status(404).json({ message: "Operasi tidak ditemukan" });
  }

  const { errors, data } = validatePatchBody(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: "Body tidak valid", errors });
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "Tidak ada field yang diupdate" });
  }

  if (data.ruanganId) {
    const ruangan = await prisma.ruangan.findUnique({ where: { id: data.ruanganId } });
    if (!ruangan) {
      return res.status(400).json({ message: "ruanganId tidak ditemukan" });
    }
  }

  const after = await prisma.operasi.update({ where: { id }, data });

  await logAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: "UPDATE",
    entityType: "Operasi",
    entityId: id,
    beforeData: before,
    afterData: after,
  });

  res.json(after);
});

router.delete("/:id", authorize("ADMIN"), async (req, res) => {
  const { id } = req.params;

  const before = await prisma.operasi.findUnique({ where: { id } });
  if (!before) {
    return res.status(404).json({ message: "Operasi tidak ditemukan" });
  }

  try {
    await prisma.operasi.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return res.status(409).json({
        message: "Operasi tidak bisa dihapus, ada data pendapatan terkait",
      });
    }
    throw err;
  }

  await logAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: "DELETE",
    entityType: "Operasi",
    entityId: id,
    beforeData: before,
    afterData: null,
  });

  res.status(204).send();
});

router.get("/:id", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;
  const { id } = req.params;

  const operasi = await prisma.operasi.findUnique({
    where: { id },
    include: {
      kunjungan: {
        include: {
          pasien: { select: { id: true, nama: true, norm: true } },
          dokter: { select: { id: true, nama: true } },
        },
      },
      ruangan: true,
      pendapatan: true,
    },
  });

  if (!operasi) {
    return res.status(404).json({ message: "Operasi tidak ditemukan" });
  }

  if (role === "DOKTER" && operasi.kunjungan.dokterId !== ownDokterId) {
    return res.status(403).json({ message: "Anda tidak memiliki akses ke data operasi ini" });
  }

  res.json(operasi);
});

module.exports = router;
