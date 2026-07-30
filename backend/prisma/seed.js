const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { fakerID_ID: faker } = require("@faker-js/faker");
const { LAB_KATEGORI } = require("../src/constants/lab");

const prisma = new PrismaClient();

// "Hari ini" versi dummy data — dipakai supaya tanggalPermintaan/tanggalHasil
// lab tidak pernah jatuh di masa depan, konsisten dgn jam sistem saat seed jalan.
const HARI_INI = new Date();
const AWAL_RENTANG_LAB = new Date("2026-06-01");

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

const JENIS_TINDAKAN_NETRAL = [
  "Reseksi Tumor",
  "Biopsi Eksisi",
  "Laparotomi Eksplorasi",
  "Debulking Tumor",
];

// Tindakan gender-specific dipisah dari daftar netral supaya tidak ada
// kombinasi tidak masuk akal (mis. Mastektomi pada pasien laki-laki).
const JENIS_TINDAKAN_PEREMPUAN = ["Mastektomi"];

// Pakai faker.helpers.* (bukan Math.random()) supaya SELURUH keacakan seed
// ikut dikontrol oleh faker.seed() di main() — termasuk pemilihan 2 dokter
// buat akun login, yang sebelumnya tetap acak walau faker sudah di-seed.
function pickOne(list) {
  return faker.helpers.arrayElement(list);
}

function pickMany(list, count) {
  return faker.helpers.arrayElements(list, count);
}

// faker-js locale id_ID punya 1 dari 3 template person.fullName():
// "{firstName} {firstName} {lastName}" — akibat quirk templating internal
// faker, kedua token {firstName} SELALU resolve ke nilai yang sama (bukan 2
// draw independen), jadi ~25% hasil fullName() punya kata pertama dobel
// (mis. "Indira Indira Jelita"). Helper ini membuang kata berulang berurutan
// (case-insensitive); kalau hasil dedup tinggal 1 kata, generate ulang.
function dedupeKataBerurutan(nama) {
  const kata = nama.trim().split(/\s+/);
  const hasil = [];
  for (const w of kata) {
    if (hasil.length === 0 || hasil[hasil.length - 1].toLowerCase() !== w.toLowerCase()) {
      hasil.push(w);
    }
  }
  return hasil.join(" ");
}

function generateNamaOrang() {
  let nama = dedupeKataBerurutan(faker.person.fullName());
  while (nama.split(" ").length < 2) {
    nama = dedupeKataBerurutan(faker.person.fullName());
  }
  return nama;
}

