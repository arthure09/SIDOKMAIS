const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { fakerID_ID: faker } = require("@faker-js/faker");

const prisma = new PrismaClient();

const SPESIALISASI_LIST = [
  "Bedah Onkologi",
  "Onkologi Medik",
  "Radioterapi",
  "Penyakit Dalam",
  "Bedah Onkologi",
];

const GOLONGAN_DARAH = ["A", "B", "AB", "O"];

const DIAGNOSA_CONTOH = [
  "Observasi nyeri abdomen",
  "Kontrol rutin pasca kemoterapi",
  "Suspek tumor jinak, menunggu hasil biopsi",
  "Evaluasi pasca operasi",
  "Penurunan berat badan, observasi lanjutan",
  "Kontrol rutin, kondisi stabil",
  "Nyeri pasca tindakan, dalam pemantauan",
  "Konsultasi awal, rencana pemeriksaan lanjutan",
];

const JENIS_TINDAKAN_OPERASI = [
  "Reseksi Tumor",
  "Biopsi Eksisi",
  "Mastektomi",
  "Laparotomi Eksplorasi",
  "Debulking Tumor",
];

function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickMany(list, count) {
  return [...list].sort(() => Math.random() - 0.5).slice(0, count);
}

async function resetData() {
  await prisma.auditLog.deleteMany();
  await prisma.pendapatan.deleteMany();
  await prisma.operasi.deleteMany();
  await prisma.notifikasi.deleteMany();
  await prisma.kunjungan.deleteMany();
  await prisma.pengguna.deleteMany();
  await prisma.dokterPasienAssignment.deleteMany();
  await prisma.ruangan.deleteMany();
  await prisma.pasien.deleteMany();
  await prisma.dokter.deleteMany();
  await prisma.penjamin.deleteMany();
}

async function seedRuangan() {
  const data = [
    { nama: "Poli Onkologi 1", jenis: "POLI", lantai: 2 },
    { nama: "Poli Onkologi 2", jenis: "POLI", lantai: 2 },
    { nama: "Poli Bedah", jenis: "POLI", lantai: 3 },
    { nama: "Poli Radioterapi", jenis: "POLI", lantai: 1 },
    { nama: "OK Bedah 1", jenis: "OK", lantai: 4 },
    { nama: "OK Bedah 2", jenis: "OK", lantai: 4 },
    { nama: "Rawat Inap Melati", jenis: "RAWAT_INAP", lantai: 5 },
    { nama: "Rawat Inap Anggrek", jenis: "RAWAT_INAP", lantai: 5 },
  ];

  const ruangan = [];
  for (const item of data) {
    ruangan.push(await prisma.ruangan.create({ data: item }));
  }
  return ruangan;
}

async function seedDokter() {
  const dokter = [];
  for (let i = 0; i < 5; i++) {
    const gelarDepan = faker.helpers.arrayElement(["dr.", "Dr."]);
    const nama = `${gelarDepan} ${faker.person.fullName()}, Sp.${faker.helpers.arrayElement(["B(K) Onk", "PD-KHOM", "Rad Onk"])}`;

    dokter.push(
      await prisma.dokter.create({
        data: {
          nip: faker.string.numeric(18),
          nama,
          spesialisasi: SPESIALISASI_LIST[i],
          sip: `1/2.${faker.string.numeric(3)}/31.73.07.1006/1.779.3/e/2026`,
          statusAktif: true,
        },
      })
    );
  }
  return dokter;
}

async function seedPasien(count) {
  const pasien = [];
  for (let i = 0; i < count; i++) {
    const norm = faker.string.numeric(10);
    pasien.push(
      await prisma.pasien.create({
        data: {
          norm,
          nama: faker.person.fullName(),
          jenisKelamin: faker.helpers.arrayElement(["L", "P"]),
          tanggalLahir: faker.date.birthdate({ min: 20, max: 80, mode: "age" }),
          tempatLahir: faker.location.city(),
          alamat: faker.location.streetAddress({ useFullAddress: true }),
          golonganDarah: faker.helpers.arrayElement(GOLONGAN_DARAH),
          noRekamMedis: faker.datatype.boolean(0.7) ? `RM-${norm}` : null,
        },
      })
    );
  }
  return pasien;
}

