const {
  tanggalWIB,
  tanggalJamWIB,
  keWaktuSimrs,
  jenisKelamin,
  ruanganJenis,
  kategoriKunjungan,
  prioritasKonsul,
  statusKonsul,
  persetujuanKasus,
  diagnosaBersih,
  namaLengkap,
  teks,
} = require("../utils/simrsBentuk");
const {
  SQL_NORM_DOKTER,
  paramAkses,
  klausaAksesNorm,
  joinAksesNorm,
} = require("../utils/simrsAkses");
const { q } = require("../lib/simrs");
const { kondisiStatusEfektif } = require("../routes/simrs/operasi.routes");
const { klausaUrutan } = require("../routes/simrs/pasien.routes");
const { flagLab, gabungId, pecahId } = require("../routes/simrs/lab.routes");

// Tidak menyentuh database sama sekali: yang diuji di sini adalah bagian yang
// paling gampang salah tanpa ketahuan — konversi zona waktu dan pemetaan kode
// referensi. Salah 7 jam atau salah kode jenis kelamin tidak bikin apa pun
// error, cuma bikin layar dokter menampilkan hal yang keliru.

describe("tanggalWIB()", () => {
  it("membaca datetime SIMRS sebagai WIB, bukan waktu lokal proses", () => {
    // 14:30 WIB == 07:30 UTC. Kalau offsetnya lupa dipasang, hasilnya 14:30Z.
    expect(tanggalWIB("2026-08-21 14:30:00").toISOString()).toBe("2026-08-21T07:30:00.000Z");
  });

  it("kolom date tanpa jam jatuh ke tengah malam WIB", () => {
    expect(tanggalWIB("2026-08-21").toISOString()).toBe("2026-08-20T17:00:00.000Z");
  });

  it("zero-date MySQL dan nilai kosong jadi null, bukan Invalid Date", () => {
    expect(tanggalWIB("0000-00-00 00:00:00")).toBeNull();
    expect(tanggalWIB(null)).toBeNull();
    expect(tanggalWIB("")).toBeNull();
    expect(tanggalWIB("bukan tanggal")).toBeNull();
  });
});

describe("tanggalJamWIB()", () => {
  it("menggabung kolom date + time terpisah", () => {
    expect(tanggalJamWIB("2026-08-21", "08:00:00").toISOString()).toBe("2026-08-21T01:00:00.000Z");
  });

  it("jam kosong jatuh ke tengah malam WIB", () => {
    expect(tanggalJamWIB("2026-08-21", null).toISOString()).toBe("2026-08-20T17:00:00.000Z");
  });

  it("tanggal kosong tetap null walau jamnya ada", () => {
    expect(tanggalJamWIB(null, "08:00:00")).toBeNull();
  });
});

describe("keWaktuSimrs()", () => {
  it("kebalikan tanggalWIB — bolak-balik tidak menggeser waktu", () => {
    const asal = "2026-08-21 14:30:00";
    expect(keWaktuSimrs(tanggalWIB(asal))).toBe(asal);
  });

  it("null aman", () => {
    expect(keWaktuSimrs(null)).toBeNull();
  });
});

describe("pemetaan kode referensi SIMRS", () => {
  it("jenis kelamin: hanya 1 dan 2 yang dipetakan, sisanya null", () => {
    expect(jenisKelamin(1)).toBe("L");
    expect(jenisKelamin(2)).toBe("P");
    // Menebak lebih buruk daripada kosong — salah jenis kelamin tampil di layar.
    expect(jenisKelamin(0)).toBeNull();
    expect(jenisKelamin(3)).toBeNull();
    expect(jenisKelamin(null)).toBeNull();
  });

  it("jenis ruangan: 2=IGD, 3=Rawat Inap, sisanya rawat jalan", () => {
    expect(ruanganJenis(2)).toBe("IGD");
    expect(ruanganJenis(3)).toBe("RAWAT_INAP");
    expect(ruanganJenis(1)).toBe("POLI");
    expect(ruanganJenis(15)).toBe("POLI");
  });

  it("prioritas konsul: 800 cito, sisanya biasa", () => {
    expect(prioritasKonsul(800)).toBe("CITO");
    expect(prioritasKonsul(799)).toBe("BIASA");
    expect(prioritasKonsul(null)).toBe("BIASA");
  });

  it("status konsul: 2 sudah dijawab, 1 masih menunggu", () => {
    expect(statusKonsul(2)).toBe("SUDAH_DIJAWAB");
    expect(statusKonsul(1)).toBe("MENUNGGU_JAWABAN");
  });

  it("persetujuan kasus: 804 (tidak ditentukan) jadi null, bukan label", () => {
    expect(persetujuanKasus(805)).toBe("Setuju");
    expect(persetujuanKasus(806)).toBe("Tidak setuju");
    expect(persetujuanKasus(804)).toBeNull();
    expect(persetujuanKasus(999)).toBeNull();
  });
});

