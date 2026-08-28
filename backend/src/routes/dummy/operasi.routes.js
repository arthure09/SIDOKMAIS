const express = require("express");
const prisma = require("../../lib/prisma");
const authorize = require("../../middleware/rbac.middleware");
const { logAudit } = require("../../utils/auditLog");
const { dokterPunyaAksesPasien } = require("../../utils/aksesPasien");
const { parsePagination, parseDokterIdFilter, parseRentangTanggal } = require("../../utils/queryParams");
const { OPERASI, KUNJUNGAN, terapkanStatusEfektif, whereStatusEfektif } = require("../../utils/statusJadwal");
const { parseLaporanBody, tanpaLaporan } = require("../../utils/laporanOperasi");

const router = express.Router();

const OPERASI_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

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

  const pagination = parsePagination(query);
  errors.push(...pagination.errors);

  const rentang = parseRentangTanggal(query);
  errors.push(...rentang.errors);

  const dokterId = parseDokterIdFilter(query, role);

  return {
    errors,
    values: {
      status,
      page: pagination.page,
      limit: pagination.limit,
      dokterId,
      dari: rentang.dari,
      sampai: rentang.sampai,
    },
  };
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

  const { status, page, limit, dokterId, dari, sampai } = values;

  // Klausa digabung lewat AND, bukan di-spread jadi satu objek: filter status
  // efektif dan filter dari/sampai sama-sama menulis `tanggalOperasi`, jadi
  // kalau di-spread yang belakangan menimpa yang duluan tanpa error. Pola sama
  // dengan kunjungan.routes.js, tempat bug itu benar-benar terjadi.
  const klausa = [];

  // Filter status menyeleksi berdasar status EFEKTIF (lihat utils/statusJadwal.js),
  // bukan status tersimpan — kalau tidak, record yang tampil "Selesai" karena
  // harinya sudah lewat malah tidak ikut waktu difilter "Selesai".
  if (status) klausa.push(whereStatusEfektif(status, OPERASI));
  if (dari) klausa.push({ tanggalOperasi: { gte: dari } });
  if (sampai) klausa.push({ tanggalOperasi: { lte: sampai } });

  if (role === "DOKTER") {
    // Dokter juga berhak lihat operasi pasien yang di-assign kepadanya
    // (DokterPasienAssignment), bukan cuma operasi yang kunjungan-nya
    // kebetulan tercatat dokterId dia secara langsung — lihat utils/aksesPasien.js.
    klausa.push({
      kunjungan: {
        OR: [
          { dokterId: ownDokterId },
          { pasien: { assignments: { some: { dokterId: ownDokterId } } } },
        ],
      },
    });
  } else if (dokterId) {
    klausa.push({ kunjungan: { dokterId } });
  }

  const where = klausa.length > 0 ? { AND: klausa } : {};

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
    data: operasi.map((o) => terapkanStatusEfektif(o, OPERASI)),
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

  // Field laporan operasi ikut lewat sini (ADMIN, mensimulasikan sync SIMRS).
  const laporan = parseLaporanBody(body);
  errors.push(...laporan.errors);
  Object.assign(data, laporan.data);

  return { errors, data };
}

