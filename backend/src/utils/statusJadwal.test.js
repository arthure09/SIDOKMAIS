const { OPERASI, KUNJUNGAN, statusEfektif, whereStatusEfektif } = require("./statusJadwal");

// Semua tes memakai `now` tetap supaya hasilnya tidak berubah seiring waktu —
// tanpa ini tesnya sendiri akan basi persis seperti bug yang diperbaiki.
// 12 Agu 2026 10:00 WIB = 03:00 UTC.
const NOW = new Date("2026-08-12T03:00:00.000Z");
const wib = (iso) => new Date(Date.parse(iso) - 7 * 60 * 60 * 1000);

describe("statusEfektif", () => {
  test("hari sudah lewat -> COMPLETED (kasus yang dilaporkan: 10 Agu masih Terjadwal)", () => {
    expect(statusEfektif(wib("2026-08-10T13:52:00Z"), "SCHEDULED", OPERASI, NOW)).toBe("COMPLETED");
  });

  test("hari ini & jamnya sudah lewat -> berlangsung, BUKAN selesai", () => {
    // Operasi 08:00 WIB hari ini, sekarang 10:00 WIB. Durasi tidak tersimpan
    // di mana pun, jadi tidak boleh diklaim selesai.
    expect(statusEfektif(wib("2026-08-12T08:00:00Z"), "SCHEDULED", OPERASI, NOW)).toBe("IN_PROGRESS");
    expect(statusEfektif(wib("2026-08-12T08:00:00Z"), "SCHEDULED", KUNJUNGAN, NOW)).toBe("ONGOING");
  });

  test("hari ini tapi jamnya belum tiba -> tetap SCHEDULED", () => {
    expect(statusEfektif(wib("2026-08-12T14:00:00Z"), "SCHEDULED", OPERASI, NOW)).toBe("SCHEDULED");
  });

  test("masih di depan -> tetap SCHEDULED", () => {
    expect(statusEfektif(wib("2026-08-16T09:20:00Z"), "SCHEDULED", OPERASI, NOW)).toBe("SCHEDULED");
  });

  test("COMPLETED & CANCELLED tidak pernah diturunkan ulang", () => {
    // Operasi batal yang harinya sudah lewat harus tetap "Batal", bukan
    // berubah jadi "Selesai" — itu akan menghapus informasi.
    expect(statusEfektif(wib("2026-08-01T09:00:00Z"), "CANCELLED", OPERASI, NOW)).toBe("CANCELLED");
    expect(statusEfektif(wib("2026-09-01T09:00:00Z"), "COMPLETED", OPERASI, NOW)).toBe("COMPLETED");
  });

  test("IN_PROGRESS yang harinya sudah lewat ikut jadi COMPLETED", () => {
    expect(statusEfektif(wib("2026-08-05T09:00:00Z"), "IN_PROGRESS", OPERASI, NOW)).toBe("COMPLETED");
  });

  test("batas tengah malam WIB, bukan UTC", () => {
    // 00:30 WIB hari ini = 17:30 UTC KEMARIN. Kalau batasnya pakai hari UTC,
    // record ini salah dihitung sebagai "hari sudah lewat".
    expect(statusEfektif(wib("2026-08-12T00:30:00Z"), "SCHEDULED", OPERASI, NOW)).toBe("IN_PROGRESS");
    // 23:30 WIB kemarin -> harinya memang sudah lewat.
    expect(statusEfektif(wib("2026-08-11T23:30:00Z"), "SCHEDULED", OPERASI, NOW)).toBe("COMPLETED");
  });
});

describe("whereStatusEfektif menyeleksi hal yang sama dengan statusEfektif", () => {
  // Kalau dua fungsi ini pernah tidak sinkron, list dan filter jadi
  // bertentangan — persis jenis bug yang sedang diperbaiki. Jadi keduanya
  // diuji terhadap dataset yang sama.
  const cocok = (where, tanggal, status) => {
    const kondisi = where.OR ?? [where];
    return kondisi.some((c) => {
      const s = c.status;
      const okStatus = typeof s === "string" ? status === s : s.in.includes(status);
      const rentang = c.tanggalOperasi;
      if (!rentang) return okStatus;
      if (rentang.lt !== undefined && !(tanggal < rentang.lt)) return false;
      if (rentang.gt !== undefined && !(tanggal > rentang.gt)) return false;
      if (rentang.gte !== undefined && !(tanggal >= rentang.gte)) return false;
      if (rentang.lte !== undefined && !(tanggal <= rentang.lte)) return false;
      return okStatus;
    });
  };

  const data = [
    [wib("2026-08-10T13:52:00Z"), "SCHEDULED"],
    [wib("2026-08-12T08:00:00Z"), "SCHEDULED"],
    [wib("2026-08-12T14:00:00Z"), "SCHEDULED"],
    [wib("2026-08-16T09:20:00Z"), "SCHEDULED"],
    [wib("2026-08-05T09:00:00Z"), "IN_PROGRESS"],
    [wib("2026-08-01T09:00:00Z"), "CANCELLED"],
    [wib("2026-09-01T09:00:00Z"), "COMPLETED"],
  ];

  test.each(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])("filter %s", (filter) => {
    const where = whereStatusEfektif(filter, OPERASI, NOW);
    for (const [tanggal, tersimpan] of data) {
      const efektif = statusEfektif(tanggal, tersimpan, OPERASI, NOW);
      expect(cocok(where, tanggal, tersimpan)).toBe(efektif === filter);
    }
  });
});