describe("teks()", () => {
  it("string kosong SIMRS diperlakukan sama dengan NULL", () => {
    // Banyak kolom SIMRS NOT NULL tanpa default, jadi 'tidak diisi' tersimpan
    // sebagai '' — API tidak boleh membedakan keduanya.
    expect(teks("")).toBeNull();
    expect(teks("   ")).toBeNull();
    expect(teks(null)).toBeNull();
    expect(teks(" Apendektomi ")).toBe("Apendektomi");
  });
});

describe("kategoriKunjungan()", () => {
  // Bug nyata: field `jenisKunjungan` sempat dikirim berisi "POLI" — itu
  // kosakata internal Ruangan.jenis, bukan kosakata publik API. Tidak ada
  // error di mana pun, frontend cuma tidak mengenali nilainya dan label
  // kategori pasien tampil kosong.
  it("memakai kosakata publik (RAWAT_JALAN), bukan POLI", () => {
    expect(kategoriKunjungan(1)).toBe("RAWAT_JALAN");
    expect(kategoriKunjungan(15)).toBe("RAWAT_JALAN");
    expect(kategoriKunjungan(2)).toBe("IGD");
    expect(kategoriKunjungan(3)).toBe("RAWAT_INAP");
  });

  it("tidak pernah membocorkan nilai enum ruangan", () => {
    for (const kode of [1, 2, 3, 15, 99]) {
      expect(kategoriKunjungan(kode)).not.toBe("POLI");
    }
  });

  it("kode kosong jadi null, bukan ditebak rawat jalan", () => {
    expect(kategoriKunjungan(null)).toBeNull();
    expect(kategoriKunjungan(undefined)).toBeNull();
  });
});

describe("kondisiStatusEfektif() — NULL-safety", () => {
  // Bug nyata & mahal: `po.status` datang dari LEFT JOIN yang sering tidak
  // ketemu pasangan (3.958 dari 4.826 baris untuk satu dokter). Dengan `=`,
  // `po.status = 0` bernilai NULL, bukan false; NULL merambat lewat NOT/AND
  // dan barisnya hilang dari SEMUA filter status sekaligus. Gejalanya cuma
  // angka yang tidak jumlah — tidak ada error sama sekali.
  const SEMUA = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

  it("membandingkan po.status selalu null-safe (<=>), tidak pernah dengan =", () => {
    for (const s of SEMUA) {
      const { sql } = kondisiStatusEfektif(s);
      expect(sql).not.toMatch(/po\.status\s*=[^>]/);
      expect(sql).not.toMatch(/po\.status\s*<>/);
    }
  });

  it("tiap status menghasilkan SQL dan jumlah parameter yang konsisten", () => {
    for (const s of SEMUA) {
      const { sql, params } = kondisiStatusEfektif(s);
      expect(sql.length).toBeGreaterThan(0);
      expect((sql.match(/\?/g) || []).length).toBe(params.length);
    }
  });
});

describe("diagnosaBersih()", () => {
  it("membuang isian sampah dari master.diagnosa_masuk", () => {
    // Ditemukan waktu tes dengan data asli: 2 dari 3 diagnosa pertama yang
    // muncul isinya "." — kartu pasien bertuliskan titik lebih buruk daripada
    // kartu tanpa diagnosa.
    expect(diagnosaBersih(".")).toBeNull();
    expect(diagnosaBersih("-")).toBeNull();
    expect(diagnosaBersih("...")).toBeNull();
    expect(diagnosaBersih("  --  ")).toBeNull();
    expect(diagnosaBersih("ca")).toBeNull(); // <= 2 karakter
  });

  it("membiarkan diagnosa sungguhan lewat", () => {
    expect(diagnosaBersih("MAMAE")).toBe("MAMAE");
    expect(diagnosaBersih(" Ca Mammae Sinistra ")).toBe("Ca Mammae Sinistra");
  });
});

describe("namaLengkap()", () => {
  it("merangkai gelar tanpa menyisakan spasi ganda", () => {
    expect(namaLengkap({ gelarDepan: "dr.", nama: "Siti", gelarBelakang: "Sp.B" })).toBe(
      "dr. Siti Sp.B"
    );
    expect(namaLengkap({ gelarDepan: null, nama: "Siti", gelarBelakang: "" })).toBe("Siti");
  });
});

