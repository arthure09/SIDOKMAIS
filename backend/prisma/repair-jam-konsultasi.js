// Perbaikan satu kali untuk data Kunjungan yang sudah terlanjur ada di DB.
//
// Masalah: seed lama memakai faker.date.recent/soon apa adanya, yang
// menghasilkan instant acak sepanjang 24 jam. Akibatnya ada konsultasi
// poliklinik jam 01.31 dini hari dan yang jatuh di Sabtu/Minggu.
// Seed-nya sendiri sudah diperbaiki (lihat seed-kunjungan-operasi.js), tapi
// data yang sudah tersimpan tidak ikut berubah, dan me-seed ulang akan
// menghapus seluruh Kunjungan + Operasi yang ada.
//
// Skrip ini HANYA meng-update kolom tanggalMasuk & tanggalKeluar. Tidak ada
// record dibuat/dihapus, status tidak disentuh, relasi tidak berubah.
//
// Jalankan uji coba dulu (default, tidak menulis apa pun):
//   node prisma/repair-jam-konsultasi.js
// Baru menulis kalau diberi flag eksplisit:
//   node prisma/repair-jam-konsultasi.js --tulis
const { PrismaClient } = require("@prisma/client");
const { setJamWIB, keHariKerjaWIB, rentangHariWIB } = require("../src/utils/wib");
const { KUNJUNGAN, statusEfektif } = require("../src/utils/statusJadwal");

const prisma = new PrismaClient();

const SLOT_POLI = [8, 9, 10, 11, 13, 14, 15];
const MENIT = [0, 15, 30, 45];
const DURASI = [30, 45, 60, 90];

const TULIS = process.argv.includes("--tulis");

// Deterministik berdasarkan id, bukan acak: menjalankan ulang skrip ini
// menghasilkan jadwal yang sama persis, jadi uji coba benar-benar
// mencerminkan apa yang akan ditulis.
function angkaDariId(id, salt) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i) + salt) >>> 0;
  return h;
}

const fmt = (d) =>
  d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

async function main() {
  const now = new Date();
  const semua = await prisma.kunjungan.findMany({
    select: { id: true, tanggalMasuk: true, tanggalKeluar: true, statusKunjungan: true },
    orderBy: { tanggalMasuk: "asc" },
  });

  const rencana = [];
  for (const k of semua) {
    const menit = MENIT[angkaDariId(k.id, 2) % MENIT.length];
    const hariKerja = keHariKerjaWIB(k.tanggalMasuk);

    // Untuk jadwal yang jatuh HARI INI, status tampil ditentukan oleh apakah
    // jamnya sudah lewat atau belum. Jadi slot dibatasi ke sisi yang sama
    // dengan aslinya, supaya merapikan jam tidak diam-diam mengubah
    // "Terjadwal" jadi "Berlangsung" (atau sebaliknya).
    const hariIni = rentangHariWIB(now);
    const jatuhHariIni = hariKerja >= hariIni.mulai && hariKerja <= hariIni.akhir;
    let slots = SLOT_POLI;
    if (jatuhHariIni) {
      const belumLewat = k.tanggalMasuk > now;
      slots = SLOT_POLI.filter(
        (j) => setJamWIB(hariKerja, j, menit) > now === belumLewat
      );
      // Tidak ada slot yang memenuhi (mis. sudah sore) — biarkan apa adanya.
      if (slots.length === 0) continue;
    }

    const jam = slots[angkaDariId(k.id, 1) % slots.length];
    const masukBaru = setJamWIB(hariKerja, jam, menit);
    const keluarBaru = k.tanggalKeluar
      ? new Date(masukBaru.getTime() + DURASI[angkaDariId(k.id, 3) % DURASI.length] * 60000)
      : null;

    if (masukBaru.getTime() === k.tanggalMasuk.getTime()) continue;
    rencana.push({ k, masukBaru, keluarBaru });
  }

  // Pemeriksaan keamanan: status ditampilkan diturunkan dari tanggal, jadi
  // menggeser tanggal bisa diam-diam mengubah status yang dilihat pengguna.
  // Kalau itu terjadi, berhenti — bukan itu yang diminta.
  const statusBerubah = rencana.filter(
    ({ k, masukBaru }) =>
      statusEfektif(k.tanggalMasuk, k.statusKunjungan, KUNJUNGAN, now) !==
      statusEfektif(masukBaru, k.statusKunjungan, KUNJUNGAN, now)
  );

  console.log(`Total kunjungan          : ${semua.length}`);
  console.log(`Akan diubah jadwalnya    : ${rencana.length}`);
  console.log(`Status tampil ikut geser : ${statusBerubah.length}`);

  console.log("\nContoh perubahan:");
  rencana.slice(0, 8).forEach(({ k, masukBaru }) =>
    console.log(`  ${fmt(k.tanggalMasuk)}  ->  ${fmt(masukBaru)}   [${k.statusKunjungan}]`)
  );

  if (statusBerubah.length > 0) {
    console.log("\nDIBATALKAN: perubahan di bawah ini ikut menggeser status yang tampil.");
    statusBerubah.slice(0, 10).forEach(({ k, masukBaru }) =>
      console.log(
        `  ${fmt(k.tanggalMasuk)} (${statusEfektif(k.tanggalMasuk, k.statusKunjungan, KUNJUNGAN, now)})` +
          ` -> ${fmt(masukBaru)} (${statusEfektif(masukBaru, k.statusKunjungan, KUNJUNGAN, now)})`
      )
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  if (!TULIS) {
    console.log("\n(uji coba — belum ada yang ditulis. Tambahkan --tulis untuk menerapkan.)");
    await prisma.$disconnect();
    return;
  }

  for (const { k, masukBaru, keluarBaru } of rencana) {
    await prisma.kunjungan.update({
      where: { id: k.id },
      data: { tanggalMasuk: masukBaru, tanggalKeluar: keluarBaru },
    });
  }
  console.log(`\n${rencana.length} kunjungan diperbarui.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("GAGAL:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
