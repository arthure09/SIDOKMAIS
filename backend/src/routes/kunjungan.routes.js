const express = require("express");
const prisma = require("../lib/prisma");
const { dokterPunyaAksesPasien } = require("../utils/aksesPasien");
const { parsePagination, parseDokterIdFilter, parseRentangTanggal } = require("../utils/queryParams");
const { jenisKunjungan, parseJenisKunjungan } = require("../utils/jenisKunjungan");
const { KUNJUNGAN, terapkanStatusEfektif, whereStatusEfektif } = require("../utils/statusJadwal");

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

  const jenis = parseJenisKunjungan(query);
  errors.push(...jenis.errors);

  // Dipakai layar Poliklinik untuk meminta jadwal satu hari (dari == sampai),
  // dan filter rentang tanggal untuk menengok ke belakang.
  const rentang = parseRentangTanggal(query);
  errors.push(...rentang.errors);

  const dokterId = parseDokterIdFilter(query, role);

  return {
    errors,
    values: {
      status,
      ruanganJenis: jenis.ruanganJenis,
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

  const { status, ruanganJenis, page, limit, dokterId, dari, sampai } = values;

  // Semua klausa digabung lewat AND, TIDAK di-spread jadi satu objek. Dua di
  // antaranya sama-sama memakai kunci yang sama: whereStatusEfektif(COMPLETED)
  // menghasilkan `OR`, dan scoping akses dokter juga `OR`; keduanya juga
  // sama-sama menyentuh `tanggalMasuk` bersama filter dari/sampai. Waktu
  // di-spread, yang belakangan menimpa yang duluan tanpa error — dokter yang
  // memfilter "Selesai" diam-diam mendapat semua status.
  const klausa = [];

  // Filter status menyeleksi berdasar status EFEKTIF, bukan status tersimpan —
  // lihat utils/statusJadwal.js.
  if (status) klausa.push(whereStatusEfektif(status, KUNJUNGAN));
  if (ruanganJenis) klausa.push({ ruangan: { jenis: ruanganJenis } });
  if (dari) klausa.push({ tanggalMasuk: { gte: dari } });
  if (sampai) klausa.push({ tanggalMasuk: { lte: sampai } });

  if (role === "DOKTER") {
    // Dokter juga berhak lihat kunjungan pasien yang di-assign kepadanya
    // (DokterPasienAssignment), bukan cuma kunjungan yang kebetulan tercatat
    // dokterId dia secara langsung — lihat utils/aksesPasien.js.
    klausa.push({
      OR: [
        { dokterId: ownDokterId },
        { pasien: { assignments: { some: { dokterId: ownDokterId } } } },
      ],
    });
  } else if (dokterId) {
    klausa.push({ dokterId });
  }

  const where = klausa.length > 0 ? { AND: klausa } : {};

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
    data: kunjungan.map((k) => ({
      ...terapkanStatusEfektif(k, KUNJUNGAN),
      jenisKunjungan: jenisKunjungan(k.ruangan),
    })),
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

  res.json({
    ...terapkanStatusEfektif(kunjungan, KUNJUNGAN),
    jenisKunjungan: jenisKunjungan(kunjungan.ruangan),
  });
});

module.exports = router;
