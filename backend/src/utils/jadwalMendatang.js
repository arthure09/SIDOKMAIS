const prisma = require("../lib/prisma");
const { WIB_OFFSET_MS } = require("./wib");

// Jadwal operasi mendatang milik SATU dokter, dalam bentuk yang sama apa pun
// sumber datanya. Dipakai pembuat pengingat notifikasi (utils/pengingatJadwal).
//
// Kenapa ada modul sendiri: tabel Notifikasi SELALU di PostgreSQL (SIMRS tidak
// menyimpannya), sedangkan jadwal yang jadi bahan pengingat bisa datang dari
// PostgreSQL atau SIMRS. Jadi satu-satunya tempat di aplikasi ini yang harus
// membaca dua sumber sekaligus adalah di sini — route notifikasi sendiri tetap
// bicara ke Prisma saja.
//
// `require` versi SIMRS sengaja di dalam fungsi, bukan di puncak berkas: mode
// dummy tidak boleh ikut memuat `lib/simrs.js`, karena modul itu menuntut env
// SIMRS_* lengkap begitu poolnya dipakai. Seluruh test berjalan di mode dummy.
function pakaiSimrs() {
  return process.env.SUMBER_DATA === "simrs";
}

/** Tanggal kalender WIB ("YYYY-MM-DD") dari sebuah instant. */
function tanggalWIBdari(instant) {
  return new Date(instant.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

async function dariPostgres(dokterUuid, mulai, akhir) {
  const baris = await prisma.operasi.findMany({
    where: {
      tanggalOperasi: { gte: mulai, lte: akhir },
      status: "SCHEDULED",
      // Keterlibatan langsung, sama seperti dashboard: pengingat untuk jadwal
      // dokter lain tidak bisa ditindaklanjuti oleh yang menerimanya.
      kunjungan: { dokterId: dokterUuid },
    },
    select: {
      id: true,
      tanggalOperasi: true,
      jenisTindakan: true,
      ruangan: { select: { nama: true } },
    },
    orderBy: { tanggalOperasi: "asc" },
  });

  return baris.map((o) => ({
    id: o.id,
    waktu: o.tanggalOperasi,
    tindakan: o.jenisTindakan,
    ruangan: o.ruangan?.nama ?? null,
  }));
}

async function dariSimrs(dokterUuid, mulai, akhir) {
  const { q } = require("../lib/simrs");
  const { simrsDokterId } = require("./simrsAkses");
  const { tanggalJamWIB, teks } = require("./simrsBentuk");

  const dokterId = await simrsDokterId(dokterUuid);
  if (!dokterId) return [];

  // Penyaring identik dengan daftar Jadwal (?lingkup=saya) dan dashboard:
  // pengaju waiting list ATAU dokter bedahnya, dan operasi batal dibuang.
  const baris = await q(
    `SELECT wl.id, COALESCE(pd.tanggal_operasi, wl.tanggal) AS tgl,
            pd.jam_operasi AS jam, wl.tindakan,
            COALESCE(r.DESKRIPSI, pd.ruang_tujuan) AS ruangan
       FROM medis.tb_waiting_list_operasi wl
       LEFT JOIN medis.tb_pendaftaran_operasi pd ON pd.id = wl.id_pendaftaran_operasi
       LEFT JOIN perjanjian.penjadwalan_operasi po ON po.id_waiting_list_operasi = wl.id
       LEFT JOIN master.ruangan r ON r.ID = pd.ruang_tujuan
      WHERE (wl.id_dokter = ? OR pd.dokter_bedah = ?)
        AND NULLIF(TRIM(wl.alasan_batal), '') IS NULL
        AND NOT (po.status <=> 5)
        AND COALESCE(pd.tanggal_operasi, wl.tanggal) >= ?
        AND COALESCE(pd.tanggal_operasi, wl.tanggal) <= ?
      ORDER BY COALESCE(pd.tanggal_operasi, wl.tanggal) ASC, wl.id ASC`,
    [dokterId, dokterId, tanggalWIBdari(mulai), tanggalWIBdari(akhir)]
  );

  return baris
    .map((o) => ({
      id: String(o.id),
      waktu: tanggalJamWIB(o.tgl, o.jam),
      tindakan: teks(o.tindakan),
      ruangan: teks(o.ruangan),
    }))
    .filter((o) => o.waktu);
}

/**
 * Operasi dokter ini dari SEKARANG sampai `hariKeDepan` hari ke depan.
 * Batas bawahnya awal hari WIB, bukan jam sekarang: operasi pagi ini masih
 * relevan diingatkan sampai harinya lewat, dan SIMRS pun banyak yang hanya
 * punya tanggal tanpa jam (jatuh ke tengah malam).
 */
async function operasiMendatang(dokterUuid, hariKeDepan) {
  const sekarang = new Date();
  const mulai = new Date(`${tanggalWIBdari(sekarang)}T00:00:00+07:00`);
  const akhir = new Date(mulai.getTime() + hariKeDepan * 24 * 60 * 60 * 1000 + 86_399_000);

  return pakaiSimrs()
    ? dariSimrs(dokterUuid, mulai, akhir)
    : dariPostgres(dokterUuid, mulai, akhir);
}

module.exports = { operasiMendatang, tanggalWIBdari };