// Bangun pesan notifikasi PERUBAHAN_JADWAL kalau `status` atau
// `tanggalOperasi` benar-benar berubah nilainya (bukan cuma dikirim di body
// dengan nilai yang sama). Return null kalau tidak ada perubahan yang relevan
// buat notifikasi dokter (mis. PATCH cuma ubah catatanPreOp).
function buildPerubahanJadwalPesan(before, after) {
  const bagian = [];

  if (after.status !== before.status) {
    bagian.push(`status diubah dari ${before.status} menjadi ${after.status}`);
  }
  if (after.tanggalOperasi.getTime() !== before.tanggalOperasi.getTime()) {
    bagian.push(`tanggal operasi diubah menjadi ${after.tanggalOperasi.toLocaleString("id-ID")}`);
  }

  if (bagian.length === 0) return null;
  return `Jadwal operasi Anda berubah: ${bagian.join("; ")}.`;
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

  // Notifikasi PERUBAHAN_JADWAL ditujukan ke dokter pemilik kunjungan, BUKAN
  // ke req.user — PATCH ini bisa dikerjakan ADMIN atas nama dokter lain,
  // jadi dokterId notifikasi selalu diambil dari relasi kunjungan. Kegagalan
  // di sini tidak boleh menggagalkan response utama PATCH ini, sama seperti
  // pola fault-tolerant di utils/auditLog.js.
  const pesanPerubahan = buildPerubahanJadwalPesan(before, after);
  if (pesanPerubahan) {
    try {
      const kunjungan = await prisma.kunjungan.findUnique({
        where: { id: before.kunjunganId },
        select: { dokterId: true },
      });
      if (kunjungan) {
        await prisma.notifikasi.create({
          data: {
            dokterId: kunjungan.dokterId,
            tipe: "PERUBAHAN_JADWAL",
            pesan: pesanPerubahan,
          },
        });
      }
    } catch (err) {
      console.error("Gagal membuat Notifikasi PERUBAHAN_JADWAL:", err);
    }
  }

  res.json(after);
});

router.delete("/:id", authorize("ADMIN"), async (req, res) => {
  const { id } = req.params;

  const before = await prisma.operasi.findUnique({ where: { id } });
  if (!before) {
    return res.status(404).json({ message: "Operasi tidak ditemukan" });
  }

  // Pendapatan tidak tergantung ke Operasi (satu baris jasa medis per
  // pelayanan, bukan turunan operasi), jadi Operasi tidak punya anak dan
  // tidak perlu penanganan constraint FK di sini.
  await prisma.operasi.delete({ where: { id } });

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

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  // `pendapatan` sengaja TIDAK di-include — data finansial per-operasi
  // (tarifTotal, jumlahDiterimaDokter) tidak dipakai frontend sama sekali di
  // layar detail operasi (DataPendapatanScreen masih murni mock terpisah),
  // jadi tidak perlu ikut ter-embed ke response endpoint ini.
  const operasi = await prisma.operasi.findUnique({
    where: { id },
    include: {
      kunjungan: {
        include: {
          pasien: { select: { id: true, nama: true, norm: true } },
          dokter: { select: { id: true, nama: true } },
          ruangan: { select: { nama: true } },
        },
      },
      ruangan: true,
    },
  });

  if (!operasi) {
    return res.status(404).json({ message: "Operasi tidak ditemukan" });
  }

  if (role === "DOKTER" && operasi.kunjungan.dokterId !== ownDokterId) {
    // Bukan dokter yang tercatat langsung di kunjungan operasi ini — masih
    // boleh lewat kalau dia di-assign ke pasiennya (lihat utils/aksesPasien.js).
    const punyaAkses = await dokterPunyaAksesPasien(ownDokterId, operasi.kunjungan.pasienId);
    if (!punyaAkses) {
      return res.status(403).json({ message: "Anda tidak memiliki akses ke data operasi ini" });
    }
  }

  // Kunjungan yang ter-embed ikut diturunkan statusnya — kalau tidak, layar
  // detail operasi bisa menampilkan konsultasi induknya "Terjadwal" padahal di
  // daftar Konsultasi record yang sama sudah tampil "Selesai".
  // Laporan lengkap hanya untuk operasi yang sudah selesai — dasarnya status
  // EFEKTIF, bukan yang tersimpan, supaya konsisten dengan status yang tampil
  // di layar (lihat utils/laporanOperasi.js).
  const efektif = terapkanStatusEfektif(operasi, OPERASI);
  const kunjunganEfektif = terapkanStatusEfektif(operasi.kunjungan, KUNJUNGAN);

  res.json({
    ...(efektif.status === "COMPLETED" ? efektif : tanpaLaporan(efektif)),
    // Bentuknya string polos (bukan objek {nama,jenis}) supaya cocok dengan
    // mode SIMRS — lihat routes/simrs/operasi.routes.js.
    kunjungan: { ...kunjunganEfektif, ruangan: kunjunganEfektif.ruangan?.nama ?? null },
  });
});

module.exports = router;
