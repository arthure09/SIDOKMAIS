const express = require("express");
const prisma = require("../lib/prisma");
const { logAudit } = require("../utils/auditLog");
const { parsePagination, parseDokterIdFilter } = require("../utils/queryParams");
const { sinkronkanPengingatOperasi } = require("../utils/pengingatJadwal");

const router = express.Router();

function parseListQuery(query, role) {
  const errors = [];

  let isRead;
  if (query.isRead !== undefined) {
    if (query.isRead !== "true" && query.isRead !== "false") {
      errors.push("isRead harus 'true' atau 'false'");
    } else {
      isRead = query.isRead === "true";
    }
  }

  const pagination = parsePagination(query);
  errors.push(...pagination.errors);

  const dokterId = parseDokterIdFilter(query, role);

  return { errors, values: { isRead, page: pagination.page, limit: pagination.limit, dokterId } };
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

  // Pengingat jadwal dibuat saat daftar dibaca, bukan oleh penjadwal terpisah.
  // Aplikasi ini tidak punya proses latar apa pun, dan menambah cron demi satu
  // fitur berarti satu proses lagi yang harus hidup supaya notifikasi muncul.
  // Pembuatannya idempoten dan direm 60 detik per dokter, jadi polling dari HP
  // tidak menghasilkan pekerjaan berulang.
  //
  // Kegagalannya TIDAK boleh menggagalkan pembacaan daftar: notifikasi lama
  // tetap harus tampil walau jadwal (SIMRS) sedang tidak bisa dihubungi. Pola
  // yang sama dipakai trigger notifikasi di operasi.routes.js.
  if (role === "DOKTER" && ownDokterId) {
    try {
      await sinkronkanPengingatOperasi(ownDokterId);
    } catch (err) {
      console.error("Gagal menyinkronkan pengingat jadwal:", err.code ?? err.message);
    }
  }

  const { isRead, page, limit, dokterId } = values;
  // DOKTER selalu dipaksa ke notifikasi miliknya sendiri. ADMIN melihat
  // notifikasi semua dokter, kecuali secara eksplisit filter lewat ?dokterId=.
  const effectiveDokterId = role === "DOKTER" ? ownDokterId : dokterId;

  const where = {
    ...(effectiveDokterId && { dokterId: effectiveDokterId }),
    ...(isRead !== undefined && { isRead }),
    // Yang sudah dibersihkan tidak pernah ikut ditampilkan. Barisnya tetap ada
    // di tabel — lihat catatan `dibersihkanPada` di schema.prisma.
    dibersihkanPada: null,
  };

  const [total, notifikasi] = await Promise.all([
    prisma.notifikasi.count({ where }),
    prisma.notifikasi.findMany({
      where,
      include: { dokter: { select: { id: true, nama: true } } },
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

// Tandai SEMUA notifikasi dokter ini jadi terbaca sekaligus.
//
// Ditaruh sebelum `/:id/read` bukan karena urutan route-nya bentrok (pola
// keduanya beda jumlah segmen), tapi supaya dua endpoint yang mengubah status
// baca duduk berdampingan waktu dibaca orang.
router.patch("/read-all", async (req, res) => {
  const { dokterId: ownDokterId } = req.user;

  if (!ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const where = { dokterId: ownDokterId, isRead: false, dibersihkanPada: null };
  const { count } = await prisma.notifikasi.updateMany({ where, data: { isRead: true } });

  // Satu baris audit untuk satu aksi, bukan satu per notifikasi: yang dilakukan
  // dokter memang satu tindakan. Jumlahnya dicatat supaya tetap bisa ditelusuri.
  if (count > 0) {
    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: "UPDATE",
      entityType: "Notifikasi",
      entityId: `semua:${ownDokterId}`,
      beforeData: { isRead: false, jumlah: count },
      afterData: { isRead: true, jumlah: count },
    });
  }

  res.json({ jumlah: count });
});

// Bersihkan daftar notifikasi dokter ini.
//
// SOFT DELETE, dan itu bukan selera: pembuat pengingat jadwal memakai
// keberadaan baris ber-`relatedId` sebagai tanda "pengingat untuk operasi ini
// sudah pernah dibuat". Kalau barisnya dihapus keras, pembacaan daftar
// berikutnya (paling lama 60 detik lagi) akan membuatnya kembali dan tombol
// Bersihkan terlihat rusak.
router.delete("/", async (req, res) => {
  const { dokterId: ownDokterId } = req.user;

  if (!ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const where = { dokterId: ownDokterId, dibersihkanPada: null };
  const { count } = await prisma.notifikasi.updateMany({
    where,
    data: { dibersihkanPada: new Date() },
  });

  if (count > 0) {
    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: "DELETE",
      entityType: "Notifikasi",
      entityId: `semua:${ownDokterId}`,
      beforeData: { jumlah: count },
      afterData: null,
    });
  }

  res.json({ jumlah: count });
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
  if (!before || before.dokterId !== ownDokterId || before.dibersihkanPada) {
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
