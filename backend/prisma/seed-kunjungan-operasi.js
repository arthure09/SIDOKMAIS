// Seeder khusus modul Kunjungan (Konsul) & Operasi.
// Hanya menyentuh 2 tabel ini: Dokter/Pasien/Ruangan/Assignment/Pengguna yang sudah
// ter-seed lewat seed.js TIDAK diubah/regenerasi. Re-runnable: setiap run membersihkan
// hanya Kunjungan + Operasi (+ Pendapatan yang menempel di Operasi lama, karena
// Pendapatan.operasi pakai onDelete: Restrict) lalu generate ulang dari nol.
const { PrismaClient } = require("@prisma/client");
const { fakerID_ID: faker } = require("@faker-js/faker");

const { setJamWIB, keHariKerjaWIB } = require("../src/utils/wib");

const prisma = new PrismaClient();

// Poliklinik 08:00-15:30, operasi elektif mulai 08:00-13:00 (WIB).
// faker.date.* menghasilkan instant acak sepanjang 24 jam — tanpa dinormalisasi
// muncul konsultasi jam 01.31 dini hari dan jadwal di akhir pekan.
const SLOT_POLI = [8, 9, 10, 11, 13, 14, 15];
const SLOT_OPERASI = [8, 9, 10, 11, 13];

// Ganti jam `date` ke salah satu slot, menit kelipatan 15 supaya terlihat
// seperti jadwal betulan. Tanggalnya TIDAK digeser.
function keSlotJam(date, slots) {
  return setJamWIB(date, pickOne(slots), pickOne([0, 15, 30, 45]));
}

// keSlotJam + geser ke hari kerja terdekat kalau jatuh di akhir pekan.
function keSlotJadwal(date, slots) {
  return keSlotJam(keHariKerjaWIB(date), slots);
}

const KUNJUNGAN_TARGET = 50;
const OPERASI_TARGET = 20;

const DIAGNOSA_LIST = [
  { text: "Kanker payudara stadium II, rencana kemoterapi lanjutan", bedah: true },
  { text: "Suspek kanker payudara, menunggu hasil biopsi", bedah: true },
  { text: "Kontrol rutin pasca kemoterapi kanker payudara", bedah: false },
  { text: "Kanker payudara stadium III, evaluasi pra operasi", bedah: true },
  { text: "Kanker paru non-sel kecil, kontrol rutin", bedah: false },
  { text: "Suspek keganasan paru, evaluasi lanjutan CT scan", bedah: false },
  { text: "Kanker paru stadium lanjut, kontrol nyeri", bedah: false },
  { text: "Kanker serviks stadium IIB, rencana radioterapi", bedah: false },
  { text: "Kontrol rutin pasca radioterapi kanker serviks", bedah: false },
  { text: "Suspek kanker serviks, menunggu hasil PA", bedah: true },
  { text: "Tumor jinak payudara, rencana eksisi", bedah: true },
  { text: "Observasi tumor jinak abdomen, rencana tindakan lanjutan", bedah: true },
  { text: "Tumor jinak kelenjar tiroid, kontrol rutin", bedah: false },
  { text: "Kontrol rutin pasca kemoterapi, kondisi stabil", bedah: false },
  { text: "Evaluasi efek samping kemoterapi", bedah: false },
  { text: "Kontrol rutin pasca operasi, penyembuhan baik", bedah: false },
  { text: "Nyeri pasca tindakan, dalam pemantauan", bedah: false },
  { text: "Konsultasi awal onkologi, rencana pemeriksaan lanjutan", bedah: false },
  { text: "Limfadenopati suspek metastasis, rencana biopsi", bedah: true },
  { text: "Massa abdomen suspek keganasan, evaluasi pra tindakan", bedah: true },
];

const JENIS_TINDAKAN_LIST = [
  "Mastektomi",
  "Biopsi Eksisi Tumor",
  "Reseksi Tumor",
  "Debulking Tumor",
  "Limfadenektomi",
  "Biopsi Insisi",
  "Eksisi Tumor Jinak",
  "Tiroidektomi Parsial",
];

