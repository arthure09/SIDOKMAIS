const prisma = require("../lib/prisma");
const { q } = require("../lib/simrs");

// Padanan utils/aksesPasien.js untuk sumber data SIMRS.
//
// Semantiknya BEDA dan perbedaan itu disengaja. Versi dummy memakai
// DokterPasienAssignment — penugasan yang berdiri sendiri, tidak terikat waktu.
// SIMRS tidak punya tabel seperti itu; yang ada adalah DPJP per-pendaftaran.
// Akibatnya akses dokter ke seorang pasien di mode SIMRS otomatis mengikuti
// keterlibatannya di pendaftaran pasien tersebut. Secara klinis ini lebih benar
// daripada penugasan permanen, tapi berarti perilaku app ikut berubah — dokter
// tidak lagi melihat pasien yang sudah tidak dia tangani.
//
// Tiga sumber DPJP digabung, sesuai alasan yang sudah tercatat di
// utils/aksesPasien.js ("pasien onkologi sering ditangani lintas dokter"):
//   - pendaftaran.tujuan_pasien.DOKTER  -> DPJP utama (satu per NOPEN)
//   - pendaftaran.dpjp_bersama.DOKTER   -> rawat bersama
//   - pendaftaran.dpjp_pendamping.DOKTER-> dokter pendamping
//
// Dipakai sebagai subquery, bukan dimaterialisasi jadi array NORM di JS: satu
// dokter senior bisa terkait ribuan pendaftaran, dan daftar itu tidak perlu
// bolak-balik lewat aplikasi.
//
// BENTUK PENULISANNYA PENTING, bukan selera. `x IN (<union>)` yang ditulis
// langsung dioptimasi MySQL jadi DEPENDENT SUBQUERY: union-nya dijalankan ulang
// untuk SETIAP baris tabel luar. Diverifikasi lewat EXPLAIN ke replika
// (simrs-exploration/verify-queries.js) — rencana eksekusinya memindai index
// master.pasien lalu menjalankan union per baris, dan itu tidak akan selesai di
// tabel pasien sebesar RS ini.
//
// Dua bentuk aman di bawah, dua-duanya membuat union dievaluasi SEKALI:
//   - joinAksesNorm()   -> JOIN ke derived table. Dipakai kalau akses adalah
//                          satu-satunya penyaring: union jadi tabel penggerak
//                          (~ribuan baris), tabel luar tinggal lookup PK.
//   - klausaAksesNorm() -> IN (SELECT ... FROM (<union>)). Lapisan derived
//                          tambahan itu yang memutus korelasinya. Dipakai kalau
//                          akses harus di-OR dengan syarat lain, di mana JOIN
//                          tidak bisa dipakai.
//
// ponytail: mengandalkan index DOKTER di ketiga tabel + PK pendaftaran.NOMOR.
// Kalau suatu saat tetap lambat, ganti jadi tabel ringkasan yang di-refresh
// berkala — jangan tarik NORM-nya ke JS, dan jangan kembali ke IN korelasi.
const SQL_NORM_DOKTER = `
  SELECT p.NORM FROM pendaftaran.tujuan_pasien t
    JOIN pendaftaran.pendaftaran p ON p.NOMOR = t.NOPEN
   WHERE t.DOKTER = ?
  UNION
  SELECT p.NORM FROM pendaftaran.dpjp_bersama b
    JOIN pendaftaran.pendaftaran p ON p.NOMOR = b.NOPEN
   WHERE b.DOKTER = ?
  UNION
  SELECT p.NORM FROM pendaftaran.dpjp_pendamping d
    JOIN pendaftaran.pendaftaran p ON p.NOMOR = d.NOPEN
   WHERE d.DOKTER = ?
`;

// Klausa siap tempel: `WHERE ... AND ${klausaAksesNorm('wl.norm')}`.
// Menyumbang 3 parameter (simrsDokterId tiga kali) — lihat paramAkses().
// Lapisan `SELECT NORM FROM (...)` sengaja ada; tanpa itu MySQL
// mengorelasikannya per baris (lihat catatan panjang di atas).
function klausaAksesNorm(kolomNorm) {
  return `${kolomNorm} IN (SELECT NORM FROM (${SQL_NORM_DOKTER}) akses)`;
}

// JOIN siap tempel: `FROM master.pasien pas ${joinAksesNorm('pas.NORM')}`.
// Bentuk yang lebih cepat, tapi hanya cocok kalau tidak ada syarat lain yang
// perlu di-OR dengan akses. Menyumbang 3 parameter, dan karena JOIN muncul
// sebelum WHERE, parameternya harus ikut mendahului parameter WHERE.
function joinAksesNorm(kolomNorm, alias = "akses") {
  return `JOIN (${SQL_NORM_DOKTER}) ${alias} ON ${alias}.NORM = ${kolomNorm}`;
}