describe("klausa akses DPJP", () => {
  // Invarian yang gampang rusak diam-diam: jumlah placeholder di SQL harus
  // sama dengan jumlah parameter yang disuplai paramAkses(). Kalau salah satu
  // cabang UNION ditambah/dikurangi tanpa memperbarui paramAkses, MySQL akan
  // menolak dengan pesan yang jauh dari penyebabnya.
  it("jumlah placeholder cocok dengan jumlah parameter", () => {
    const jumlahTanda = (SQL_NORM_DOKTER.match(/\?/g) || []).length;
    expect(jumlahTanda).toBe(paramAkses(123).length);
  });

  it("menggabung ketiga sumber DPJP, bukan cuma DPJP utama", () => {
    expect(SQL_NORM_DOKTER).toContain("tujuan_pasien");
    expect(SQL_NORM_DOKTER).toContain("dpjp_bersama");
    expect(SQL_NORM_DOKTER).toContain("dpjp_pendamping");
  });

  it("klausa menempel ke kolom yang diminta", () => {
    expect(klausaAksesNorm("pas.NORM").startsWith("pas.NORM IN (")).toBe(true);
  });

  // Penjaga regresi untuk masalah performa yang nyata, bukan gaya penulisan.
  // `kolom IN (<union>)` yang ditulis langsung dioptimasi MySQL jadi DEPENDENT
  // SUBQUERY — union dijalankan ulang tiap baris tabel luar. Lapisan
  // `SELECT NORM FROM (...)` itulah yang memutus korelasinya. Kalau ada yang
  // "merapikan" dan menghapus lapisan itu, daftar pasien akan tetap benar tapi
  // jadi tidak bisa dipakai di tabel pasien seukuran RS.
  it("klausa IN memakai derived table, bukan union telanjang", () => {
    expect(klausaAksesNorm("pas.NORM")).toContain("IN (SELECT NORM FROM (");
  });

  it("bentuk JOIN menautkan derived table ke kolom NORM", () => {
    const join = joinAksesNorm("pas.NORM");
    expect(join.startsWith("JOIN (")).toBe(true);
    expect(join).toContain("akses.NORM = pas.NORM");
    expect((join.match(/\?/g) || []).length).toBe(paramAkses(1).length);
  });
});

describe("urutan daftar pasien SIMRS", () => {
  // Pasien tanpa kunjungan harus selalu di bawah. MySQL menaruh NULL paling
  // awal di ASC, jadi arah "terlama" yang perlu COALESCE — arah "terbaru"
  // (DESC) sudah benar sendiri. Kalau COALESCE-nya hilang, halaman pertama
  // "terlama" isinya pasien tanpa tanggal semua.
  it("terlama menjaga pasien tanpa kunjungan di bawah", () => {
    expect(klausaUrutan("terlama")).toContain("COALESCE(");
    expect(klausaUrutan("terlama")).toContain("ASC");
  });

  it("terbaru mengurutkan menurun tanpa COALESCE", () => {
    expect(klausaUrutan("terbaru")).toContain("DESC");
    expect(klausaUrutan("terbaru")).not.toContain("COALESCE(");
  });

  // Tanpa pemecah seri, dua pasien bertanggal sama bisa bertukar posisi antar
  // halaman — satu muncul dua kali, satu lagi hilang.
  it("semua arah punya pemecah seri yang unik", () => {
    for (const arah of [undefined, "terbaru", "terlama"]) {
      expect(klausaUrutan(arah)).toContain("pas.NORM ASC");
    }
  });
});

describe("lab: pemetaan flag LIS", () => {
  // Nilai yang benar-benar ada di data: '', L, H, VL, VH. Tidak ada padanan
  // ABNORMAL — flag SIMRS selalu berupa arah.
  it("H/VH jadi TINGGI, L/VL jadi RENDAH", () => {
    expect(flagLab("H")).toBe("TINGGI");
    expect(flagLab("VH")).toBe("TINGGI");
    expect(flagLab("L")).toBe("RENDAH");
    expect(flagLab("VL")).toBe("RENDAH");
  });

  // 67% item tidak berflag. Kalau ini melempar atau balik undefined, seluruh
  // daftar hasil lab ikut rusak.
  it("kosong dan null jatuh ke NORMAL, bukan undefined", () => {
    expect(flagLab("")).toBe("NORMAL");
    expect(flagLab(null)).toBe("NORMAL");
    expect(flagLab(undefined)).toBe("NORMAL");
    expect(flagLab("  ")).toBe("NORMAL");
  });

  it("kode tak dikenal tidak pernah bocor apa adanya", () => {
    expect(flagLab("XYZ")).toBe("NORMAL");
  });
});

describe("lab: id gabungan ORDER_ID + TINDAKAN", () => {
  // id ini bolak-balik lewat URL detail. Salah pecah = 404 untuk pemeriksaan
  // yang sebenarnya ada.
  it("bolak-balik tanpa kehilangan bagian", () => {
    const id = gabungId("202608240000000000123", 4711);
    expect(pecahId(id)).toEqual({ orderId: "202608240000000000123", tindakan: 4711 });
  });

  it("dipecah dari belakang, jadi titik di ORDER_ID tidak merusak", () => {
    expect(pecahId(gabungId("2026.08.24.001", 12))).toEqual({
      orderId: "2026.08.24.001",
      tindakan: 12,
    });
  });

  it("id ngawur balik null, bukan NaN yang diam-diam masuk query", () => {
    expect(pecahId("tanpatitik")).toBeNull();
    expect(pecahId("order.bukanangka")).toBeNull();
    expect(pecahId(".12")).toBeNull();
  });
});

describe("guard read-only lib/simrs", () => {
  it("menolak statement selain SELECT sebelum menyentuh jaringan", () => {
    expect(() => q("DELETE FROM master.pasien")).toThrow(/read-only/);
    expect(() => q("UPDATE master.pasien SET NAMA = 'x'")).toThrow(/read-only/);
    expect(() => q("DROP TABLE master.pasien")).toThrow(/read-only/);
    expect(() => q("  insert into x values (1)")).toThrow(/read-only/);
  });
});
