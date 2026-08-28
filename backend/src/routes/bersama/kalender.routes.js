const express = require("express");
const prisma = require("../../lib/prisma");
const { logAudit } = require("../../utils/auditLog");
const { rentangHariWIB } = require("../../utils/wib");
const { parseRentangTanggal } = require("../../utils/queryParams");

const router = express.Router();

const TIPE_CATATAN = ["REMINDER", "BLOCKING", "PRIBADI"];
const WAKTU_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

// `dari`/`sampai` dikirim frontend sebagai "YYYY-MM-DD" (tanggal kalender
// lokal device, WIB) — lihat utils/wib.js.
function parseListQuery(query) {
  const rentang = parseRentangTanggal(query);
  return { errors: rentang.errors, values: { dari: rentang.dari, sampai: rentang.sampai } };
}

function validateBody(body, { partial }) {
  const errors = [];
  const data = {};

  if (!partial || body.tanggal !== undefined) {
    const parsed = typeof body.tanggal === "string" ? Date.parse(body.tanggal) : NaN;
    if (Number.isNaN(parsed)) {
      errors.push("tanggal wajib berupa tanggal ISO yang valid");
    } else {
      // Dinormalisasi ke tengah malam WIB (bukan instant apa adanya) supaya
      // konsisten dibandingkan dengan rentang dari/sampai di parseListQuery.
      data.tanggal = rentangHariWIB(new Date(parsed)).mulai;
    }
  }

  if (body.waktu !== undefined) {
    if (body.waktu !== null && (typeof body.waktu !== "string" || !WAKTU_REGEX.test(body.waktu))) {
      errors.push("waktu harus format 'HH:mm' atau null");
    } else {
      data.waktu = body.waktu;
    }
  }

  if (!partial || body.judul !== undefined) {
    if (typeof body.judul !== "string" || !body.judul.trim()) {
      errors.push("judul wajib diisi");
    } else {
      data.judul = body.judul.trim();
    }
  }

  if (body.catatan !== undefined) {
    if (body.catatan !== null && typeof body.catatan !== "string") {
      errors.push("catatan harus string atau null");
    } else {
      data.catatan = body.catatan;
    }
  }

  if (!partial || body.tipe !== undefined) {
    if (!TIPE_CATATAN.includes(body.tipe)) {
      errors.push(`tipe harus salah satu dari: ${TIPE_CATATAN.join(", ")}`);
    } else {
      data.tipe = body.tipe;
    }
  }

  return { errors, data };
}

// GET /api/kalender?dari=&sampai= — catatan kalender pribadi dokter yang
// login, discope dokterId dari JWT. ADMIN tidak terikat ke satu Dokter
// (kalender pribadi "milik siapa" tidak masuk akal buat akun itu) — pola
// respons sama seperti branch ADMIN di dashboard.routes.js: balikin bentuk
// yang masuk akal (list kosong + catatan), bukan crash atau data lintas-dokter.
router.get("/", async (req, res) => {
  const { role, dokterId } = req.user;

  if (role === "ADMIN") {
    return res.json({
      data: [],
      adminCatatan: "Akun ADMIN tidak terikat ke satu Dokter, jadi tidak ada kalender pribadi untuk akun ini.",
    });
  }

  if (!dokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const { errors, values } = parseListQuery(req.query);
  if (errors.length > 0) {
    return res.status(400).json({ message: "Query params tidak valid", errors });
  }

  const { dari, sampai } = values;
  const where = { dokterId };
  if (dari || sampai) {
    where.tanggal = {};
    if (dari) where.tanggal.gte = dari;
    if (sampai) where.tanggal.lte = sampai;
  }

  const data = await prisma.catatanKalender.findMany({
    where,
    orderBy: [{ tanggal: "asc" }, { waktu: "asc" }],
  });

  res.json({ data });
});

router.post("/", async (req, res) => {
  const { role, dokterId } = req.user;

  if (role === "ADMIN") {
    return res.status(403).json({ message: "Kalender pribadi hanya berlaku untuk akun dokter" });
  }
  if (!dokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const { errors, data } = validateBody(req.body, { partial: false });
  if (errors.length > 0) {
    return res.status(400).json({ message: "Body tidak valid", errors });
  }

  const created = await prisma.catatanKalender.create({
    data: { ...data, dokterId },
  });

  await logAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: "CREATE",
    entityType: "CatatanKalender",
    entityId: created.id,
    beforeData: null,
    afterData: created,
  });

  res.status(201).json(created);
});

// Catatan yang eksis tapi bukan milik dokter yang login sengaja dibalikin
// 404 (bukan 403) — pola sama persis dengan notifikasi.routes.js PATCH
// /:id/read, kasus paling mirip (data milik dokter sendiri, bukan data
// pasien lintas-dokter) supaya endpoint ini tidak bocorin ID valid.
router.patch("/:id", async (req, res) => {
  const { role, dokterId } = req.user;
  const { id } = req.params;

  if (role === "ADMIN") {
    return res.status(403).json({ message: "Kalender pribadi hanya berlaku untuk akun dokter" });
  }
  if (!dokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const before = await prisma.catatanKalender.findUnique({ where: { id } });
  if (!before || before.dokterId !== dokterId) {
    return res.status(404).json({ message: "Catatan kalender tidak ditemukan" });
  }

  const { errors, data } = validateBody(req.body, { partial: true });
  if (errors.length > 0) {
    return res.status(400).json({ message: "Body tidak valid", errors });
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "Tidak ada field yang diupdate" });
  }

  const after = await prisma.catatanKalender.update({ where: { id }, data });

  await logAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: "UPDATE",
    entityType: "CatatanKalender",
    entityId: id,
    beforeData: before,
    afterData: after,
  });

  res.json(after);
});

router.delete("/:id", async (req, res) => {
  const { role, dokterId } = req.user;
  const { id } = req.params;

  if (role === "ADMIN") {
    return res.status(403).json({ message: "Kalender pribadi hanya berlaku untuk akun dokter" });
  }
  if (!dokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const before = await prisma.catatanKalender.findUnique({ where: { id } });
  if (!before || before.dokterId !== dokterId) {
    return res.status(404).json({ message: "Catatan kalender tidak ditemukan" });
  }

  await prisma.catatanKalender.delete({ where: { id } });

  await logAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: "DELETE",
    entityType: "CatatanKalender",
    entityId: id,
    beforeData: before,
    afterData: null,
  });

  res.status(204).send();
});

module.exports = router;