function paramAkses(simrsDokterId) {
  return [simrsDokterId, simrsDokterId, simrsDokterId];
}

// Jembatan identitas Postgres -> SIMRS.
//
// Model Dokter di SIDOKMAIS ber-id uuid, sementara seluruh tabel SIMRS merujuk
// dokter lewat master.dokter.ID (smallint). Penghubungnya NIP: `Dokter.nip`
// sudah @unique di schema.prisma dan master.dokter.NIP punya index sendiri —
// jadi tidak perlu kolom baru maupun perubahan bentuk JWT. req.user.dokterId
// tetap satu-satunya sumber identitas dokter, persis seperti Aturan #2
// CLAUDE.md; fungsi ini cuma menerjemahkannya, tidak pernah menerima id dari
// request.
//
// Hasilnya di-cache selamanya di memori proses: NIP seorang dokter tidak
// berubah, dan cache-nya per-proses jadi ikut bersih tiap restart.
const cacheDokter = new Map();

async function simrsDokterId(dokterUuid) {
  if (!dokterUuid) return null;
  if (cacheDokter.has(dokterUuid)) return cacheDokter.get(dokterUuid);

  const dokter = await prisma.dokter.findUnique({
    where: { id: dokterUuid },
    select: { nip: true },
  });
  if (!dokter?.nip) {
    cacheDokter.set(dokterUuid, null);
    return null;
  }

  const baris = await q("SELECT ID FROM master.dokter WHERE NIP = ? LIMIT 1", [dokter.nip]);
  const id = baris.length > 0 ? Number(baris[0].ID) : null;
  cacheDokter.set(dokterUuid, id);
  return id;
}

// Padanan dokterPunyaAksesPasien(). `norm` datang dari URL param, jadi
// dinormalkan ke angka dulu — master.pasien.NORM int(11), dan membiarkan teks
// bebas masuk ke pembanding MySQL bikin perbandingan jadi implisit.
//
// ARAHNYA PENTING, dan versi pertama fungsi ini salah di situ. Dulu bentuknya
// `SELECT 1 FROM (SQL_NORM_DOKTER) akses WHERE akses.NORM = ?` — membangun
// SELURUH himpunan pasien dokter (belasan ribu NORM, memindai ratusan ribu
// pendaftaran) cuma untuk menjawab "apakah satu NORM ini punya saya".
//
// Bentuk di bawah membalik arahnya: mulai dari pendaftaran PASIEN ITU (segelintir
// baris, `NORM` ber-index) lalu tanya apakah dokternya muncul di salah satunya.
// Diukur pada dokter dengan 8.726 pasien: 1.351 ms -> 35 ms untuk pasien miliknya,
// dan 350 ms untuk pasien dokter lain (kasus terburuk, harus memeriksa semua
// pendaftaran pasien itu sebelum menyimpulkan "tidak").
//
// Himpunan yang diperiksa tetap sama persis dengan SQL_NORM_DOKTER — tiga peran
// DPJP yang sama — jadi jawabannya identik, cuma jalannya yang berbeda. Kalau
// SQL_NORM_DOKTER berubah, fungsi ini WAJIB ikut diubah.
async function dokterPunyaAksesPasien(simrsDokterIdNum, norm) {
  const normAngka = Number(norm);
  if (!simrsDokterIdNum || !Number.isInteger(normAngka)) return false;

  const baris = await q(
    `SELECT 1 AS ada FROM pendaftaran.pendaftaran p
      WHERE p.NORM = ? AND (
        EXISTS (SELECT 1 FROM pendaftaran.tujuan_pasien t
                 WHERE t.NOPEN = p.NOMOR AND t.DOKTER = ?)
        OR EXISTS (SELECT 1 FROM pendaftaran.dpjp_bersama b
                    WHERE b.NOPEN = p.NOMOR AND b.DOKTER = ?)
        OR EXISTS (SELECT 1 FROM pendaftaran.dpjp_pendamping d
                    WHERE d.NOPEN = p.NOMOR AND d.DOKTER = ?)
      )
      LIMIT 1`,
    [normAngka, simrsDokterIdNum, simrsDokterIdNum, simrsDokterIdNum]
  );
  return baris.length > 0;
}

module.exports = {
  SQL_NORM_DOKTER,
  klausaAksesNorm,
  joinAksesNorm,
  paramAkses,
  simrsDokterId,
  dokterPunyaAksesPasien,
  // Diekspor buat test — cache proses harus bisa dikosongkan antar-case.
  _cacheDokter: cacheDokter,
};