async function seedAssignments(dokterList, pasienList) {
  const assignments = [];
  const pasienSisa = [...pasienList];

  for (const dokter of dokterList) {
    const jumlah = faker.number.int({ min: 3, max: 4 });
    const pilihan = pickMany(pasienSisa, Math.min(jumlah, pasienSisa.length));

    for (const pasien of pilihan) {
      assignments.push(
        await prisma.dokterPasienAssignment.create({
          data: {
            dokterId: dokter.id,
            pasienId: pasien.id,
            status: faker.helpers.arrayElement(["ACTIVE", "ACTIVE", "COMPLETED"]),
          },
        })
      );
      pasienSisa.splice(pasienSisa.indexOf(pasien), 1);
    }
  }

  return assignments;
}

async function seedKunjungan(pasienList, dokterList, ruanganList) {
  const poliRuangan = ruanganList.filter((r) => r.jenis === "POLI");
  const okRuangan = ruanganList.filter((r) => r.jenis === "OK");
  const statusList = ["SCHEDULED", "ONGOING", "COMPLETED", "COMPLETED", "CANCELLED"];

  const kunjungan = [];
  for (const pasien of pasienList) {
    const jumlahKunjungan = faker.number.int({ min: 1, max: 2 });

    for (let i = 0; i < jumlahKunjungan; i++) {
      const dokter = pickOne(dokterList);
      const status = pickOne(statusList);
      const tanggalMasuk = faker.date.between({ from: "2026-06-01", to: "2026-07-20" });
      const perluOK = faker.datatype.boolean(0.3);
      const ruangan = perluOK ? pickOne(okRuangan) : pickOne(poliRuangan);

      kunjungan.push(
        await prisma.kunjungan.create({
          data: {
            pasienId: pasien.id,
            dokterId: dokter.id,
            ruanganId: ruangan.id,
            tanggalMasuk,
            tanggalKeluar:
              status === "COMPLETED" || status === "CANCELLED"
                ? faker.date.soon({ days: 1, refDate: tanggalMasuk })
                : null,
            diagnosa: pickOne(DIAGNOSA_CONTOH),
            statusKunjungan: status,
            isPasienBaru: faker.datatype.boolean(0.3),
          },
        })
      );
    }
  }

  return kunjungan;
}

async function seedOperasi(kunjunganList, ruanganList) {
  const okRuangan = ruanganList.filter((r) => r.jenis === "OK");
  const kandidat = kunjunganList.filter((k) => ["ONGOING", "COMPLETED"].includes(k.statusKunjungan));
  const dipilih = pickMany(kandidat, Math.min(6, kandidat.length));

  const operasi = [];
  for (const kunjungan of dipilih) {
    const status = kunjungan.statusKunjungan === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";

    operasi.push(
      await prisma.operasi.create({
        data: {
          kunjunganId: kunjungan.id,
          ruanganId: pickOne(okRuangan).id,
          tanggalOperasi: kunjungan.tanggalMasuk,
          jenisTindakan: pickOne(JENIS_TINDAKAN_OPERASI),
          tim: [faker.person.fullName(), faker.person.fullName()],
          status,
          catatanPreOp: "Pasien dalam kondisi stabil, siap tindakan.",
          catatanPostOp: status === "COMPLETED" ? "Tindakan berjalan lancar, tanpa komplikasi." : null,
        },
      })
    );
  }

  return operasi;
}

async function seedPenjamin() {
  const data = [
    { nama: "BPJS", tipe: "Asuransi Pemerintah" },
    { nama: "Pribadi", tipe: "Non-Asuransi" },
    { nama: "Asuransi Swasta", tipe: "Asuransi Swasta" },
  ];

  const penjamin = [];
  for (const item of data) {
    penjamin.push(await prisma.penjamin.create({ data: item }));
  }
  return penjamin;
}

