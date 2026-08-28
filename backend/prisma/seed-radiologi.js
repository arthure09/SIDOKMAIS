// Seeder khusus modul Radiologi (mode dummy).
// Hanya menyentuh tabel PemeriksaanRadiologi — Dokter/Pasien/Kunjungan yang
// sudah ter-seed lewat seed.js TIDAK diubah. Re-runnable: tiap run menghapus
// isi tabelnya sendiri lalu generate ulang.
//
// Narasinya sengaja ditulis mendekati bentuk aslinya di SIMRS: paragraf
// temuan yang panjang, `kesan` sering kosong karena kesimpulan ditulis di
// dalam narasi, dan dokter pembaca kerap tidak tercatat. Kalau dummy-nya
// selalu rapi dan lengkap, layar yang dibuat di atasnya tidak akan pernah
// teruji menghadapi data asli yang bolong.
require("./guard-db-lokal");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TARGET = 45;

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function angka(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Unit mengikuti modalitasnya, bukan diacak: PET dikerjakan Kedokteran Nuklir,
// sisanya Radiodiagnostik. Data dummy yang menaruh "Thorax PA" di Kedokteran
// Nuklir langsung terbaca salah oleh siapa pun yang paham alurnya.
const UNIT_RADIODIAGNOSTIK = ["Radiodiagnostik Lantai 1", "Radiodiagnostik Lantai 2"];

function unitUntuk(modalitas) {
  return modalitas === "PET CT" ? "Kedokteran Nuklir" : pickOne(UNIT_RADIODIAGNOSTIK);
}

const PEMERIKSAAN = [
  {
    modalitas: "Konvensional",
    nama: "Thorax PA",
    klinis: "Batuk lama, evaluasi metastasis paru",
    hasil: `Cor: bentuk dan ukuran dalam batas normal. CTR < 50%.
Pulmo: tampak bercak infiltrat di lapangan atas paru kanan. Corakan bronkovaskular kedua paru dalam batas normal. Tidak tampak nodul metastasis.
Sinus costophrenicus kanan dan kiri lancip. Diafragma licin.
Tulang-tulang dan jaringan lunak dinding dada dalam batas normal.`,
    kesan: "Infiltrat lapangan atas paru kanan, suspek proses spesifik. Tidak tampak nodul metastasis.",
  },
  {
    modalitas: "CT Scan",
    nama: "CT Scan Thorax dengan Kontras",
    klinis: "Kanker paru, evaluasi pasca kemoterapi siklus ke-3",
    hasil: `Tampak massa solid di lobus superior paru kiri, batas sebagian tegas sebagian irreguler, ukuran 3,2 x 2,8 x 3,0 cm (sebelumnya 4,1 x 3,6 x 3,9 cm), menyangat inhomogen pasca pemberian kontras.
Tidak tampak invasi ke dinding dada maupun mediastinum.
Kelenjar getah bening paratrakeal kanan ukuran terbesar 0,9 cm, tidak membesar bermakna.
Tidak tampak efusi pleura maupun perikard.
Hepar, lien, dan kedua ginjal pada potongan yang tervisualisasi dalam batas normal.`,
    kesan: "Massa lobus superior paru kiri, mengecil dibanding pemeriksaan sebelumnya (respon parsial).",
  },
  {
    modalitas: "USG",
    nama: "USG Abdomen Atas",
    klinis: "Nyeri perut kanan atas, evaluasi metastasis hepar",
    hasil: `Hepar: ukuran normal, permukaan rata, tepi tajam, echoparenkim homogen. Tidak tampak nodul metastasis. Vena porta dan vena hepatika tidak melebar.
Kandung empedu: dinding tidak menebal, tidak tampak batu.
Pankreas dan lien: dalam batas normal.
Ginjal kanan dan kiri: ukuran normal, batas kortikomeduler jelas, tidak tampak batu maupun bendungan.
Tidak tampak cairan bebas intraabdomen.`,
    kesan: null,
  },
  {
    modalitas: "Mammografi",
    nama: "Mammografi Bilateral",
    klinis: "Benjolan payudara kanan, skrining",
    hasil: `Payudara kanan: tampak lesi hiperdens batas irreguler dengan spikulasi di kuadran lateral atas, ukuran 2,1 cm, disertai mikrokalsifikasi pleomorfik berkelompok.
Payudara kiri: densitas fibroglandular homogen, tidak tampak lesi maupun mikrokalsifikasi patologis.
Kelenjar getah bening aksila kanan tampak membesar, ukuran terbesar 1,4 cm dengan hilum menghilang.`,
    kesan: "Lesi payudara kanan kuadran lateral atas, BIRADS 5. Limfadenopati aksila kanan.",
  },
  {
    modalitas: "MRI",
    nama: "MRI Kepala dengan Kontras",
    klinis: "Nyeri kepala menetap, curiga metastasis intrakranial",
    hasil: `Tidak tampak lesi fokal dengan penyangatan patologis pada parenkim otak supra maupun infratentorial.
Sistem ventrikel dan sisterna dalam batas normal, tidak tampak pergeseran garis tengah.
Tidak tampak perdarahan maupun infark akut.
Sinus paranasalis dan mastoid kedua sisi tenang.`,
    kesan: "Tidak tampak metastasis intrakranial.",
  },
  {
    modalitas: "PET CT",
    nama: "PET CT Whole Body",
    klinis: "Restaging pasca kemoterapi",
    hasil: `Tampak peningkatan uptake FDG pada massa paru kiri dengan SUVmax 6,8 (sebelumnya 11,2).
Kelenjar getah bening mediastinum dengan uptake ringan, SUVmax 2,1, tidak melebihi ambang keganasan.
Tidak tampak uptake patologis pada hepar, tulang, maupun kelenjar adrenal.`,
    kesan: "Penurunan aktivitas metabolik massa paru kiri dibanding pemeriksaan sebelumnya.",
  },
  {
    modalitas: "Konvensional",
    nama: "BNO Polos",
    klinis: "Kembung, evaluasi ileus",
    hasil: `Distribusi udara usus tampak sampai distal. Tidak tampak dilatasi usus halus maupun air fluid level bertingkat.
Preperitoneal fat line kanan dan kiri tegas.
Tidak tampak bayangan radioopak patologis pada proyeksi traktus urinarius.
Tulang-tulang vertebra lumbosakral dan pelvis intak.`,
    kesan: null,
  },
  {
    modalitas: "CT Scan",
    nama: "CT Scan Abdomen dengan Kontras",
    klinis: "Kanker serviks, evaluasi ekstensi lokal",
    hasil: `Tampak massa serviks uteri ukuran 4,5 x 3,8 cm, menyangat inhomogen, batas dengan parametrium kanan tidak tegas.
Tidak tampak invasi ke vesica urinaria maupun rektum.
Kelenjar getah bening paraaorta ukuran terbesar 1,2 cm.
Hepar, lien, pankreas, dan kedua ginjal dalam batas normal. Tidak tampak asites.`,
    kesan: "Massa serviks uteri dengan suspek ekstensi parametrium kanan. Limfadenopati paraaorta.",
  },
];

async function main() {
  const [pasienBerdokter, dokterList] = await Promise.all([
    // Hanya pasien yang punya assignment — pasien tanpa dokter tidak akan
    // pernah bisa dibuka lewat aplikasi, jadi hasilnya cuma jadi data mati.
    prisma.pasien.findMany({
      where: { assignments: { some: {} } },
      select: { id: true },
    }),
    prisma.dokter.findMany({ select: { id: true } }),
  ]);

  if (pasienBerdokter.length === 0 || dokterList.length === 0) {
    throw new Error("Belum ada Pasien/Dokter. Jalankan `npm run prisma:seed` dulu.");
  }

  const dihapus = await prisma.pemeriksaanRadiologi.deleteMany();

  const sekarang = Date.now();
  const baris = [];

  for (let i = 0; i < TARGET; i += 1) {
    const contoh = pickOne(PEMERIKSAAN);
    const pasien = pickOne(pasienBerdokter);

    // Tersebar 1-180 hari ke belakang; jam kerja radiologi 07.00-16.00.
    const tanggalPermintaan = new Date(sekarang - angka(1, 180) * 24 * 60 * 60 * 1000);
    tanggalPermintaan.setHours(angka(7, 16), pickOne([0, 15, 30, 45]), 0, 0);

    // Hasil keluar 1-8 jam setelah pemeriksaan. Cito lebih cepat.
    const cito = Math.random() < 0.15;
    const tanggalHasil = new Date(
      tanggalPermintaan.getTime() + angka(1, cito ? 2 : 8) * 60 * 60 * 1000
    );

    baris.push({
      pasienId: pasien.id,
      dokterPemintaId: pickOne(dokterList).id,
      // Dokter pembaca sengaja sering kosong — di SIMRS cuma 7% terisi.
      dokterPembacaId: Math.random() < 0.07 ? pickOne(dokterList).id : null,
      modalitas: contoh.modalitas,
      namaPemeriksaan: contoh.nama,
      unit: Math.random() < 0.85 ? unitUntuk(contoh.modalitas) : null,
      cito,
      tanggalPermintaan,
      tanggalHasil,
      klinis: contoh.klinis,
      hasil: contoh.hasil,
      // Kesan kosong pada sebagian besar baris, meniru SIMRS (15% terisi).
      // 6/8 template punya kesan non-null, jadi ambang di sini 0.2, bukan
      // 0.15 — rate efektifnya 0.75 * 0.2 ≈ 15%.
      kesan: contoh.kesan && Math.random() < 0.2 ? contoh.kesan : null,
    });
  }

  await prisma.pemeriksaanRadiologi.createMany({ data: baris });

  const perModalitas = baris.reduce((acc, b) => {
    acc[b.modalitas] = (acc[b.modalitas] || 0) + 1;
    return acc;
  }, {});

  console.log(`\nSeed Radiologi selesai. Dihapus ${dihapus.count}, dibuat ${baris.length} row.`);
  console.table(perModalitas);
  console.log(
    `Dengan kesan terisi: ${baris.filter((b) => b.kesan).length}, ` +
      `cito: ${baris.filter((b) => b.cito).length}, ` +
      `ada dokter pembaca: ${baris.filter((b) => b.dokterPembacaId).length}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
