// Verifikasi end-to-end Task 4 (Hari 7 — RBAC skeleton).
//
// CATATAN: sandbox tempat test ini dijalankan tidak punya Postgres/Docker,
// jadi prisma.pengguna di-mock dengan bentuk data persis seperti hasil seed
// (prisma/seed.js -> seedPengguna). Middleware yang dites (authenticate,
// authorize, signToken/verifyToken) adalah kode asli, tidak ada yang
// disimulasikan — hanya layer DB yang di-mock. Jalankan ulang test ini
// (atau uji manual dengan curl) melawan DB asli begitu docker-compose bisa
// jalan di mesin dev, sebagai double-check.

const request = require("supertest");
const bcrypt = require("bcrypt");

jest.mock("../lib/prisma", () => ({
  pengguna: {
    findUnique: jest.fn(),
  },
}));

const prisma = require("../lib/prisma");
const app = require("../server");
const authorize = require("../middleware/rbac.middleware");

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

beforeAll(async () => {
  const hash = await bcrypt.hash(PASSWORD, 10);
  PENGGUNA_DOKTER.passwordHash = hash;
  PENGGUNA_ADMIN.passwordHash = hash;
});

beforeEach(() => {
  prisma.pengguna.findUnique.mockImplementation(({ where }) => {
    if (where.username === "budi.santoso" || where.id === PENGGUNA_DOKTER.id) {
      return Promise.resolve(PENGGUNA_DOKTER);
    }
    if (where.username === "admin" || where.id === PENGGUNA_ADMIN.id) {
      return Promise.resolve(PENGGUNA_ADMIN);
    }
    return Promise.resolve(null);
  });
});

describe("Skenario 1-2: login DOKTER/ADMIN -> GET /api/me", () => {
  test("login DOKTER, GET /api/me balikin dokterId yang benar dari JWT", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "budi.santoso", password: PASSWORD });

    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;
    expect(typeof token).toBe("string");

    const meRes = await request(app).get("/api/me").set("Authorization", `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body).toEqual({
      id: PENGGUNA_DOKTER.id,
      dokterId: DOKTER_ID,
      role: "DOKTER",
    });
  });

  test("login ADMIN, GET /api/me balikin dokterId null", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: PASSWORD });

    const token = loginRes.body.token;
    const meRes = await request(app).get("/api/me").set("Authorization", `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body).toEqual({
      id: PENGGUNA_ADMIN.id,
      dokterId: null,
      role: "ADMIN",
    });
  });
});

describe("Skenario 3: token kosong / tidak ada", () => {
  test("tanpa header Authorization -> 401 'tidak ditemukan'", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/tidak ditemukan/i);
  });

  test("header Authorization: Bearer (tanpa token) -> 401 'tidak ditemukan'", async () => {
    const res = await request(app).get("/api/me").set("Authorization", "Bearer ");
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/tidak ditemukan/i);
  });
});

describe("Skenario 4: token invalid/expired", () => {
  test("token acak/rusak -> 401 'tidak valid atau kedaluwarsa'", async () => {
    const res = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer ini.bukan.jwt.valid");
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/tidak valid|kedaluwarsa/i);
  });
});

describe("Skenario 5: role di-exclude authorize()", () => {
  // /api/me sengaja mengizinkan kedua role yang ada (DOKTER, ADMIN), jadi
  // untuk menguji jalur 403 dites langsung terhadap authorize() dengan
  // allowedRoles yang lebih sempit (skenario realistis untuk endpoint
  // khusus admin di masa depan, mis. authorize('ADMIN') saja).
  test("role tidak termasuk allowedRoles -> 403", () => {
    const middleware = authorize("ADMIN");
    const req = { user: { id: "x", dokterId: "y", role: "DOKTER" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("req.user tidak ada (authenticate belum/kelupaan dipasang) -> 500 pesan developer-facing", () => {
    const middleware = authorize("ADMIN", "DOKTER");
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/authenticate/i) })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
