const express = require("express");
const prisma = require("../lib/prisma");
const { parsePagination, parseDokterIdFilter } = require("../utils/queryParams");
const { jenisKunjungan, parseJenisKunjungan } = require("../utils/jenisKunjungan");
const { KUNJUNGAN, statusEfektif } = require("../utils/statusJadwal");

const router = express.Router();

const ASSIGNMENT_STATUSES = ["ACTIVE", "COMPLETED"];
const URUTAN = ["terbaru", "terlama"];

// Bandingkan dua baris hasil berdasarkan tanggal kunjungan terakhir. Pasien
// tanpa kunjungan sama sekali selalu di bawah, di kedua arah — mengurutkan
// "terlama" lalu mendapat deretan tanggal "-" di puncak tidak menjawab
// pertanyaan yang bikin dokter memilih urutan itu.
function bandingKunjunganTerakhir(arah) {
  return (a, b) => {
    const ta = a.tanggalKunjunganTerakhir ? new Date(a.tanggalKunjunganTerakhir).getTime() : null;
    const tb = b.tanggalKunjunganTerakhir ? new Date(b.tanggalKunjunganTerakhir).getTime() : null;
    if (ta === null || tb === null) return ta === tb ? 0 : ta === null ? 1 : -1;
    return arah === "terbaru" ? tb - ta : ta - tb;
  };
}

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

  let urutkan;
  if (query.urutkan !== undefined) {
    if (!URUTAN.includes(query.urutkan)) {
      errors.push(`urutkan harus salah satu dari: ${URUTAN.join(", ")}`);
    } else {
      urutkan = query.urutkan;
    }
  }

  const pagination = parsePagination(query);
  errors.push(...pagination.errors);

  const jenis = parseJenisKunjungan(query);
  errors.push(...jenis.errors);

  const dokterId = parseDokterIdFilter(query, role);

  return {
    errors,
    values: {
      search,
      status,
      urutkan,
      ruanganJenis: jenis.ruanganJenis,
      page: pagination.page,
      limit: pagination.limit,
      dokterId,
    },
  };
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
      select: {
        pasienId: true,
        tanggalMasuk: true,
        diagnosa: true,
        ruangan: { select: { jenis: true } },
      },
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

  const { search, status, urutkan, ruanganJenis, page, limit, dokterId } = values;
  // DOKTER selalu dipaksa ke assignment miliknya sendiri. ADMIN melihat semua
  // pasien lintas dokter, kecuali secara eksplisit filter lewat ?dokterId=.
  const assignmentDokterId = role === "DOKTER" ? ownDokterId : dokterId;

  // Search & filter jenis kunjungan sama-sama menyaring lewat relasi `pasien`,
  // jadi digabung dulu — dua spread `pasien:` akan saling menimpa.
  const pasienWhere = {
    ...(search && {
      OR: [
        { nama: { contains: search, mode: "insensitive" } },
        { norm: { contains: search, mode: "insensitive" } },
      ],
    }),
    // "Pasien yang punya kunjungan jenis ini", bukan "kunjungan terakhirnya
    // jenis ini" — daftar ini memang berbasis pasien, bukan kunjungan.
    ...(ruanganJenis && { kunjungan: { some: { ruangan: { jenis: ruanganJenis } } } }),
  };

  const where = {
    ...(assignmentDokterId && { dokterId: assignmentDokterId }),
    ...(status && { status }),
    ...(Object.keys(pasienWhere).length > 0 && { pasien: pasienWhere }),
  };

  const [total, assignments] = await Promise.all([
    prisma.dokterPasienAssignment.count({ where }),
    prisma.dokterPasienAssignment.findMany({
      where,
      include: { pasien: true },
      orderBy: { pasien: { nama: "asc" } },
      // ponytail: waktu diurutkan kunjungan terakhir, seluruh baris hasil filter
      // ditarik dulu lalu dipotong di JS — tanggalnya datang dari relasi to-many
      // `kunjungan`, dan Prisma tidak bisa mengurutkan pada max() relasi. Cukup
      // untuk data dummy; ganti raw SQL kalau jumlah assignment per dokter besar.
      ...(urutkan ? {} : { skip: (page - 1) * limit, take: limit }),
    }),
  ]);

  const pasienIds = assignments.map((a) => a.pasienId);
  const { terakhirMap, berikutnyaMap } = await getKunjunganTerdekat(pasienIds);

  let data = assignments.map((a) => {
    const kunjunganTerakhir = terakhirMap.get(a.pasienId);
    const kunjunganBerikutnya = berikutnyaMap.get(a.pasienId);

    return {
      id: a.pasien.id,
      norm: a.pasien.norm,
      nama: a.pasien.nama,
      status: a.status,
      diagnosaSingkat: kunjunganTerakhir?.diagnosa ?? null,
      jenisKunjungan: jenisKunjungan(kunjunganTerakhir?.ruangan),
      tanggalKunjunganTerakhir: kunjunganTerakhir?.tanggalMasuk ?? null,
      tanggalKunjunganBerikutnya: kunjunganBerikutnya?.tanggalMasuk ?? null,
    };
  });

  if (urutkan) {
    data.sort(bandingKunjunganTerakhir(urutkan));
    data = data.slice((page - 1) * limit, page * limit);
  }

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
      // Diturunkan dari tanggal, sama seperti daftar Konsultasi — supaya
      // riwayat di detail pasien tidak menampilkan status yang bertentangan
      // dengan record yang sama di layar Jadwal.
      statusKunjungan: statusEfektif(k.tanggalMasuk, k.statusKunjungan, KUNJUNGAN),
      isPasienBaru: k.isPasienBaru,
      jenisKunjungan: jenisKunjungan(k.ruangan),
      ruangan: k.ruangan,
      dokter: k.dokter,
    })),
  });
});

module.exports = router;