const POST_OP_NOTES = [
  "Tindakan berjalan lancar, tanpa komplikasi.",
  "Tindakan selesai, pasien dipindahkan ke ruang pemulihan.",
  "Perdarahan minimal, kondisi pasien stabil pasca tindakan.",
];

const PRE_OP_NOTES = [
  "Pasien dalam kondisi stabil, siap tindakan.",
  "Hasil pemeriksaan penunjang mendukung, tindakan dilanjutkan.",
  "Persiapan pra operasi selesai, tidak ada kontraindikasi.",
];

const CANCEL_NOTES = [
  "Tindakan dibatalkan karena kondisi pasien belum stabil.",
  "Dijadwalkan ulang atas permintaan keluarga pasien.",
  "Dibatalkan, menunggu hasil pemeriksaan penunjang tambahan.",
];

function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickMany(list, count) {
  return [...list].sort(() => Math.random() - 0.5).slice(0, count);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function loadExistingData() {
  const [dokterList, pasienList, ruanganList, assignments] = await Promise.all([
    prisma.dokter.findMany(),
    prisma.pasien.findMany(),
    prisma.ruangan.findMany(),
    prisma.dokterPasienAssignment.findMany(),
  ]);

  if (assignments.length === 0) {
    throw new Error("Tidak ada DokterPasienAssignment di DB — jalankan seed.js dulu.");
  }

  return { dokterList, pasienList, ruanganList, assignments };
}

async function clearKunjunganOperasi() {
  // Pendapatan.operasi pakai onDelete: Restrict, dan setiap Pendapatan pasti menunjuk
  // ke Operasi (FK wajib) — jadi aman dihapus semua sebelum Operasi dihapus.
  await prisma.pendapatan.deleteMany();
  await prisma.operasi.deleteMany();
  await prisma.kunjungan.deleteMany();
}

async function seedKunjungan(assignments, ruanganList) {
  const poliRuangan = ruanganList.filter((r) => r.jenis === "POLI");
  const today = new Date();
  const kunjungan = [];
  const meta = [];

  for (let i = 0; i < KUNJUNGAN_TARGET; i++) {
    const assignment = pickOne(assignments);
    const isFuture = faker.datatype.boolean(0.4);
    const diagnosaEntry = pickOne(DIAGNOSA_LIST);

    let tanggalMasuk;
    let status;
    let tanggalKeluar;

    if (isFuture) {
      tanggalMasuk = keSlotJadwal(faker.date.soon({ days: 14, refDate: today }), SLOT_POLI);
      status = "SCHEDULED";
      tanggalKeluar = null;
    } else {
      tanggalMasuk = keSlotJadwal(faker.date.recent({ days: 60, refDate: today }), SLOT_POLI);
      status = faker.datatype.boolean(0.85) ? "COMPLETED" : "CANCELLED";
      // Konsultasi poli selesai di hari yang sama, 30-90 menit setelah masuk —
      // bukan faker.date.soon 1 hari yang bisa mendarat di dini hari besoknya.
      tanggalKeluar = new Date(tanggalMasuk.getTime() + pickOne([30, 45, 60, 90]) * 60000);
    }

    const record = await prisma.kunjungan.create({
      data: {
        pasienId: assignment.pasienId,
        dokterId: assignment.dokterId,
        ruanganId: pickOne(poliRuangan).id,
        tanggalMasuk,
        tanggalKeluar,
        diagnosa: diagnosaEntry.text,
        statusKunjungan: status,
        isPasienBaru: faker.datatype.boolean(0.25),
      },
    });

    kunjungan.push(record);
    meta.push({ record, bedah: diagnosaEntry.bedah });
  }

  return { kunjungan, meta };
}

function catatanForStatus(status) {
  if (status === "SCHEDULED") return { preOp: null, postOp: null };
  if (status === "IN_PROGRESS") return { preOp: pickOne(PRE_OP_NOTES), postOp: null };
  if (status === "COMPLETED") return { preOp: pickOne(PRE_OP_NOTES), postOp: pickOne(POST_OP_NOTES) };
  return { preOp: pickOne(CANCEL_NOTES), postOp: null }; // CANCELLED
}

async function seedOperasi(kunjunganMeta, ruanganList) {
  const okRuangan = ruanganList.filter((r) => r.jenis === "OK");
  const today = new Date();

  const futureCandidates = kunjunganMeta.filter(
    (k) => k.bedah && k.record.statusKunjungan === "SCHEDULED"
  );
  const pastCandidates = kunjunganMeta.filter(
    (k) => k.bedah && k.record.statusKunjungan === "COMPLETED"
  );

  const futureCount = Math.min(futureCandidates.length, Math.round(OPERASI_TARGET * 0.6));
  const pastCount = Math.min(pastCandidates.length, OPERASI_TARGET - futureCount);

  const chosenFuture = pickMany(futureCandidates, futureCount);
  const chosenPast = pickMany(pastCandidates, pastCount);

  const operasi = [];

  for (let i = 0; i < chosenFuture.length; i++) {
    const kunjungan = chosenFuture[i].record;
    // 2 record pertama sengaja dipaksa H-1 / H-2 dari hari ini, buat testing reminder.
    let tanggalOperasi;
    // 2 record pertama jaraknya dari hari ini harus tetap persis H-1/H-2, jadi
    // cuma jamnya yang dirapikan — tanpa geser hari kerja yang bisa menghapus
    // jarak itu (mis. besok Sabtu akan ditarik mundur ke hari ini).
    if (i === 0) tanggalOperasi = keSlotJam(addDays(today, 1), SLOT_OPERASI);
    else if (i === 1) tanggalOperasi = keSlotJam(addDays(today, 2), SLOT_OPERASI);
    else tanggalOperasi = keSlotJadwal(faker.date.soon({ days: 14, refDate: kunjungan.tanggalMasuk }), SLOT_OPERASI);

    operasi.push(
      await prisma.operasi.create({
        data: {
          kunjunganId: kunjungan.id,
          ruanganId: pickOne(okRuangan).id,
          tanggalOperasi,
          jenisTindakan: pickOne(JENIS_TINDAKAN_LIST),
          tim: [faker.person.fullName(), faker.person.fullName()],
          status: "SCHEDULED",
          catatanPreOp: null,
          catatanPostOp: null,
        },
      })
    );
  }

  for (const { record: kunjungan } of chosenPast) {
    const status = faker.helpers.arrayElement([
      "COMPLETED",
      "COMPLETED",
      "COMPLETED",
      "IN_PROGRESS",
      "CANCELLED",
    ]);
    const { preOp, postOp } = catatanForStatus(status);

    operasi.push(
      await prisma.operasi.create({
        data: {
          kunjunganId: kunjungan.id,
          ruanganId: pickOne(okRuangan).id,
          tanggalOperasi: keSlotJadwal(kunjungan.tanggalMasuk, SLOT_OPERASI),
          jenisTindakan: pickOne(JENIS_TINDAKAN_LIST),
          tim: [faker.person.fullName(), faker.person.fullName()],
          status,
          catatanPreOp: preOp,
          catatanPostOp: postOp,
        },
      })
    );
  }

  return operasi;
}

async function main() {
  const { ruanganList, assignments } = await loadExistingData();

  await clearKunjunganOperasi();

  const { kunjungan, meta } = await seedKunjungan(assignments, ruanganList);
  const operasi = await seedOperasi(meta, ruanganList);

  const kunjunganByStatus = kunjungan.reduce((acc, k) => {
    acc[k.statusKunjungan] = (acc[k.statusKunjungan] || 0) + 1;
    return acc;
  }, {});
  const operasiByStatus = operasi.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  console.log("\nSeed Kunjungan & Operasi selesai.");
  console.log(`Kunjungan: ${kunjungan.length} row`);
  console.table(kunjunganByStatus);
  console.log(`Operasi: ${operasi.length} row`);
  console.table(operasiByStatus);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
