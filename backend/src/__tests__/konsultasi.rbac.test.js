// Scoping akses modul Konsultasi (Tahap 2).
//
// Yang dijaga di sini cuma satu hal, tapi hal itu inti keamanannya:
// `dokterTujuanId` SELALU dari JWT, tidak pernah dari query (CLAUDE.md Aturan
// #2). Layer DB di-mock — yang diperiksa adalah where clause yang DIKIRIM ke
// Prisma, bukan hasil query-nya. Bentuk query-nya sendiri diuji lewat smoke
// test manual ke DB asli.

const request = require("supertest");
const bcrypt = require("bcrypt");

jest.mock("../lib/prisma", () => ({
  pengguna: { findUnique: jest.fn() },
  konsultasi: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
}));

const prisma = require("../lib/prisma");
const app = require("../server");

const PASSWORD = "Sidokmais#2026";
const DOKTER_ID = "dokter-uuid-budi";
const DOKTER_LAIN_ID = "dokter-uuid-siti";

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
  prisma.konsultasi.count.mockResolvedValue(0);
  prisma.konsultasi.findMany.mockResolvedValue([]);
});

describe("GET /api/konsultasi — scoping", () => {
  it("DOKTER selalu di-scope ke dokterTujuanId miliknya sendiri", async () => {
    const token = await tokenUntuk("budi.santoso");
    const res = await request(app).get("/api/konsultasi").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(prisma.konsultasi.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ dokterTujuanId: DOKTER_ID }) })
    );
  });

  it("DOKTER tidak bisa mengintip dokter lain lewat ?dokterId= (Aturan #2)", async () => {
    const token = await tokenUntuk("budi.santoso");
    const res = await request(app)
      .get(`/api/konsultasi?dokterId=${DOKTER_LAIN_ID}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { where } = prisma.konsultasi.findMany.mock.calls[0][0];
    expect(where.dokterTujuanId).toBe(DOKTER_ID);
  });

  it("ADMIN tanpa filter melihat semua — tidak ada dokterTujuanId di where", async () => {
    const token = await tokenUntuk("admin");
    await request(app).get("/api/konsultasi").set("Authorization", `Bearer ${token}`);

    const { where } = prisma.konsultasi.findMany.mock.calls[0][0];
    expect(where.dokterTujuanId).toBeUndefined();
  });

  it("ADMIN boleh memfilter ke satu dokter tujuan", async () => {
    const token = await tokenUntuk("admin");
    await request(app)
      .get(`/api/konsultasi?dokterId=${DOKTER_LAIN_ID}`)
      .set("Authorization", `Bearer ${token}`);

    const { where } = prisma.konsultasi.findMany.mock.calls[0][0];
    expect(where.dokterTujuanId).toBe(DOKTER_LAIN_ID);
  });

  it("status/prioritas di luar whitelist ditolak 400, query tidak dijalankan", async () => {
    const token = await tokenUntuk("budi.santoso");
    for (const qs of ["status=BUKAN_STATUS", "prioritas=SANGAT_CITO"]) {
      const res = await request(app)
        .get(`/api/konsultasi?${qs}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
    }
    expect(prisma.konsultasi.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/konsultasi/:id — akses detail", () => {
  const KONSUL_ORANG_LAIN = {
    id: "konsul-1",
    dokterTujuanId: DOKTER_LAIN_ID,
    kunjungan: null,
  };

  it("403 kalau konsul ditujukan ke dokter lain — assignment pasien tidak menolong", async () => {
    prisma.konsultasi.findUnique.mockResolvedValue(KONSUL_ORANG_LAIN);
    const token = await tokenUntuk("budi.santoso");
    const res = await request(app)
      .get("/api/konsultasi/konsul-1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("200 kalau konsul ditujukan ke dokter yang login", async () => {
    prisma.konsultasi.findUnique.mockResolvedValue({ ...KONSUL_ORANG_LAIN, dokterTujuanId: DOKTER_ID });
    const token = await tokenUntuk("budi.santoso");
    const res = await request(app)
      .get("/api/konsultasi/konsul-1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.jenisKunjungan).toBeNull();
  });

  it("404 kalau tidak ada — dicek sebelum akses, bukan sesudah", async () => {
    prisma.konsultasi.findUnique.mockResolvedValue(null);
    const token = await tokenUntuk("budi.santoso");
    const res = await request(app)
      .get("/api/konsultasi/tidak-ada")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
