// Modul Jasa Medis (Tahap 4 docs/rencana-revisi-modul-dokter.md).
//
// Dua hal yang dijaga di sini:
//   1. `dokterId` DOKTER selalu dari JWT, tidak pernah dari query (Aturan #2) —
//      ini modul uang, jadi query yang salah scope berarti dokter melihat
//      penghasilan orang lain.
//   2. Ringkasan benar-benar menjumlah baris yang sama dengan yang dikirim,
//      dan cuma yang TERVERIFIKASI. Angka besar di layar yang tidak nyambung ke
//      daftarnya adalah bug yang tidak kelihatan sampai ada yang menjumlah.
//
// Layer DB di-mock: yang diperiksa adalah where clause yang dikirim ke Prisma
// dan aritmetika di atas hasilnya, bukan hasil query-nya.

const request = require("supertest");
const bcrypt = require("bcrypt");

jest.mock("../lib/prisma", () => ({
  pengguna: { findUnique: jest.fn() },
  dokter: { findUnique: jest.fn() },
  pendapatan: { findMany: jest.fn() },
}));

const prisma = require("../lib/prisma");
const app = require("../server");

const PASSWORD = "Sidokmais#2026";
const DOKTER_ID = "dokter-uuid-budi";

const PENGGUNA_DOKTER = {
  id: "pengguna-uuid-budi",
  username: "budi.santoso",
  passwordHash: null,
  role: "DOKTER",
  dokterId: DOKTER_ID,
  dokter: { id: DOKTER_ID, nama: "dr. Budi Santoso", spesialisasi: "Bedah Onkologi" },
};

const PENGGUNA_ADMIN = {
  id: "pengguna-uuid-admin",
  username: "admin",
  passwordHash: null,
  role: "ADMIN",
  dokterId: null,
  dokter: null,
};

const JKN = { nama: "BPJS/JKN", isJkn: true };
const NON_JKN = { nama: "Pribadi", isJkn: false };

function baris(jasa, penjamin, statusVerifikasi = "TERVERIFIKASI", hari = 10) {
  return {
    id: `baris-${jasa}-${statusVerifikasi}`,
    tanggalTindakan: new Date(`2026-08-${String(hari).padStart(2, "0")}T03:00:00.000Z`),
    namaTindakan: "Konsul Ruang Perawatan",
    unitPelayanan: "Rawat Inap Melati",
    jasa,
    statusVerifikasi,
    penjamin,
  };
}

const BARIS = [
  baris(1_000_000, JKN),
  baris(500_000, JKN),
  baris(300_000, NON_JKN),
  baris(700_000, JKN, "MENUNGGU"),
];

async function tokenUntuk(username) {
  const res = await request(app).post("/api/auth/login").send({ username, password: PASSWORD });
  return res.body.token;
}

beforeAll(async () => {
  const hash = await bcrypt.hash(PASSWORD, 10);
  PENGGUNA_DOKTER.passwordHash = hash;
  PENGGUNA_ADMIN.passwordHash = hash;
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.pengguna.findUnique.mockImplementation(({ where }) => {
    if (where.username === "budi.santoso" || where.id === PENGGUNA_DOKTER.id) {
      return Promise.resolve(PENGGUNA_DOKTER);
    }
    if (where.username === "admin" || where.id === PENGGUNA_ADMIN.id) {
      return Promise.resolve(PENGGUNA_ADMIN);
    }
    return Promise.resolve(null);
  });
  prisma.dokter.findUnique.mockResolvedValue({
    id: DOKTER_ID,
    nama: "dr. Budi Santoso",
    spesialisasi: "Bedah Onkologi",
  });
  // Panggilan pertama = daftar bulan (seluruh riwayat), kedua = baris periode.
  prisma.pendapatan.findMany
    .mockResolvedValueOnce(BARIS.map((b) => ({ tanggalTindakan: b.tanggalTindakan })))
    .mockResolvedValueOnce(BARIS);
});

describe("GET /api/pendapatan", () => {
  it("scope-nya dari JWT, bukan dari ?dokterId=", async () => {
    const res = await request(app)
      .get("/api/pendapatan?dokterId=dokter-uuid-orang-lain")
      .set("Authorization", `Bearer ${await tokenUntuk("budi.santoso")}`);

    expect(res.status).toBe(200);
    for (const call of prisma.pendapatan.findMany.mock.calls) {
      expect(call[0].where.dokterId).toBe(DOKTER_ID);
    }
    expect(prisma.dokter.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: DOKTER_ID } })
    );
  });

  it("ringkasan cuma menjumlah yang terverifikasi, dan bruto = JKN + Non-JKN", async () => {
    const res = await request(app)
      .get("/api/pendapatan?bulan=2026-08")
      .set("Authorization", `Bearer ${await tokenUntuk("budi.santoso")}`);

    const { ringkasan } = res.body;
    expect(ringkasan.totalJkn).toBe(1_500_000);
    expect(ringkasan.totalNonJkn).toBe(300_000);
    expect(ringkasan.totalRemunerasiBruto).toBe(1_800_000);
    // Yang MENUNGGU tidak ikut bruto, dilaporkan terpisah.
    expect(ringkasan.totalMenunggu).toBe(700_000);
    expect(ringkasan.jumlahPelayanan).toBe(4);
  });

  it("tidak mengirim identitas pasien sama sekali", async () => {
    const res = await request(app)
      .get("/api/pendapatan")
      .set("Authorization", `Bearer ${await tokenUntuk("budi.santoso")}`);

    for (const b of res.body.data) {
      expect(b).not.toHaveProperty("norm");
      expect(b).not.toHaveProperty("namaPasien");
      expect(b).not.toHaveProperty("pasien");
    }
  });

  it("menolak bulan yang formatnya salah", async () => {
    const res = await request(app)
      .get("/api/pendapatan?bulan=Agustus")
      .set("Authorization", `Bearer ${await tokenUntuk("budi.santoso")}`);

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain("bulan harus berformat YYYY-MM");
  });

  it("ADMIN wajib menyebut dokterId", async () => {
    const res = await request(app)
      .get("/api/pendapatan")
      .set("Authorization", `Bearer ${await tokenUntuk("admin")}`);

    expect(res.status).toBe(400);
    expect(prisma.pendapatan.findMany).not.toHaveBeenCalled();
  });

  it("rentang bulan dihitung dalam WIB, bukan UTC", async () => {
    await request(app)
      .get("/api/pendapatan?bulan=2026-08")
      .set("Authorization", `Bearer ${await tokenUntuk("budi.santoso")}`);

    const { gte, lt } = prisma.pendapatan.findMany.mock.calls[1][0].where.tanggalTindakan;
    // 1 Agustus 00:00 WIB = 31 Juli 17:00 UTC.
    expect(gte.toISOString()).toBe("2026-07-31T17:00:00.000Z");
    expect(lt.toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });
});
