const express = require("express");
const prisma = require("../lib/prisma");
const { parsePagination, parseDokterIdFilter, parseRentangTanggal } = require("../utils/queryParams");
const { jenisKunjungan } = require("../utils/jenisKunjungan");

const router = express.Router();

// Modul Konsultasi: read-only untuk kedua role (surat konsul mensimulasikan sync
// dari SIMRS, sama seperti Operasi & Kunjungan — CLAUDE.md Aturan #1).
//
// PENTING — hak aksesnya BEDA dari modul lain. Pasien/lab pakai
// DokterPasienAssignment; di sini pakai `dokterTujuanId` yang tercatat di
// record itu sendiri. Konsekuensinya disengaja: dokter melihat konsul yang
// DITUJUKAN kepadanya, bukan yang dia ajukan, dan bukan pula semua konsul
// pasien yang di-assign kepadanya. Lihat docs/rencana-revisi-modul-dokter.md
// Tahap 2 (keputusan terkunci).
const STATUS_KONSULTASI = ["MENUNGGU_JAWABAN", "SUDAH_DIJAWAB"];
const PRIORITAS_KONSULTASI = ["BIASA", "CITO"];

// Ringkasan kartu list. Detail memakai include-nya sendiri di bawah.
const LIST_SELECT = {
  id: true,
  tanggalPermintaan: true,
  prioritas: true,
  status: true,
  diagnosisKerja: true,
  tanggalJawaban: true,
  pasien: { select: { id: true, nama: true, norm: true } },
  dokterPengirim: { select: { id: true, nama: true, spesialisasi: true } },
  kunjungan: { select: { ruangan: { select: { jenis: true } } } },
};

function parseEnumFilter(query, key, daftar) {
  if (query[key] === undefined) return { errors: [] };
  if (!daftar.includes(query[key])) {
    return { errors: [`${key} harus salah satu dari: ${daftar.join(", ")}`] };
  }
  return { errors: [], nilai: query[key] };
}

function parseListQuery(query, role) {
  const errors = [];

  const status = parseEnumFilter(query, "status", STATUS_KONSULTASI);
  errors.push(...status.errors);

  const prioritas = parseEnumFilter(query, "prioritas", PRIORITAS_KONSULTASI);
  errors.push(...prioritas.errors);

  const pagination = parsePagination(query);
  errors.push(...pagination.errors);

  const rentang = parseRentangTanggal(query);
  errors.push(...rentang.errors);

  const dokterId = parseDokterIdFilter(query, role);

  return {
    errors,
    values: {
      status: status.nilai,
      prioritas: prioritas.nilai,
      page: pagination.page,
      limit: pagination.limit,
      dokterId,
      dari: rentang.dari,
      sampai: rentang.sampai,
    },
  };
}

// Konteks kunjungan boleh kosong (konsul tanpa kunjungan terkait), jadi
// jenisKunjungan ikut null — bukan error.
function bentukRingkas(k) {
  const { kunjungan, ...sisa } = k;
  return { ...sisa, jenisKunjungan: jenisKunjungan(kunjungan?.ruangan) };
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

  const { status, prioritas, page, limit, dokterId, dari, sampai } = values;

  // Aman di-spread di sini (beda dari operasi/kunjungan): tidak ada klausa lain
  // di modul ini yang menyentuh `tanggalPermintaan` — status surat konsul tidak
  // diturunkan dari tanggal.
  const where = {
    ...(status && { status }),
    ...(prioritas && { prioritas }),
    ...((dari || sampai) && {
      tanggalPermintaan: { ...(dari && { gte: dari }), ...(sampai && { lte: sampai }) },
    }),
    // dokterTujuanId DOKTER selalu dari JWT, tidak pernah dari query (CLAUDE.md
    // Aturan #2). `?dokterId=` cuma dihormati untuk ADMIN — parseDokterIdFilter
    // sudah membuangnya kalau pemanggilnya DOKTER.
    ...(role === "DOKTER" ? { dokterTujuanId: ownDokterId } : dokterId && { dokterTujuanId: dokterId }),
  };

  const [total, konsultasi] = await Promise.all([
    prisma.konsultasi.count({ where }),
    prisma.konsultasi.findMany({
      where,
      select: LIST_SELECT,
      // Menunggu jawaban selalu di atas — itu yang perlu ditindaklanjuti;
      // di dalam tiap grup, permintaan terbaru duluan.
      orderBy: [{ status: "asc" }, { tanggalPermintaan: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({
    data: konsultasi.map(bentukRingkas),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.get("/:id", async (req, res) => {
  const { role, dokterId: ownDokterId } = req.user;
  const { id } = req.params;

  if (role === "DOKTER" && !ownDokterId) {
    return res.status(403).json({ message: "Akun ini tidak terhubung ke data dokter" });
  }

  const konsultasi = await prisma.konsultasi.findUnique({
    where: { id },
    include: {
      pasien: {
        select: { id: true, nama: true, norm: true, jenisKelamin: true, tanggalLahir: true },
      },
      dokterPengirim: { select: { id: true, nama: true, spesialisasi: true } },
      dokterTujuan: { select: { id: true, nama: true, spesialisasi: true } },
      kunjungan: {
        select: {
          id: true,
          tanggalMasuk: true,
          ruangan: { select: { nama: true, jenis: true } },
        },
      },
    },
  });

  if (!konsultasi) {
    return res.status(404).json({ message: "Konsultasi tidak ditemukan" });
  }

  // Tidak ada jalan lolos lewat DokterPasienAssignment di sini: konsul yang
  // ditujukan ke dokter lain bukan urusan dokter ini, meski pasiennya sama.
  if (role === "DOKTER" && konsultasi.dokterTujuanId !== ownDokterId) {
    return res.status(403).json({ message: "Anda tidak memiliki akses ke konsultasi ini" });
  }

  res.json({
    ...konsultasi,
    jenisKunjungan: jenisKunjungan(konsultasi.kunjungan?.ruangan),
  });
});

module.exports = router;
