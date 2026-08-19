// Field laporan operasi — Tahap 3 docs/rencana-revisi-modul-dokter.md.
//
// Satu tabel dipakai untuk dua hal sekaligus: validasi body PATCH dan
// penyaringan respons GET detail. Menambah field laporan baru cukup di sini,
// tidak perlu menyentuh route-nya.
//
// Aturan tampil (keputusan terkunci): laporan lengkap HANYA dikirim untuk
// operasi yang status efektifnya COMPLETED. Terjadwal/berlangsung/dibatalkan
// cuma dapat info jadwal — laporan yang belum ada tidak boleh kelihatan
// setengah jadi, dan operasi batal tidak punya laporan sama sekali.

const SIFAT_OPERASI = ["ELEKTIF", "CITO"];
const JENIS_PEMBEDAHAN = ["BERSIH", "BERSIH_TERKONTAMINASI", "KONTAMINASI", "KOTOR"];

// Nilai = tipe primitif ("string"/"int"/"boolean"/"date") atau array pilihan enum.
const LAPORAN_FIELDS = {
  dokterOperator: "string",
  asistenOperator: "string",
  perawatInstrumentator: "string",
  perawatSirkuler: "string",
  dokterAnestesi: "string",
  jenisAnestesi: "string",
  kategoriOperasi: "string",

  diagnosaPraBedah: "string",
  diagnosaPascaBedah: "string",

  jamMulaiInsisi: "date",
  jamSelesai: "date",

  sifatOperasi: SIFAT_OPERASI,
  jenisPembedahan: JENIS_PEMBEDAHAN,
  antibiotikProfilaksis: "boolean",

  teknikAnestesiLokal: "string",
  lokasiAnestesi: "string",
  obatAnestesi: "string",
  responHipersensitivitas: "string",
  kejadianToksikasi: "string",

  tindakanDilakukan: "string",
  deskripsiOperasi: "string",

  komplikasi: "string",
  jumlahKehilanganDarah: "int",
  transfusi: "string",
  spesimen: "string",
  pemasanganImplan: "string",
};

const NAMA_FIELD_LAPORAN = Object.keys(LAPORAN_FIELDS);

function validateNilai(field, tipe, nilai) {
  if (Array.isArray(tipe)) {
    if (!tipe.includes(nilai)) return { error: `${field} harus salah satu dari: ${tipe.join(", ")}` };
    return { nilai };
  }
  if (tipe === "string") {
    if (typeof nilai !== "string" || !nilai.trim()) return { error: `${field} harus string tidak kosong` };
    return { nilai: nilai.trim() };
  }
  if (tipe === "int") {
    if (!Number.isInteger(nilai) || nilai < 0) return { error: `${field} harus bilangan bulat >= 0` };
    return { nilai };
  }
  if (tipe === "boolean") {
    if (typeof nilai !== "boolean") return { error: `${field} harus boolean` };
    return { nilai };
  }
  // date
  if (typeof nilai !== "string" || Number.isNaN(Date.parse(nilai))) {
    return { error: `${field} harus tanggal ISO yang valid` };
  }
  return { nilai: new Date(nilai) };
}

/**
 * Ambil field laporan dari body PATCH.
 *
 * `null` eksplisit diterima sebagai "kosongkan field" — sync dari SIMRS bisa
 * mencabut nilai yang sebelumnya terisi, dan itu beda artinya dari tidak
 * mengirim field sama sekali.
 */
function parseLaporanBody(body) {
  const errors = [];
  const data = {};

  for (const [field, tipe] of Object.entries(LAPORAN_FIELDS)) {
    const nilai = body[field];
    if (nilai === undefined) continue;
    if (nilai === null) {
      data[field] = null;
      continue;
    }

    const hasil = validateNilai(field, tipe, nilai);
    if (hasil.error) errors.push(hasil.error);
    else data[field] = hasil.nilai;
  }

  return { errors, data };
}

/** Salinan record tanpa field laporan — dipakai kalau operasinya belum selesai. */
function tanpaLaporan(operasi) {
  const bersih = { ...operasi };
  for (const field of NAMA_FIELD_LAPORAN) delete bersih[field];
  return bersih;
}

module.exports = {
  SIFAT_OPERASI,
  JENIS_PEMBEDAHAN,
  LAPORAN_FIELDS,
  NAMA_FIELD_LAPORAN,
  parseLaporanBody,
  tanpaLaporan,
};
