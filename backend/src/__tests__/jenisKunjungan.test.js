const { jenisKunjungan, parseJenisKunjungan } = require("../utils/jenisKunjungan");

describe("jenisKunjungan()", () => {
  it("memetakan jenis ruangan ke kategori kunjungan", () => {
    expect(jenisKunjungan({ jenis: "POLI" })).toBe("RAWAT_JALAN");
    expect(jenisKunjungan({ jenis: "IGD" })).toBe("IGD");
    expect(jenisKunjungan({ jenis: "RAWAT_INAP" })).toBe("RAWAT_INAP");
  });

  it("null buat ruangan tanpa kategori kunjungan, bukan menebak", () => {
    expect(jenisKunjungan({ jenis: "OK" })).toBeNull();
    expect(jenisKunjungan(null)).toBeNull();
    expect(jenisKunjungan(undefined)).toBeNull();
  });
});

describe("parseJenisKunjungan()", () => {
  it("tanpa filter: lolos tanpa nilai", () => {
    expect(parseJenisKunjungan({})).toEqual({ errors: [] });
  });

  it("kategori valid diterjemahkan ke jenis ruangan", () => {
    expect(parseJenisKunjungan({ jenisKunjungan: "RAWAT_JALAN" }).ruanganJenis).toBe("POLI");
    expect(parseJenisKunjungan({ jenisKunjungan: "RAWAT_INAP" }).ruanganJenis).toBe("RAWAT_INAP");
  });

  it("menolak nilai di luar whitelist — termasuk jenis ruangan mentah", () => {
    for (const nilai of ["POLI", "OK", "rawat_jalan", "", "__proto__"]) {
      const hasil = parseJenisKunjungan({ jenisKunjungan: nilai });
      expect(hasil.errors).toHaveLength(1);
      expect(hasil.ruanganJenis).toBeUndefined();
    }
  });
});
