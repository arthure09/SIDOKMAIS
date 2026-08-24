// Kirim satu notifikasi uji ke seorang dokter, untuk menguji apakah notifikasi
// benar-benar sampai ke tray HP.
//
// Pakai:
//   node prisma/kirim-notifikasi-uji.js iskandar
//   node prisma/kirim-notifikasi-uji.js iskandar "Pesan bebas di sini"
//
// URUTAN YANG BENAR — kalau terbalik, tidak akan muncul apa pun dan bukan
// karena rusak:
//   1. Buka app di HP, login sebagai dokter itu, BIARKAN TERBUKA di layar.
//   2. Baru jalankan skrip ini.
// Alasannya ada di useNotifikasiHp: notifikasi yang SUDAH ADA saat app dibuka
// dianggap "sudah dilihat" (baseline), jadi hanya yang lahir setelah app
// terbuka yang dimunculkan ke tray.
//
// Notifikasi ini nyata, bukan mock — ikut tampil di tab Notifikasi dan bisa
// dihapus lewat tombol Bersihkan.
require("./guard-db-lokal");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const [username, pesanArg] = process.argv.slice(2);

  if (!username) {
    throw new Error(
      "Sebutkan username dokternya. Contoh: node prisma/kirim-notifikasi-uji.js iskandar"
    );
  }

  const pengguna = await prisma.pengguna.findUnique({
    where: { username },
    include: { dokter: { select: { id: true, nama: true } } },
  });

  if (!pengguna?.dokter) {
    throw new Error(`Akun "${username}" tidak ada atau tidak tertaut ke Dokter.`);
  }

  const waktu = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  const notifikasi = await prisma.notifikasi.create({
    data: {
      dokterId: pengguna.dokter.id,
      // PASIEN_BARU dipilih supaya jelas ini bukan pengingat jadwal: tipe
      // REMINDER_OPERASI dipakai generator dan dikenali lewat relatedId —
      // menyisipkan yang palsu ke sana bisa membuat pengingat asli untuk
      // operasi itu tidak pernah dibuat.
      tipe: "PASIEN_BARU",
      pesan: pesanArg ?? `Notifikasi uji dikirim pukul ${waktu} WIB.`,
      isRead: false,
    },
  });

  console.log(`\nTerkirim ke ${pengguna.dokter.nama} (${username}).`);
  console.log(`  id    : ${notifikasi.id}`);
  console.log(`  pesan : ${notifikasi.pesan}`);
  console.log(
    "\nApp harus SEDANG TERBUKA di HP. Jeda polling: ~10 detik (mode dev)," +
      " ~60 detik (build rilis)."
  );
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
