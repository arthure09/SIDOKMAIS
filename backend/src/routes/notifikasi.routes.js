const express = require("express");
const prisma = require("../lib/prisma");
const { logAudit } = require("../utils/auditLog");

const router = express.Router();

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// Parsing & validasi query params list notifikasi. Tidak ada filter dokterId
// di sini sama sekali (beda dari pasien/operasi routes) — notifikasi ini
// murni milik dokter yang login, tidak ada mode lintas-dokter untuk ADMIN.
function parseListQuery(query) {
  const errors = [];

  let isRead;
  if (query.isRead !== undefined) {
    if (query.isRead !== "true" && query.isRead !== "false") {
      errors.push("isRead harus 'true' atau 'false'");
    } else {
      isRead = query.isRead === "true";
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

  return { errors, values: { isRead, page, limit } };
}

router.get("/", async (req, res) => {
  const { dokterId: ownDokterId } = req.user;

  if (!ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const { errors, values } = parseListQuery(req.query);
  if (errors.length > 0) {
    return res.status(400).json({ message: "Query params tidak valid", errors });
  }

  const { isRead, page, limit } = values;

  const where = {
    dokterId: ownDokterId,
    ...(isRead !== undefined && { isRead }),
  };

  const [total, notifikasi] = await Promise.all([
    prisma.notifikasi.count({ where }),
    prisma.notifikasi.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({
    data: notifikasi,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Tandai satu notifikasi jadi terbaca. Notifikasi yang eksis tapi bukan
// milik dokter yang login sengaja dibalikin 404 (bukan 403) — samain dengan
// "tidak ada" supaya endpoint ini tidak bocorin informasi bahwa suatu ID
// notifikasi valid tapi kepunyaan dokter lain.
router.patch("/:id/read", async (req, res) => {
  const { dokterId: ownDokterId } = req.user;
  const { id } = req.params;

  if (!ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const before = await prisma.notifikasi.findUnique({ where: { id } });
  if (!before || before.dokterId !== ownDokterId) {
    return res.status(404).json({ message: "Notifikasi tidak ditemukan" });
  }

  const after = await prisma.notifikasi.update({
    where: { id },
    data: { isRead: true },
  });

  // Keputusan audit log (catch-up Hari 12-13, docs/prompts/hari-12-13-notifikasi.md):
  // mark-as-read TETAP dicatat ke AuditLog, mengikuti aturan #4 CLAUDE.md
  // ("semua write action") apa adanya alih-alih di-exclude sebagai "terlalu
  // low-stakes". Biayanya murah (1 row per aksi) dan menjaga endpoint ini
  // konsisten dengan pola write lain di aplikasi — termasuk untuk dipakai
  // ulang oleh chatbot nanti yang wajib audit tiap write (CLAUDE.md aturan #5).
  await logAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: "UPDATE",
    entityType: "Notifikasi",
    entityId: id,
    beforeData: before,
    afterData: after,
  });

  res.json(after);
});

module.exports = router;
