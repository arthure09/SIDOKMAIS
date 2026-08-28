const prisma = require("../lib/prisma");

// Audit log generik untuk semua write action. Gagal nulis ke AuditLog tidak
// boleh menggagalkan response utama ke client, jadi error di-catch & di-log
// ke console di sini, bukan dilempar ke caller.
async function logAudit({ actorId, actorRole, action, entityType, entityId, beforeData, afterData }) {
  try {
    await prisma.auditLog.create({
      data: { actorId, actorRole, action, entityType, entityId, beforeData, afterData },
    });
  } catch (err) {
    console.error("Gagal menulis AuditLog:", err);
  }
}

module.exports = { logAudit };