async function seedPendapatan(operasiList, penjaminList) {
  const pendapatan = [];
  for (const operasi of operasiList.filter((o) => o.status === "COMPLETED")) {
    const tarifTotal = faker.number.int({ min: 8_000_000, max: 45_000_000 });
    const jumlahDiterimaDokter = Math.round(tarifTotal * 0.2);

    pendapatan.push(
      await prisma.pendapatan.create({
        data: {
          operasiId: operasi.id,
          penjaminId: pickOne(penjaminList).id,
          tarifTotal,
          jumlahDiterimaDokter,
          isDummy: true,
        },
      })
    );
  }
  return pendapatan;
}

async function seedNotifikasi(dokterList) {
  const tipeList = ["PASIEN_BARU", "REMINDER_OPERASI", "PERUBAHAN_JADWAL"];
  const notifikasi = [];

  for (const dokter of dokterList) {
    const jumlah = faker.number.int({ min: 2, max: 3 });
    for (let i = 0; i < jumlah; i++) {
      const tipe = pickOne(tipeList);
      const pesan =
        tipe === "PASIEN_BARU"
          ? "Pasien baru telah ditugaskan kepada Anda."
          : tipe === "REMINDER_OPERASI"
          ? "Pengingat: Anda memiliki jadwal operasi dalam 24 jam ke depan."
          : "Jadwal kunjungan pasien Anda telah diperbarui.";

      notifikasi.push(
        await prisma.notifikasi.create({
          data: {
            dokterId: dokter.id,
            tipe,
            pesan,
            isRead: faker.datatype.boolean(0.4),
          },
        })
      );
    }
  }

  return notifikasi;
}

async function seedPengguna(dokterList) {
  const passwordHashDefault = await bcrypt.hash("Sidokmais#2026", 10);
  const passwordHashAdmin = await bcrypt.hash("admin123", 10);
  const pengguna = [];

  pengguna.push(
    await prisma.pengguna.create({
      data: {
        username: "admin",
        passwordHash: passwordHashAdmin,
        role: "ADMIN",
      },
    })
  );

  const dokterUntukLogin = pickMany(dokterList, 2);
  for (const dokter of dokterUntukLogin) {
    const username = dokter.nama
      .replace(/^(dr\.|Dr\.)\s*/, "")
      .split(",")[0]
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ".");

    pengguna.push(
      await prisma.pengguna.create({
        data: {
          username,
          passwordHash: passwordHashDefault,
          role: "DOKTER",
          dokterId: dokter.id,
        },
      })
    );
  }

  return pengguna;
}

async function main() {
  await resetData();

  const ruanganList = await seedRuangan();
  const dokterList = await seedDokter();
  const pasienList = await seedPasien(18);
  const assignments = await seedAssignments(dokterList, pasienList);
  const kunjunganList = await seedKunjungan(pasienList, dokterList, ruanganList);
  const operasiList = await seedOperasi(kunjunganList, ruanganList);
  const penjaminList = await seedPenjamin();
  const pendapatanList = await seedPendapatan(operasiList, penjaminList);
  const notifikasiList = await seedNotifikasi(dokterList);
  const penggunaList = await seedPengguna(dokterList);

  console.log("\nSeed selesai. Ringkasan jumlah baris per tabel:");
  console.table({
    Ruangan: ruanganList.length,
    Dokter: dokterList.length,
    Pasien: pasienList.length,
    DokterPasienAssignment: assignments.length,
    Kunjungan: kunjunganList.length,
    Operasi: operasiList.length,
    Penjamin: penjaminList.length,
    Pendapatan: pendapatanList.length,
    Notifikasi: notifikasiList.length,
    Pengguna: penggunaList.length,
  });

  console.log("\nAkun login dummy (password sama untuk semua: Sidokmais#2026):");
  for (const p of penggunaList) {
    console.log(`- ${p.username} (${p.role})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
