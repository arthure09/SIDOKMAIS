// Verifikasi query modul SIMRS backend TANPA membaca satu pun baris pasien.
//
// Tiap query dijalankan dengan EXPLAIN: MySQL memvalidasi sintaks, keberadaan
// tiap tabel & kolom, dan tipe join — lalu mengembalikan rencana eksekusi,
// bukan data. Ini menangkap salah ketik nama kolom yang kalau tidak akan baru
// ketahuan saat dokter membuka layarnya.
//
// SQL di bawah adalah SALINAN dari backend/src/routes/simrs/*.js. Kalau query
// di sana berubah, perbarui di sini juga — script ini snapshot, bukan import.
require("dotenv").config();
const mysql = require("mysql2/promise");

const AKSES = `
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

const AKTIF = `
  EXISTS (SELECT 1 FROM pendaftaran.pendaftaran pa
           WHERE pa.NORM = pas.NORM AND pa.STATUS = 1)
`;

// Lab: skema `layanan`, bukan `lis`. Digerakkan dari pendaftaran.NORM lalu
// turun ke order lewat kunjungan — arah sebaliknya memaksa pemindaian order_lab.
const SUMBER_LAB = `
  FROM pendaftaran.pendaftaran pd
  JOIN pendaftaran.kunjungan k ON k.NOPEN = pd.NOMOR
  JOIN layanan.order_lab ol ON ol.KUNJUNGAN = k.NOMOR
  JOIN layanan.order_detil_lab od ON od.ORDER_ID = ol.NOMOR
`;

const KATEGORI_LAB = `
  (SELECT gl.DESKRIPSI
     FROM master.group_tindakan_lab gtl
     JOIN master.group_lab gl ON gl.ID = gtl.GROUP_LAB
    WHERE gtl.TINDAKAN = od.TINDAKAN AND gtl.STATUS = 1
    ORDER BY gl.ID ASC LIMIT 1)
`;

const WHERE_LAB = `
  pd.NORM = ?
  AND EXISTS (
    SELECT 1 FROM layanan.hasil_lab h
      JOIN master.parameter_tindakan_lab p ON p.ID = h.PARAMETER_TINDAKAN
     WHERE h.TINDAKAN_MEDIS = od.REF AND p.TINDAKAN = od.TINDAKAN
  )
  AND ol.TANGGAL <= NOW()
`;

const SUMBER_OP = `
  FROM medis.tb_waiting_list_operasi wl
  LEFT JOIN medis.tb_pendaftaran_operasi pd ON pd.id = wl.id_pendaftaran_operasi
  LEFT JOIN perjanjian.penjadwalan_operasi po ON po.id_waiting_list_operasi = wl.id
  LEFT JOIN master.pasien pas ON pas.NORM = wl.norm
  LEFT JOIN master.dokter dk ON dk.ID = wl.id_dokter
  LEFT JOIN master.pegawai pg ON pg.NIP = dk.NIP
  LEFT JOIN master.ruangan rt ON rt.ID = pd.ruang_tujuan
`;

// Rantai ke pasien lewat KUNJUNGAN, bukan tk.nopen — kolom itu kosong di 99,4%
// baris (313.227 dari 315.153).
const SUMBER_KONSUL = `
  FROM medis.tb_konsul tk
  LEFT JOIN medis.tb_konsul_jawab tj ON tj.id_konsul = tk.id AND tj.status <> 0
  LEFT JOIN pendaftaran.kunjungan k ON k.NOMOR = tk.kunjungan
  LEFT JOIN master.ruangan r ON r.ID = k.RUANGAN
  LEFT JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
  LEFT JOIN master.pasien pas ON pas.NORM = pd.NORM
  LEFT JOIN master.dokter dkp ON dkp.ID = tk.dokter_pengirim
  LEFT JOIN master.pegawai pgp ON pgp.NIP = dkp.NIP
