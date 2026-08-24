const prisma = require("../lib/prisma");
const { operasiMendatang, tanggalWIBdari } = require("./jadwalMendatang");

// Pembuat pengingat jadwal operasi (Notifikasi tipe REMINDER_OPERASI).
//
// Kenapa perlu: sampai sebelum ini, satu-satunya notifikasi yang benar-benar
// terbentuk dari kejadian nyata adalah PERUBAHAN_JADWAL (dipicu PATCH operasi).
// Sisanya berasal dari `prisma/seed.js` — data contoh. Akibatnya dokter yang
// datanya asli dari SIMRS punya jadwal operasi mendatang tapi nol pengingat:
// akun-akun itu Dokter baru di PostgreSQL, tidak pernah ikut seed notifikasi.
// Di mode SIMRS jalur tulis operasi juga ditolak 405, jadi trigger PATCH tidak
// akan pernah jalan di sana.
//
// PATOKAN WAKTU: pengingat dibuat untuk operasi H-0 sampai H-2. Rencana awal
// magang menyebut "reminder H-1/H-2"; H-0 diikutkan karena operasi hari ini
// justru yang paling perlu terlihat, dan tanpa itu dokter yang membuka aplikasi
// di pagi hari operasi tidak melihat apa pun.
const HARI_PENGINGAT = 2;

// TIDAK MENYIMPAN IDENTITAS PASIEN. Notifikasi disimpan di PostgreSQL lokal,
// sementara pasiennya milik SIMRS — menuliskan nama/NORM ke pesan berarti
// menyalin data pasien ke basis data kedua yang tidak pernah dimaksudkan
// menyimpannya, dan tidak ikut terhapus kalau baris SIMRS-nya berubah. Yang
// disimpan cuma waktu, tindakan, dan ruangan; identitas pasien dibaca layar
// detail langsung dari sumbernya lewat `relatedId`.
function pesanPengingat({ waktu, tindakan, ruangan }, sekarang) {
  const selisihHari =
    (Date.parse(`${tanggalWIBdari(waktu)}T00:00:00Z`) -
      Date.parse(`${tanggalWIBdari(sekarang)}T00:00:00Z`)) /
    86_400_000;

  const kapan =
    selisihHari <= 0 ? "hari ini" : selisihHari === 1 ? "besok" : `${selisihHari} hari lagi`;

  const jam = new Date(waktu).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  const bagian = [`Operasi ${kapan} pukul ${jam} WIB`];
  if (tindakan) bagian.push(tindakan);
  if (ruangan) bagian.push(ruangan);

  return `${bagian.join(" — ")}.`;
}

// Poll notifikasi dari HP berjalan tiap beberapa detik (lihat
// frontend useNotifikasiHp). Tanpa rem, tiap poll menembak query jadwal ke
// SIMRS untuk hasil yang praktis tidak berubah sepanjang hari.
//
// ponytail: penanda waktu di memori proses, bukan tabel/Redis. Cukup untuk satu
// instance; kalau backend nanti dijalankan lebih dari satu proses, tiap proses
// punya remnya sendiri — paling buruk pekerjaannya terulang, bukan salah, karena
// pembuatannya tetap idempoten lewat pengecekan `relatedId` di bawah.
const TENGGANG_MS = 60_000;
const terakhirDijalankan = new Map();

/**
 * Membuat pengingat yang belum ada untuk jadwal operasi dokter ini.
 * Idempoten: satu operasi paling banyak menghasilkan satu REMINDER_OPERASI,
 * ditandai lewat `relatedId`. Aman dipanggil sesering apa pun.
 *
 * Mengembalikan jumlah pengingat yang baru dibuat (dipakai test; pemanggil di
 * route mengabaikannya).
 */
async function sinkronkanPengingatOperasi(dokterUuid, opts = {}) {
  const sekarang = new Date();

  if (!opts.paksa) {
    const terakhir = terakhirDijalankan.get(dokterUuid) ?? 0;
    if (sekarang.getTime() - terakhir < TENGGANG_MS) return 0;
  }
  terakhirDijalankan.set(dokterUuid, sekarang.getTime());

  const jadwal = await operasiMendatang(dokterUuid, HARI_PENGINGAT);
  if (jadwal.length === 0) return 0;

  // Sekali query untuk seluruh id, bukan satu per jadwal.
  const sudahAda = await prisma.notifikasi.findMany({
    where: {
      dokterId: dokterUuid,
      tipe: "REMINDER_OPERASI",
      relatedId: { in: jadwal.map((j) => j.id) },
    },
    select: { relatedId: true },
  });
  const punya = new Set(sudahAda.map((n) => n.relatedId));

  const baru = jadwal
    .filter((j) => !punya.has(j.id))
    .map((j) => ({
      dokterId: dokterUuid,
      tipe: "REMINDER_OPERASI",
      pesan: pesanPengingat(j, sekarang),
      relatedId: j.id,
      relatedType: "Operasi",
    }));

  if (baru.length === 0) return 0;

  await prisma.notifikasi.createMany({ data: baru });
  return baru.length;
}

module.exports = { sinkronkanPengingatOperasi, pesanPengingat, HARI_PENGINGAT };
// Diekspor buat test: rem waktu harus bisa dinolkan supaya dua panggilan
// berturut-turut benar-benar menguji keidempotenan, bukan remnya.
module.exports._resetTenggang = () => terakhirDijalankan.clear();
