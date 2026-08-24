require("./guard-db-lokal");
require("dotenv").config();

const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
const { PrismaClient } = require("@prisma/client");

// Membuat akun login LOKAL yang tertaut ke dokter asli di SIMRS.
//
// Yang perlu dipahami: ini TIDAK memakai autentikasi SIMRS. Password di sini
// password aplikasi SIDOKMAIS, disimpan (ter-hash) di PostgreSQL lokal. Yang
// "mengikuti SIMRS" cuma IDENTITAS-nya — kolom `nip`, yang jadi jembatan ke
// master.dokter.ID waktu SUMBER_DATA=simrs. Aplikasi ini tidak pernah
// mengirim kredensial apa pun ke SIMRS.
//
// Beda dari prisma/seed.js: skrip ini TIDAK menghapus apa pun. Akun dummy lama
// tetap ada (di mode simrs mereka akan dapat 403 karena NIP-nya tidak dikenal
// SIMRS — itu perilaku yang benar, bukan bug).
//
// Pakai:
//   node prisma/seed-dokter-simrs.js                 -> 5 dokter dengan DPJP terbanyak
//   node prisma/seed-dokter-simrs.js 19730913 ...    -> NIP tertentu
//
// PERINGATAN: `npm run prisma:seed` menghapus seluruh tabel. Kalau dijalankan
// setelah ini, akun-akun di bawah ikut hilang dan skrip ini perlu diulang.

const PASSWORD = process.env.SEED_PASSWORD || "Sidokmais#2026";
const JUMLAH_DEFAULT = 5;

// Ambang DPJP: dokter dengan sedikit sekali pendaftaran bikin layar kosong dan
// tidak berguna untuk uji coba. Bukan soal benar/salah, cuma soal kepakaian.
const MIN_DPJP = 20;

function bersih(s) {
  return (s || "").trim().replace(/\s+/g, " ");
}

// Nama SIMRS ditulis huruf besar semua ("AGUS SUSANTO KOSASIH"), sementara app
// menampilkannya apa adanya. Dijadikan Title Case supaya tidak berteriak di UI.
function rapikanNama(nama) {
  return bersih(nama)
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

// username dari dua kata pertama nama: "Iskandar Budi" -> "iskandar.budi".
// Gelar dibuang karena bukan bagian dari nama orangnya.
function bikinUsername(nama) {
  const kata = bersih(nama)
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(" ")
    .filter((w) => w.length > 1);
  return kata.slice(0, 2).join(".") || "dokter";
}

async function main() {
  const nipDiminta = process.argv.slice(2).filter((a) => !a.startsWith("-"));

  const simrs = await mysql.createConnection({
    host: process.env.SIMRS_HOST,
    port: Number(process.env.SIMRS_PORT) || 3306,
    user: process.env.SIMRS_USER,
    password: process.env.SIMRS_PASSWORD,
  });

  // Hanya kolom identitas pegawai yang diambil — tidak ada satu pun kolom
  // pasien di query ini. JML_DPJP cuma angka agregat, dipakai buat mengurutkan.
  const dasar = `
    SELECT d.ID, d.NIP, pg.NAMA, pg.GELAR_DEPAN, pg.GELAR_BELAKANG,
           COUNT(DISTINCT t.NOPEN) AS JML_DPJP
      FROM master.dokter d
      JOIN master.pegawai pg ON pg.NIP = d.NIP
      JOIN pendaftaran.tujuan_pasien t ON t.DOKTER = d.ID
     WHERE d.STATUS = 1 AND pg.STATUS = 1`;

  let baris;
  if (nipDiminta.length > 0) {
    const slot = nipDiminta.map(() => "?").join(",");
    [baris] = await simrs.execute(
      `${dasar} AND d.NIP IN (${slot}) GROUP BY d.ID, d.NIP, pg.NAMA, pg.GELAR_DEPAN, pg.GELAR_BELAKANG`,
      nipDiminta
    );
    const ketemu = new Set(baris.map((b) => String(b.NIP)));
    for (const nip of nipDiminta) {
      if (!ketemu.has(nip)) console.warn(`  ! NIP ${nip} tidak ada di master.dokter (dilewati)`);
    }
  } else {
    [baris] = await simrs.execute(
      `${dasar} GROUP BY d.ID, d.NIP, pg.NAMA, pg.GELAR_DEPAN, pg.GELAR_BELAKANG
        HAVING JML_DPJP >= ? ORDER BY JML_DPJP DESC LIMIT ?`,
      [MIN_DPJP, JUMLAH_DEFAULT]
    );
  }

  await simrs.end();

  if (baris.length === 0) {
    throw new Error("Tidak ada dokter yang cocok — cek NIP-nya, atau jalankan tanpa argumen.");
  }

  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const hasil = [];

  for (const b of baris) {
    const nip = String(b.NIP);
    const nama = [bersih(b.GELAR_DEPAN), rapikanNama(b.NAMA), bersih(b.GELAR_BELAKANG)]
      .filter(Boolean)
      .join(" ");

    // upsert lewat `nip`: menjalankan ulang skrip ini memperbarui, bukan
    // menggandakan. `spesialisasi` dibiarkan null — SMF di SIMRS berupa kode
    // dan tabel referensinya belum dipetakan (§4 no.20).
    const dokter = await prisma.dokter.upsert({
      where: { nip },
      update: { nama, statusAktif: true },
      create: { nip, nama, statusAktif: true },
    });

    // username harus unik; kalau bentrok, tambahkan angka di belakang.
    let username = bikinUsername(b.NAMA);
    const punyaAkun = await prisma.pengguna.findUnique({ where: { dokterId: dokter.id } });
    if (!punyaAkun) {
      let n = 1;
      while (await prisma.pengguna.findUnique({ where: { username } })) {
        username = `${bikinUsername(b.NAMA)}${++n}`;
      }
      await prisma.pengguna.create({
        data: { username, passwordHash, role: "DOKTER", dokterId: dokter.id },
      });
    } else {
      username = punyaAkun.username;
      await prisma.pengguna.update({ where: { id: punyaAkun.id }, data: { passwordHash } });
    }

    hasil.push({ username, nama, nip, simrsId: b.ID, pendaftaran: Number(b.JML_DPJP) });
  }

  await prisma.$disconnect();

  console.log(`\n${hasil.length} akun dokter tertaut ke SIMRS (password: ${PASSWORD}):\n`);
  console.table(
    hasil.map((h) => ({
      username: h.username,
      nama: h.nama,
      NIP: h.nip,
      "ID SIMRS": h.simrsId,
      pendaftaran: h.pendaftaran,
    }))
  );
  console.log(
    "\nAkun ini baru menampilkan data SIMRS kalau SUMBER_DATA=simrs di backend/.env.\n" +
      "Di mode dummy mereka tetap bisa login, tapi datanya kosong (belum ada assignment lokal).\n"
  );
}

main().catch((e) => {
  console.error("Gagal:", e.message);
  process.exit(1);
});