`;

const DIAGNOSA = `
  COALESCE(
    (SELECT dd.DIAGNOSA FROM pendaftaran.dpjp_diagnosa dd
      WHERE dd.KUNJUNGAN = k.NOMOR AND dd.STATUS = 1
      ORDER BY dd.KATEGORI_DIAGNOSA ASC, dd.ID DESC LIMIT 1),
    dm.DIAGNOSA
  )`;

const D = 1; // id dokter contoh — cuma placeholder EXPLAIN, tidak menarik baris

// Radiologi: jalur ke pasien TIDAK lewat tabel order. Lihat catatan panjang di
// backend/src/routes/simrs/radiologi.routes.js — 39% hasil tidak punya baris
// order_detil_rad; induk sebenarnya `layanan.tindakan_medis`.
const SUMBER_RAD = `
  FROM pendaftaran.pendaftaran pd
  JOIN pendaftaran.kunjungan k ON k.NOPEN = pd.NOMOR
  JOIN layanan.tindakan_medis tm ON tm.KUNJUNGAN = k.NOMOR
  JOIN layanan.hasil_rad h ON h.TINDAKAN_MEDIS = tm.ID
`;

const MODALITAS_RAD = `
  (SELECT kl.KELOMPOK
     FROM master.tindakan_mapping_radiologi mp
     JOIN master.tindakan_klp_radiologi kl ON kl.ID = mp.ID_KELOMPOK
    WHERE mp.ID_TINDAKAN = tm.TINDAKAN AND mp.STATUS = 1
    ORDER BY kl.ID ASC LIMIT 1)