async function resetData() {
  await prisma.auditLog.deleteMany();
  await prisma.pendapatan.deleteMany();
  await prisma.operasi.deleteMany();
  await prisma.hasilLabItem.deleteMany();
  await prisma.pemeriksaanLab.deleteMany();
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
    const nama = `${gelarDepan} ${generateNamaOrang()}, Sp.${faker.helpers.arrayElement(["B(K) Onk", "PD-KHOM", "Rad Onk"])}`;

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
          nama: generateNamaOrang(),
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

async function seedOperasi(kunjunganList, ruanganList, pasienList) {
  const okRuangan = ruanganList.filter((r) => r.jenis === "OK");
  const jenisKelaminByPasien = new Map(pasienList.map((p) => [p.id, p.jenisKelamin]));
  const kandidat = kunjunganList.filter((k) => ["ONGOING", "COMPLETED"].includes(k.statusKunjungan));
  const dipilih = pickMany(kandidat, Math.min(6, kandidat.length));

  const operasi = [];
  for (const kunjungan of dipilih) {
    const status = kunjungan.statusKunjungan === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
    // Pilih tindakan setelah jenis kelamin pasien diketahui, supaya tindakan
    // gender-specific (mis. Mastektomi) tidak pernah muncul di pasien laki-laki.
    const jenisKelamin = jenisKelaminByPasien.get(kunjungan.pasienId);
    const daftarTindakan =
      jenisKelamin === "P"
        ? [...JENIS_TINDAKAN_NETRAL, ...JENIS_TINDAKAN_PEREMPUAN]
        : JENIS_TINDAKAN_NETRAL;

    operasi.push(
      await prisma.operasi.create({
        data: {
          kunjunganId: kunjungan.id,
          ruanganId: pickOne(okRuangan).id,
          tanggalOperasi: kunjungan.tanggalMasuk,
          jenisTindakan: pickOne(daftarTindakan),
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

// ---- Modul Laporan Lab (PemeriksaanLab + HasilLabItem) ----
// Rujukan nilai per parameter: array [min, max] kalau sama utk semua gender,
// atau { L: [min,max], P: [min,max] } kalau berbeda. `arahAbnormal` membatasi
// arah RENDAH/TINGGI yang masuk akal secara klinis (mis. SGOT cuma relevan
// kalau TINGGI, Albumin cuma relevan kalau RENDAH pada konteks onkologi).
const LAB_PROFIL = {
  Hematologi: [
    {
      namaPemeriksaan: "Darah Lengkap",
      params: [
        { nama: "Hemoglobin", satuan: "g/dL", desimal: 1, rujukan: { L: [13.2, 17.3], P: [11.7, 15.5] } },
        { nama: "Leukosit", satuan: "10^3/µL", desimal: 1, rujukan: [4.5, 11.0] },
        { nama: "Trombosit", satuan: "10^3/µL", desimal: 0, rujukan: [150, 400] },
        { nama: "Hematokrit", satuan: "%", desimal: 1, rujukan: { L: [40, 52], P: [35, 47] } },
        { nama: "Eritrosit", satuan: "10^6/µL", desimal: 2, rujukan: { L: [4.5, 5.9], P: [4.0, 5.2] } },
      ],
    },
  ],
  "Kimia Klinik": [
    {
      namaPemeriksaan: "Fungsi Hati",
      params: [
        { nama: "SGOT", satuan: "U/L", desimal: 0, rujukan: [0, 35], arahAbnormal: ["TINGGI"] },
        { nama: "SGPT", satuan: "U/L", desimal: 0, rujukan: [0, 40], arahAbnormal: ["TINGGI"] },
        { nama: "Albumin", satuan: "g/dL", desimal: 1, rujukan: [3.5, 5.0], arahAbnormal: ["RENDAH"] },
      ],
    },
    {
      namaPemeriksaan: "Fungsi Ginjal",
      params: [
        { nama: "Ureum", satuan: "mg/dL", desimal: 0, rujukan: [10, 50], arahAbnormal: ["TINGGI"] },
        {
          nama: "Kreatinin",
          satuan: "mg/dL",
          desimal: 2,
          rujukan: { L: [0.7, 1.3], P: [0.6, 1.1] },
          arahAbnormal: ["TINGGI"],
        },
      ],
    },
    {
      namaPemeriksaan: "Gula Darah Sewaktu",
      params: [{ nama: "Glukosa Darah", satuan: "mg/dL", desimal: 0, rujukan: [70, 140] }],
    },
  ],
  Imunologi: {
    netral: [
      {
        namaPemeriksaan: "CEA",
        params: [{ nama: "CEA", satuan: "ng/mL", desimal: 1, rujukan: [0, 5], arahAbnormal: ["TINGGI"] }],
      },
      {
        namaPemeriksaan: "AFP",
        params: [{ nama: "AFP", satuan: "ng/mL", desimal: 1, rujukan: [0, 10], arahAbnormal: ["TINGGI"] }],
      },
    ],
    perempuan: [
      {
        namaPemeriksaan: "CA 15-3",
        params: [{ nama: "CA 15-3", satuan: "U/mL", desimal: 1, rujukan: [0, 30], arahAbnormal: ["TINGGI"] }],
      },
      {
        namaPemeriksaan: "CA-125",
        params: [{ nama: "CA-125", satuan: "U/mL", desimal: 1, rujukan: [0, 35], arahAbnormal: ["TINGGI"] }],
      },
    ],
  },
  Urinalisis: [
    {
      namaPemeriksaan: "Urinalisis Lengkap",
      params: [
        { nama: "Warna", kualitatif: true, normal: "Kuning Jernih", abnormal: ["Kuning Keruh", "Kemerahan"] },
        { nama: "pH", satuan: null, desimal: 1, rujukan: [4.5, 8.0] },
        { nama: "Protein", kualitatif: true, normal: "Negatif", abnormal: ["Positif 1+", "Positif 2+"] },
        { nama: "Glukosa Urin", kualitatif: true, normal: "Negatif", abnormal: ["Positif 1+"] },
        { nama: "Leukosit Urin", satuan: "/LPB", desimal: 0, rujukan: [0, 5], arahAbnormal: ["TINGGI"] },
      ],
    },
  ],
  Mikrobiologi: [{ namaPemeriksaan: "Kultur & Sensitivitas Darah" }],
  "Patologi Anatomi": [{ namaPemeriksaan: "Pemeriksaan Histopatologi" }],
};

const ABNORMAL_CHANCE = 0.36;

function resolveRujukan(paramDef, jenisKelamin) {
  return Array.isArray(paramDef.rujukan) ? paramDef.rujukan : paramDef.rujukan[jenisKelamin];
}

function formatRujukan(min, max, desimal) {
  return `${min.toFixed(desimal)} - ${max.toFixed(desimal)}`;
}

// `flag` SELALU dihitung dari perbandingan nilai vs rentang rujukan yang sama
// dipakai buat generate nilai-nya — bukan diacak terpisah — supaya tidak
// pernah muncul kombinasi tidak konsisten (mis. Hb 14.1 dgn rujukan 13.2-17.3
// tapi diberi flag TINGGI).
function buildKuantitatifItem(paramDef, jenisKelamin, urutan) {
  const [min, max] = resolveRujukan(paramDef, jenisKelamin);
  const arahAbnormal = paramDef.arahAbnormal || ["RENDAH", "TINGGI"];
  const desimal = paramDef.desimal ?? 1;
  const abnormal = faker.datatype.boolean(ABNORMAL_CHANCE);
  const range = max - min;

  let nilaiNum;
  if (abnormal) {
    const arah = pickOne(arahAbnormal);
    const delta = Math.max(range * faker.number.float({ min: 0.15, max: 0.45 }), Math.pow(10, -desimal) * 2);
    nilaiNum = arah === "RENDAH" ? min - delta : max + delta;
    if (nilaiNum < 0) nilaiNum = 0;
  } else {
    nilaiNum = faker.number.float({ min, max, fractionDigits: desimal });
  }
  nilaiNum = Number(nilaiNum.toFixed(desimal));

  const flag = nilaiNum < min ? "RENDAH" : nilaiNum > max ? "TINGGI" : "NORMAL";

  return {
    namaParameter: paramDef.nama,
    nilai: nilaiNum.toFixed(desimal),
    satuan: paramDef.satuan || null,
    nilaiRujukan: formatRujukan(min, max, desimal),
    flag,
    urutan,
  };
}

// Parameter kualitatif tidak punya rujukan numerik — flag NORMAL/ABNORMAL
// mengikuti isi teks hasil yang benar-benar dipilih, bukan diacak independen.
function buildKualitatifItem(paramDef, urutan) {
  const abnormal = faker.datatype.boolean(ABNORMAL_CHANCE);
  const nilai = abnormal ? pickOne(paramDef.abnormal) : paramDef.normal;
  return {
    namaParameter: paramDef.nama,
    nilai,
    satuan: null,
    nilaiRujukan: null,
    flag: abnormal ? "ABNORMAL" : "NORMAL",
    urutan,
  };
}

function buildMikrobiologiItems() {
  const adaPertumbuhan = faker.datatype.boolean(ABNORMAL_CHANCE);
  if (!adaPertumbuhan) {
    return [
      {
        namaParameter: "Hasil Kultur",
        nilai: "Tidak ada pertumbuhan bakteri",
        satuan: null,
        nilaiRujukan: null,
        flag: "NORMAL",
        urutan: 1,
      },
      {
        namaParameter: "Sensitivitas Antibiotik",
        nilai: "Tidak dilakukan (tidak ada pertumbuhan bakteri)",
        satuan: null,
        nilaiRujukan: null,
        flag: "NORMAL",
        urutan: 2,
      },
    ];
  }
  const organisme = pickOne(["Escherichia coli", "Staphylococcus aureus", "Klebsiella pneumoniae"]);
  const sensitif = pickOne(["Ceftriaxone", "Meropenem", "Levofloxacin"]);
  const resisten = pickOne(["Ampisilin", "Amoksisilin"]);
  return [
    {
      namaParameter: "Hasil Kultur",
      nilai: `Ditemukan pertumbuhan ${organisme} >10^5 CFU/mL`,
      satuan: null,
      nilaiRujukan: null,
      flag: "ABNORMAL",
      urutan: 1,
    },
    {
      namaParameter: "Sensitivitas Antibiotik",
      nilai: `Sensitif terhadap ${sensitif}, resisten terhadap ${resisten}`,
      satuan: null,
      nilaiRujukan: null,
      flag: "ABNORMAL",
      urutan: 2,
    },
  ];
}

function buildPatologiAnatomiItems() {
  const ganas = faker.datatype.boolean(ABNORMAL_CHANCE);
  const items = [];
  if (!ganas) {
    items.push({
      namaParameter: "Kesimpulan",
      nilai: "Tidak ditemukan sel ganas, sesuai jaringan jinak",
      satuan: null,
      nilaiRujukan: null,
      flag: "NORMAL",
      urutan: 1,
    });
  } else {
    const jenis = pickOne(["karsinoma duktal invasif", "adenokarsinoma", "karsinoma sel skuamosa"]);
    items.push({
      namaParameter: "Kesimpulan",
      nilai: `Ditemukan sel ganas, sesuai ${jenis}`,
      satuan: null,
      nilaiRujukan: null,
      flag: "ABNORMAL",
      urutan: 1,
    });
  }
  if (faker.datatype.boolean(0.4)) {
    items.push({
      namaParameter: "Deskripsi Mikroskopik",
      nilai: ganas
        ? "Sel epitel atipik dengan inti pleomorfik, aktivitas mitosis meningkat"
        : "Struktur jaringan dalam batas normal, tidak tampak atipia seluler",
      satuan: null,
      nilaiRujukan: null,
      flag: ganas ? "ABNORMAL" : "NORMAL",
      urutan: 2,
    });
  }
  return items;
}

// Pilih profil SETELAH jenisKelamin diketahui, supaya tumor marker payudara/
// ovarium (CA 15-3, CA-125) tidak pernah muncul di pasien laki-laki.
function pickLabProfil(kategori, jenisKelamin) {
  if (kategori === "Imunologi") {
    const pool =
      jenisKelamin === "P"
        ? [...LAB_PROFIL.Imunologi.netral, ...LAB_PROFIL.Imunologi.perempuan]
        : LAB_PROFIL.Imunologi.netral;
    return pickOne(pool);
  }
  return pickOne(LAB_PROFIL[kategori]);
}

function buildHasilLabItems(kategori, profil, jenisKelamin) {
  if (kategori === "Mikrobiologi") return buildMikrobiologiItems();
  if (kategori === "Patologi Anatomi") return buildPatologiAnatomiItems();
  return profil.params.map((paramDef, idx) =>
    paramDef.kualitatif
      ? buildKualitatifItem(paramDef, idx + 1)
      : buildKuantitatifItem(paramDef, jenisKelamin, idx + 1)
  );
}

function randomDateBetween(from, to) {
  return from < to ? faker.date.between({ from, to }) : new Date(from);
}

// Tiga fungsi di bawah memaksa distribusi wajib dari prompt-day17 (~20%
// kunjunganId null, >=3 order dokterPeminta beda dari dokter yang di-assign,
// minimal 1 PENDING) supaya tidak bergantung murni pada probabilitas acak.
function ensureMinimumKunjunganNull(specs) {
  const target = Math.max(1, Math.ceil(specs.length * 0.2));
  let nullCount = specs.filter((s) => s.kunjunganId === null).length;
  for (const spec of specs) {
    if (nullCount >= target) break;
    if (spec.kunjunganId !== null) {
      spec.kunjunganId = null;
      nullCount += 1;
    }
  }
}

function ensureMinimumCrossDokter(specs, dokterList) {
  const isCross = (s) => s.assignedDokterId && s.dokterPemintaId && s.dokterPemintaId !== s.assignedDokterId;
  let count = specs.filter(isCross).length;
  for (const spec of specs) {
    if (count >= 3) break;
    if (spec.assignedDokterId && !isCross(spec)) {
      const kandidat = dokterList.filter((d) => d.id !== spec.assignedDokterId);
      if (kandidat.length === 0) continue;
      spec.dokterPemintaId = pickOne(kandidat).id;
      count += 1;
    }
  }
}

function ensureMinimumPending(specs) {
  if (!specs.some((s) => s.status === "PENDING")) {
    specs[0].status = "PENDING";
  }
}

async function seedPemeriksaanLab(pasienList, kunjunganList, dokterList, assignments) {
  const kunjunganByPasien = new Map();
  for (const k of kunjunganList) {
    if (!kunjunganByPasien.has(k.pasienId)) kunjunganByPasien.set(k.pasienId, []);
    kunjunganByPasien.get(k.pasienId).push(k);
  }

  const assignedDokterByPasien = new Map();
  for (const a of assignments) {
    if (!assignedDokterByPasien.has(a.pasienId)) assignedDokterByPasien.set(a.pasienId, a.dokterId);
  }

  // Pass 1: bangun spec JS biasa dulu (belum insert DB) supaya proporsi wajib
  // bisa dipaksa lewat ensureMinimum* sebelum benar-benar create ke database.
  const specs = [];
  for (const pasien of pasienList) {
    const kunjunganPasien = kunjunganByPasien.get(pasien.id) || [];
    const assignedDokterId = assignedDokterByPasien.get(pasien.id) || null;
    const jumlahOrder = faker.number.int({ min: 1, max: 3 });

    for (let i = 0; i < jumlahOrder; i++) {
      const kategori = pickOne(LAB_KATEGORI);
      const profil = pickLabProfil(kategori, pasien.jenisKelamin);

      const pakaiKunjungan = kunjunganPasien.length > 0 && faker.datatype.boolean(0.8);
      const kunjunganRef = pakaiKunjungan ? pickOne(kunjunganPasien) : null;

      const status = pickOne(["COMPLETED", "COMPLETED", "COMPLETED", "PENDING", "CANCELLED"]);

      let dokterPemintaId;
      if (faker.datatype.boolean(0.1)) {
        dokterPemintaId = null;
      } else if (assignedDokterId && faker.datatype.boolean(0.25)) {
        const kandidatLain = dokterList.filter((d) => d.id !== assignedDokterId);
        dokterPemintaId = pickOne(kandidatLain).id;
      } else {
        dokterPemintaId = assignedDokterId || pickOne(dokterList).id;
      }

      specs.push({
        pasienId: pasien.id,
        jenisKelamin: pasien.jenisKelamin,
        kunjunganId: kunjunganRef ? kunjunganRef.id : null,
        kunjunganTanggalRef: kunjunganRef ? kunjunganRef.tanggalMasuk : null,
        dokterPemintaId,
        assignedDokterId,
        kategori,
        namaPemeriksaan: profil.namaPemeriksaan,
        profil,
        status,
      });
    }
  }

  ensureMinimumKunjunganNull(specs);
  ensureMinimumCrossDokter(specs, dokterList);
  ensureMinimumPending(specs);

  // Pass 2: materialize ke DB, sekarang distribusinya sudah dijamin.
  const pemeriksaanLabList = [];
  let totalHasilLabItem = 0;

  for (const spec of specs) {
    const perluHasil = spec.status === "COMPLETED";
    const batasPermintaan = perluHasil ? new Date(HARI_INI.getTime() - 86400000) : HARI_INI;
    const awalPermintaan = spec.kunjunganTanggalRef || AWAL_RENTANG_LAB;
    const dariPermintaan =
      awalPermintaan < batasPermintaan ? awalPermintaan : new Date(batasPermintaan.getTime() - 86400000);
    const tanggalPermintaan = randomDateBetween(dariPermintaan, batasPermintaan);

    const tanggalHasil = perluHasil
      ? randomDateBetween(
          new Date(tanggalPermintaan.getTime() + 3600000),
          new Date(Math.min(HARI_INI.getTime(), tanggalPermintaan.getTime() + 5 * 86400000))
        )
      : null;

    const dibuat = await prisma.pemeriksaanLab.create({
      data: {
        pasienId: spec.pasienId,
        kunjunganId: spec.kunjunganId,
        dokterPemintaId: spec.dokterPemintaId,
        kategori: spec.kategori,
        namaPemeriksaan: spec.namaPemeriksaan,
        laboratorium: pickOne(["Laboratorium A", "Laboratorium B", "Laboratorium C"]),
        tanggalPermintaan,
        tanggalHasil,
        status: spec.status,
        catatan: perluHasil ? "Hasil telah diverifikasi petugas lab." : null,
      },
    });
    pemeriksaanLabList.push(dibuat);

    if (perluHasil) {
      const items = buildHasilLabItems(spec.kategori, spec.profil, spec.jenisKelamin);
      for (const item of items) {
        await prisma.hasilLabItem.create({
          data: { ...item, pemeriksaanLabId: dibuat.id },
        });
      }
      totalHasilLabItem += items.length;
    }
  }

  return { pemeriksaanLabList, totalHasilLabItem };
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
  const usernameTerpakai = new Set();
  for (const dokter of dokterUntukLogin) {
    const usernameDasar = dokter.nama
      .replace(/^(dr\.|Dr\.)\s*/, "")
      .split(",")[0]
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ".");

    // Guard collision: kalau dua nama dokter menghasilkan username dasar yang
    // sama setelah gelar di-strip, tambahkan suffix angka daripada crash.
    let username = usernameDasar;
    let suffix = 2;
    while (usernameTerpakai.has(username)) {
      username = `${usernameDasar}${suffix}`;
      suffix += 1;
    }
    usernameTerpakai.add(username);

    const dibuat = await prisma.pengguna.create({
      data: {
        username,
        passwordHash: passwordHashDefault,
        role: "DOKTER",
        dokterId: dokter.id,
      },
    });
    dibuat.dokterNamaUntukLog = dokter.nama;
    pengguna.push(dibuat);
  }

  return pengguna;
}

async function main() {
  // Wajib paling awal, sebelum faker dipanggil di mana pun — supaya seluruh
  // hasil seed (termasuk username akun testing DOKTER) identik tiap run.
  faker.seed(20260730);

  await resetData();

  const ruanganList = await seedRuangan();
  const dokterList = await seedDokter();
  const pasienList = await seedPasien(18);
  const assignments = await seedAssignments(dokterList, pasienList);
  const kunjunganList = await seedKunjungan(pasienList, dokterList, ruanganList);
  const operasiList = await seedOperasi(kunjunganList, ruanganList, pasienList);
  const penjaminList = await seedPenjamin();
  const pendapatanList = await seedPendapatan(operasiList, penjaminList);
  const { pemeriksaanLabList, totalHasilLabItem } = await seedPemeriksaanLab(
    pasienList,
    kunjunganList,
    dokterList,
    assignments
  );
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
    PemeriksaanLab: pemeriksaanLabList.length,
    HasilLabItem: totalHasilLabItem,
    Notifikasi: notifikasiList.length,
    Pengguna: penggunaList.length,
  });

  console.log("\nAkun login dummy (password sama untuk semua: Sidokmais#2026):");
  for (const p of penggunaList) {
    const namaDokter = p.dokterNamaUntukLog ? ` — ${p.dokterNamaUntukLog}` : "";
    console.log(`- ${p.username} (${p.role})${namaDokter}`);
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