`;

const QUERIES = [
  ["akses DPJP (union 3 sumber)", `SELECT 1 FROM (${AKSES}) a WHERE a.NORM = ?`, [D, D, D, 1]],

  [
    // Sejak 24 Ags 2026 akses TIDAK lagi ditempel ke query ini. Menyaring satu
    // baris yang sudah ditunjuk primary key dengan himpunan seluruh pasien
    // dokter makan 1,4 detik; sekarang barisnya diambil sendiri, aksesnya
    // diperiksa terpisah oleh query berikutnya.
    "pasien: detail (lookup PK, tanpa klausa akses)",
    `SELECT pas.NORM, pas.NAMA, ${AKTIF} AS AKTIF FROM master.pasien pas
      WHERE pas.NORM = ? AND pas.STATUS = 1 LIMIT 1`,
    [1],
  ],

  [
    // Bentuk dokterPunyaAksesPasien(): mulai dari pendaftaran PASIEN ITU, bukan
    // membangun himpunan pasien dokter. Diukur 1.351 ms -> 35 ms.
    "akses satu pasien (arah dibalik: dari pendaftaran pasien)",
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
    [1, D, D, D],
  ],

  [
    "pasien: list + filter akses/search/jenis",
    `SELECT pas.NORM, pas.NAMA, ${AKTIF} AS AKTIF
       FROM master.pasien pas
       JOIN (${AKSES}) akses ON akses.NORM = pas.NORM
      WHERE pas.STATUS = 1
        AND (pas.NAMA LIKE ? OR CAST(pas.NORM AS CHAR) LIKE ?)
        AND ${AKTIF}
        AND EXISTS (SELECT 1 FROM pendaftaran.kunjungan k
                      JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
                      JOIN master.ruangan r ON r.ID = k.RUANGAN
                     WHERE pd.NORM = pas.NORM AND r.JENIS_KUNJUNGAN = 3)
      ORDER BY pas.NAMA ASC LIMIT 10 OFFSET 0`,
    [D, D, D, "%a%", "%a%"],
  ],

  [
    "pasien: puncak kunjungan per NORM (MAX + GROUP BY)",
    `SELECT pd.NORM, MAX(k.MASUK) AS MASUK
       FROM pendaftaran.kunjungan k
       JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
      WHERE pd.NORM IN (?) AND k.MASUK <= NOW()
      GROUP BY pd.NORM`,
    [1],
  ],

  [
    "pasien: detail kunjungan terpilih + diagnosa berjenjang",
    `SELECT pd.NORM, k.MASUK, r.JENIS_KUNJUNGAN, ${DIAGNOSA} AS DIAGNOSA
       FROM pendaftaran.kunjungan k
       JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
       LEFT JOIN master.ruangan r ON r.ID = k.RUANGAN
       LEFT JOIN master.diagnosa_masuk dm ON dm.ID = pd.DIAGNOSA_MASUK
      WHERE (pd.NORM, k.MASUK) IN ((?, ?))`,
    [1, "2026-01-01 00:00:00"],
  ],

  [
    "pasien: detail + riwayat kunjungan (dokter via tujuan_pasien)",
    `SELECT k.NOMOR, k.MASUK, k.KELUAR, k.BARU, k.STATUS,
            r.DESKRIPSI AS RUANGAN_NAMA, r.JENIS_KUNJUNGAN, pg.NAMA AS DOKTER_NAMA,
            ${DIAGNOSA} AS DIAGNOSA
       FROM pendaftaran.kunjungan k
       JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
       LEFT JOIN master.ruangan r ON r.ID = k.RUANGAN
       LEFT JOIN master.diagnosa_masuk dm ON dm.ID = pd.DIAGNOSA_MASUK
       LEFT JOIN pendaftaran.tujuan_pasien tp ON tp.NOPEN = k.NOPEN
       LEFT JOIN master.dokter dk ON dk.ID = tp.DOKTER
       LEFT JOIN master.pegawai pg ON pg.NIP = dk.NIP
      WHERE pd.NORM = ? ORDER BY k.MASUK DESC`,
    [1],
  ],

  [
    "operasi: list + filter status efektif + akses",
    `SELECT wl.id, wl.norm, wl.nokun, wl.tindakan, wl.diagnosis, wl.tanggal,
            wl.alasan_batal, wl.id_dokter, pd.tanggal_operasi, pd.jam_operasi,
            COALESCE(rt.DESKRIPSI, pd.ruang_tujuan) AS ruang_tujuan,
            pd.catatan_khusus, po.status AS STATUS_ALUR,
            po.waktu_operasi, pas.NAMA AS PASIEN_NAMA, pg.NAMA AS DOKTER_NAMA
       ${SUMBER_OP}
      WHERE (wl.id_dokter = ? OR wl.norm IN (SELECT NORM FROM (${AKSES}) akses))
        AND (NOT (NULLIF(TRIM(wl.alasan_batal), '') IS NOT NULL OR po.status = 0)
             AND (po.status IS NULL OR po.status <> 5)
             AND COALESCE(pd.tanggal_operasi, wl.tanggal) > ?)
        AND COALESCE(pd.tanggal_operasi, wl.tanggal) >= ?
      ORDER BY COALESCE(pd.tanggal_operasi, wl.tanggal) ASC, wl.id ASC
      LIMIT 10 OFFSET 0`,
    [D, D, D, D, "2026-08-21", "2026-08-01"],
  ],

  [
    "operasi: detail + konteks kunjungan",
    `SELECT wl.id, wl.nokun, wl.tindakan, pd.rencana_tindakan_operasi, pd.diagnosa_medis,
            k.MASUK AS KUNJUNGAN_MASUK, r.DESKRIPSI AS KUNJUNGAN_RUANGAN
       ${SUMBER_OP}
       LEFT JOIN pendaftaran.kunjungan k ON k.NOMOR = wl.nokun
       LEFT JOIN master.ruangan r ON r.ID = k.RUANGAN
      WHERE wl.id = ? LIMIT 1`,
    [1],
  ],

  [
    "pasien: filter jenis kunjungan TERAKHIR (subquery skalar)",
    `SELECT pas.NORM FROM master.pasien pas
       JOIN (${AKSES}) akses ON akses.NORM = pas.NORM
      WHERE pas.STATUS = 1
        AND (SELECT r.JENIS_KUNJUNGAN FROM pendaftaran.kunjungan k
               JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
               LEFT JOIN master.ruangan r ON r.ID = k.RUANGAN
              WHERE pd.NORM = pas.NORM ORDER BY k.MASUK DESC LIMIT 1) <=> 2
      ORDER BY pas.NAMA ASC LIMIT 10`,
    [D, D, D],
  ],

  [
    "kunjungan: list poliklinik (rentang tanggal + akses dokter)",
    `SELECT k.NOMOR, k.MASUK, k.KELUAR, k.BARU,
            r.DESKRIPSI AS RUANGAN_NAMA, r.JENIS_KUNJUNGAN,
            pas.NORM AS PASIEN_NORM, pas.NAMA AS PASIEN_NAMA,
            tp.DOKTER AS DOKTER_ID, pg.NAMA AS DOKTER_NAMA, ${DIAGNOSA} AS DIAGNOSA
       FROM pendaftaran.kunjungan k
       JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
       LEFT JOIN master.ruangan r ON r.ID = k.RUANGAN
       LEFT JOIN master.pasien pas ON pas.NORM = pd.NORM
       LEFT JOIN master.diagnosa_masuk dm ON dm.ID = pd.DIAGNOSA_MASUK
       LEFT JOIN pendaftaran.tujuan_pasien tp ON tp.NOPEN = k.NOPEN
       LEFT JOIN master.dokter dk ON dk.ID = tp.DOKTER
       LEFT JOIN master.pegawai pg ON pg.NIP = dk.NIP
      WHERE (tp.DOKTER = ? OR pd.NORM IN (SELECT NORM FROM (${AKSES}) akses))
        AND (k.KELUAR IS NOT NULL OR k.MASUK < ?)
        AND k.MASUK >= ? AND k.MASUK <= ?
      ORDER BY k.MASUK ASC LIMIT 50`,
    [D, D, D, D, "2026-08-21 00:00:00", "2026-08-18 00:00:00", "2026-08-18 23:59:59"],
  ],

  [
    "konsultasi: list + filter tujuan/status/prioritas/tanggal",
    `SELECT tk.id, tk.tanggal, tk.cito, tk.status, tk.diagnosis_kerja,
            tj.tanggal AS TANGGAL_JAWAB, pas.NORM AS PASIEN_NORM, pas.NAMA AS PASIEN_NAMA,
            tk.dokter_pengirim, pgp.NAMA AS PENGIRIM_NAMA, r.JENIS_KUNJUNGAN
       ${SUMBER_KONSUL}
      WHERE tk.status <> 0 AND tk.dokter_tujuan = ? AND tk.status = 1
        AND tk.cito = 800 AND tk.tanggal >= ? AND tk.tanggal <= ?
      ORDER BY tk.status ASC, tk.tanggal DESC LIMIT 10 OFFSET 0`,
    [D, "2026-08-01 00:00:00", "2026-08-21 23:59:59"],
  ],

  [
    "jasa medis: baris remunerasi satu periode",
    `SELECT ID_SIREMDIS, TANGGALTINDAKAN, NAMATINDAKAN, UNITPELAYANAN, JASA,
            NORM, NAMALENGKAP, CARABAYAR,
            (CARABAYAR LIKE '%JKN%' OR CARABAYAR LIKE '%BPJS%') AS IS_JKN
       FROM db_remunmedis.tb_tampilsiremdis
      WHERE ID_DOKTER = ?
        AND TANGGALTINDAKAN >= ?
        AND TANGGALTINDAKAN < DATE_ADD(?, INTERVAL 1 DAY)
      ORDER BY TANGGALTINDAKAN DESC`,
    [D, "2026-02-01 00:00:00", "2026-02-28"],
  ],

  [
    "jasa medis: daftar bulan terisi",
    `SELECT DISTINCT DATE_FORMAT(TANGGALTINDAKAN, '%Y-%m') AS bulan
       FROM db_remunmedis.tb_tampilsiremdis
      WHERE ID_DOKTER = ? AND TANGGALTINDAKAN IS NOT NULL
      ORDER BY bulan DESC`,
    [D],
  ],

  [
    "dashboard: aktivitas mingguan kunjungan (lingkup saya terlibat, unit klinis)",
    `SELECT DATE(k.MASUK) AS tgl, COUNT(*) AS n
       FROM pendaftaran.kunjungan k
       JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
       JOIN master.ruangan r ON r.ID = k.RUANGAN
       LEFT JOIN pendaftaran.tujuan_pasien tp ON tp.NOPEN = k.NOPEN
      WHERE r.JENIS_KUNJUNGAN IN (1, 2, 3, 14, 15) AND (tp.DOKTER = ?
             OR EXISTS (SELECT 1 FROM pendaftaran.dpjp_bersama db
                         WHERE db.NOPEN = k.NOPEN AND db.DOKTER = ?)
             OR EXISTS (SELECT 1 FROM pendaftaran.dpjp_pendamping dp
                         WHERE dp.NOPEN = k.NOPEN AND dp.DOKTER = ?))
        AND k.MASUK >= ? AND k.MASUK <= ?
      GROUP BY DATE(k.MASUK)`,
    [D, D, D, "2026-08-17 00:00:00", "2026-08-23 23:59:59"],
  ],

  [
    "dashboard: pasien hari ini (kunjungan UNION operasi, dedup)",
    `SELECT COUNT(*) AS n FROM (
       SELECT pd.NORM AS norm
         FROM pendaftaran.kunjungan k
         JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
         LEFT JOIN pendaftaran.tujuan_pasien tp ON tp.NOPEN = k.NOPEN
        WHERE (tp.DOKTER = ?
               OR EXISTS (SELECT 1 FROM pendaftaran.dpjp_bersama db
                           WHERE db.NOPEN = k.NOPEN AND db.DOKTER = ?)
               OR EXISTS (SELECT 1 FROM pendaftaran.dpjp_pendamping dp
                           WHERE dp.NOPEN = k.NOPEN AND dp.DOKTER = ?))
          AND k.MASUK >= ? AND k.MASUK <= ?
       UNION
       SELECT wl.norm AS norm
         FROM medis.tb_waiting_list_operasi wl
         LEFT JOIN medis.tb_pendaftaran_operasi pd ON pd.id = wl.id_pendaftaran_operasi
         LEFT JOIN perjanjian.penjadwalan_operasi po ON po.id_waiting_list_operasi = wl.id
        WHERE (wl.id_dokter = ? OR pd.dokter_bedah = ?)
          AND NULLIF(TRIM(wl.alasan_batal), '') IS NULL
          AND NOT (po.status <=> 5)
          AND COALESCE(pd.tanggal_operasi, wl.tanggal) = ?
     ) x`,
    [D, D, D, "2026-08-24 00:00:00", "2026-08-24 23:59:59", D, D, "2026-08-24"],
  ],

  [
    "dashboard: operasi hari ini (lingkup saya terlibat, batal dikecualikan)",
    `SELECT COUNT(*) AS n
       FROM medis.tb_waiting_list_operasi wl
       LEFT JOIN medis.tb_pendaftaran_operasi pd ON pd.id = wl.id_pendaftaran_operasi
       LEFT JOIN perjanjian.penjadwalan_operasi po ON po.id_waiting_list_operasi = wl.id
      WHERE (wl.id_dokter = ? OR pd.dokter_bedah = ?)
        AND NULLIF(TRIM(wl.alasan_batal), '') IS NULL
        AND NOT (po.status <=> 5)
        AND COALESCE(pd.tanggal_operasi, wl.tanggal) = ?`,
    [D, D, "2026-08-24"],
  ],

  [
    "kunjungan: operasi terkait di layar detail",
    `SELECT wl.id, COALESCE(pd.tanggal_operasi, wl.tanggal) AS tgl, pd.jam_operasi AS jam,
            po.status AS STATUS_ALUR, wl.alasan_batal AS ALASAN_BATAL
       FROM medis.tb_waiting_list_operasi wl
       LEFT JOIN medis.tb_pendaftaran_operasi pd ON pd.id = wl.id_pendaftaran_operasi
       LEFT JOIN perjanjian.penjadwalan_operasi po ON po.id_waiting_list_operasi = wl.id
      WHERE wl.nokun = ?
      ORDER BY COALESCE(pd.tanggal_operasi, wl.tanggal) DESC LIMIT 10`,
    ["1051301042608180013"],
  ],

  [
    "konsultasi: detail + jawaban",
    `SELECT tk.id, tk.dokter_tujuan, tk.konsul_yang_diminta, tk.ikhtisar_klinis,
            tk.penilaian_kasus, tk.kunjungan AS NOKUN,
            pas.JENIS_KELAMIN AS PASIEN_JK, pas.TANGGAL_LAHIR AS PASIEN_LAHIR,
            pgt.NAMA AS TUJUAN_NAMA, tj.penemuan, tj.diagnosa AS DIAGNOSA_JAWAB,
            tj.anjuran, tj.persetujuan_kasus,
            k.MASUK AS KUNJUNGAN_MASUK, r.DESKRIPSI AS KUNJUNGAN_RUANGAN
       ${SUMBER_KONSUL}
       LEFT JOIN master.dokter dkt ON dkt.ID = tk.dokter_tujuan
       LEFT JOIN master.pegawai pgt ON pgt.NIP = dkt.NIP
      WHERE tk.id = ? AND tk.status <> 0 LIMIT 1`,
    [1],
  ],

  // --- Cakupan "Jadwal saya" (lingkup=saya, default sejak 24 Ags 2026) ---
  [
    "kunjungan: lingkup=saya (terlibat di kunjungan itu)",
    `SELECT k.NOMOR
       FROM pendaftaran.kunjungan k
       JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
       LEFT JOIN pendaftaran.tujuan_pasien tp ON tp.NOPEN = k.NOPEN
      WHERE (
        tp.DOKTER = ?
        OR EXISTS (SELECT 1 FROM pendaftaran.dpjp_bersama db
                    WHERE db.NOPEN = k.NOPEN AND db.DOKTER = ?)
        OR EXISTS (SELECT 1 FROM pendaftaran.dpjp_pendamping dp
                    WHERE dp.NOPEN = k.NOPEN AND dp.DOKTER = ?)
      ) AND k.MASUK >= ? AND k.MASUK <= ?
      LIMIT 50`,
    [D, D, D, "2026-08-24 00:00:00", "2026-08-24 23:59:59"],
  ],
  [
    "operasi: lingkup=saya (pengaju atau dokter bedah)",
    `SELECT wl.id
       FROM medis.tb_waiting_list_operasi wl
       LEFT JOIN medis.tb_pendaftaran_operasi pd ON pd.id = wl.id_pendaftaran_operasi
      WHERE (wl.id_dokter = ? OR pd.dokter_bedah = ?)
      LIMIT 50`,
    [D, D],
  ],

  // --- Lab (routes/simrs/lab.routes.js) ---
  [
    "lab: hitung",
    `SELECT COUNT(*) AS total ${SUMBER_LAB} WHERE ${WHERE_LAB}`,
    [1],
  ],
  [
    "lab: daftar",
    `SELECT ol.NOMOR, ol.TANGGAL AS TGL_PERMINTAAN, od.TINDAKAN, od.REF,
            t.NAMA AS NAMA_PEMERIKSAAN,
            r.DESKRIPSI AS LABORATORIUM,
            ${KATEGORI_LAB} AS KATEGORI
       ${SUMBER_LAB}
       LEFT JOIN master.tindakan t ON t.ID = od.TINDAKAN
       LEFT JOIN master.ruangan r ON r.ID = ol.TUJUAN
      WHERE ${WHERE_LAB}
      ORDER BY ol.TANGGAL DESC
      LIMIT 20 OFFSET 0`,
    [1],
  ],
  [
    "lab: ringkasan hasil per halaman",
    `SELECT h.TINDAKAN_MEDIS AS REF, p.TINDAKAN,
            COUNT(*) AS JUMLAH,
            MAX(h.TANGGAL) AS TGL_HASIL,
            SUM(h.LIS_FLAG IS NOT NULL AND h.LIS_FLAG <> '') AS ABNORMAL
       FROM layanan.hasil_lab h
       JOIN master.parameter_tindakan_lab p ON p.ID = h.PARAMETER_TINDAKAN
      WHERE h.TINDAKAN_MEDIS IN (?)
      GROUP BY h.TINDAKAN_MEDIS, p.TINDAKAN`,
    ["0"],
  ],
  [
    "lab: detail",
    `SELECT ol.NOMOR, ol.KUNJUNGAN, ol.TANGGAL AS TGL_PERMINTAAN, ol.ALASAN,
            ol.DOKTER_ASAL, od.TINDAKAN, od.REF,
            t.NAMA AS NAMA_PEMERIKSAAN,
            r.DESKRIPSI AS LABORATORIUM,
            ${KATEGORI_LAB} AS KATEGORI,
            pd.NORM, pas.NAMA AS PASIEN_NAMA,
            pg.NAMA AS DOKTER_NAMA
       ${SUMBER_LAB}
       LEFT JOIN master.tindakan t ON t.ID = od.TINDAKAN
       LEFT JOIN master.ruangan r ON r.ID = ol.TUJUAN
       LEFT JOIN master.pasien pas ON pas.NORM = pd.NORM
       LEFT JOIN master.dokter dk ON dk.ID = ol.DOKTER_ASAL
       LEFT JOIN master.pegawai pg ON pg.NIP = dk.NIP
      WHERE ol.NOMOR = ? AND od.TINDAKAN = ?
      LIMIT 1`,
    ["0", 1],
  ],
  [
    "lab: item hasil",
    `SELECT h.ID, h.TANGGAL, p.PARAMETER, h.HASIL, h.SATUAN, h.NILAI, h.LIS_FLAG,
            p.NILAI_RUJUKAN, p.INDEKS
       FROM layanan.hasil_lab h
       JOIN master.parameter_tindakan_lab p ON p.ID = h.PARAMETER_TINDAKAN
      WHERE h.TINDAKAN_MEDIS = ? AND p.TINDAKAN = ?
      ORDER BY p.INDEKS ASC, p.PARAMETER ASC`,
    ["0", 1],
  ],
  [
    "radiologi: daftar per pasien",
    `SELECT tm.ID, tm.TANGGAL AS TGL_TINDAKAN, h.TANGGAL AS TGL_HASIL,
            t.NAMA AS NAMA_PEMERIKSAAN,
            ${MODALITAS_RAD} AS MODALITAS,
            o.CITO, r.DESKRIPSI AS UNIT,
            CHAR_LENGTH(TRIM(h.KESAN)) AS PANJANG_KESAN
       ${SUMBER_RAD}
       LEFT JOIN master.tindakan t ON t.ID = tm.TINDAKAN
       LEFT JOIN layanan.order_detil_rad od ON od.REF = tm.ID
       LEFT JOIN layanan.order_rad o ON o.NOMOR = od.ORDER_ID
       LEFT JOIN master.ruangan r ON r.ID = o.TUJUAN
      WHERE pd.NORM = ? AND tm.TANGGAL <= NOW()
      ORDER BY tm.TANGGAL DESC
      LIMIT 20 OFFSET 0`,
    [0],
  ],
  [
    "radiologi: hitung total",
    `SELECT COUNT(*) AS total ${SUMBER_RAD} WHERE pd.NORM = ? AND tm.TANGGAL <= NOW()`,
    [0],
  ],
  [
    "radiologi: detail laporan",
    `SELECT tm.ID, tm.KUNJUNGAN, tm.TANGGAL AS TGL_TINDAKAN,
            h.TANGGAL AS TGL_HASIL, h.KLINIS, h.KESAN, h.HASIL, h.DOKTER_SATU,
            t.NAMA AS NAMA_PEMERIKSAAN,
            ${MODALITAS_RAD} AS MODALITAS,
            o.CITO, o.ALASAN, o.DOKTER_ASAL,
            r.DESKRIPSI AS UNIT,
            pd.NORM, pas.NAMA AS PASIEN_NAMA,
            pgb.NAMA AS PEMBACA_NAMA, pgk.NAMA AS PEMINTA_NAMA
       FROM layanan.tindakan_medis tm
       JOIN layanan.hasil_rad h ON h.TINDAKAN_MEDIS = tm.ID
       JOIN pendaftaran.kunjungan k ON k.NOMOR = tm.KUNJUNGAN
       JOIN pendaftaran.pendaftaran pd ON pd.NOMOR = k.NOPEN
       LEFT JOIN master.tindakan t ON t.ID = tm.TINDAKAN
       LEFT JOIN layanan.order_detil_rad od ON od.REF = tm.ID
       LEFT JOIN layanan.order_rad o ON o.NOMOR = od.ORDER_ID
       LEFT JOIN master.ruangan r ON r.ID = o.TUJUAN
       LEFT JOIN master.pasien pas ON pas.NORM = pd.NORM
       LEFT JOIN master.dokter dkb ON dkb.ID = h.DOKTER_SATU
       LEFT JOIN master.pegawai pgb ON pgb.NIP = dkb.NIP
       LEFT JOIN master.dokter dkk ON dkk.ID = o.DOKTER_ASAL
       LEFT JOIN master.pegawai pgk ON pgk.NIP = dkk.NIP
      WHERE tm.ID = ?
      LIMIT 1`,
    ["0"],
  ],
];

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.SIMRS_HOST,
    port: Number(process.env.SIMRS_PORT) || 3306,
    user: process.env.SIMRS_USER,
    password: process.env.SIMRS_PASSWORD,
  });

  let gagal = 0;
  for (const [nama, sql, params] of QUERIES) {
    try {
      // EXPLAIN: validasi penuh, nol baris data.
      await conn.execute(`EXPLAIN ${sql}`, params);
      console.log(`  OK    ${nama}`);
    } catch (e) {
      gagal++;
      console.log(`  GAGAL ${nama}\n        ${e.code}: ${e.message}`);
    }
  }

  await conn.end();
  console.log(gagal === 0 ? "\nSemua query valid." : `\n${gagal} query bermasalah.`);
  process.exit(gagal === 0 ? 0 : 1);
})();
