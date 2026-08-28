// Script verifikasi manual, bukan bagian dari test suite Jest (nama file
// sengaja tanpa akhiran .test.js). Jalankan: node src/__tests__/verify-auth.manual.js
//
// Prisma di-mock dengan bentuk data persis seperti hasil prisma/seed.js ->
// seedPengguna(). Middleware yang diuji (authenticate, authorize,
// signToken/verifyToken) adalah kode asli dari src/, hanya layer DB diganti.

const path = require("path");
const bcrypt = require("bcrypt");
const request = require("supertest");

// Untuk menguji middleware auth/rbac tanpa DB nyata, inject fake module ke
// require.cache SEBELUM lib/prisma.js sempat dieksekusi, supaya
// `new PrismaClient()` tidak pernah dipanggil di proses ini.
const prismaModulePath = require.resolve("../lib/prisma");
const prisma = { pengguna: { findUnique: async () => null } };
require.cache[prismaModulePath] = {
  id: prismaModulePath,
  filename: prismaModulePath,
  loaded: true,
  exports: prisma,
};

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

async function main() {
  const results = [];
  function check(name, cond, detail) {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? "PASS" : "FAIL"} - ${name}${detail ? " :: " + detail : ""}`);
  }

  const hash = await bcrypt.hash(PASSWORD, 10);
  PENGGUNA_DOKTER.passwordHash = hash;
  PENGGUNA_ADMIN.passwordHash = hash;

  // Isi implementasi mock findUnique (module fake sudah di-inject di atas).
  prisma.pengguna.findUnique = async ({ where }) => {
    if (where.username === "budi.santoso" || where.id === PENGGUNA_DOKTER.id) return PENGGUNA_DOKTER;
    if (where.username === "admin" || where.id === PENGGUNA_ADMIN.id) return PENGGUNA_ADMIN;
    return null;
  };

  const app = require("../server");
  const authorize = require("../middleware/rbac.middleware");

  // Skenario 1: login DOKTER -> GET /api/me
  {
    const loginRes = await request(app).post("/api/auth/login").send({ username: "budi.santoso", password: PASSWORD });
    check("login DOKTER -> 200 + token", loginRes.status === 200 && typeof loginRes.body.token === "string");
    const token = loginRes.body.token;

    const meRes = await request(app).get("/api/me").set("Authorization", `Bearer ${token}`);
    check(
      "GET /api/me (DOKTER) -> 200, dokterId benar dari JWT",
      meRes.status === 200 &&
        meRes.body.dokterId === DOKTER_ID &&
        meRes.body.id === PENGGUNA_DOKTER.id &&
        meRes.body.role === "DOKTER",
      JSON.stringify(meRes.body)
    );
  }

  // Skenario 2: login ADMIN -> GET /api/me (dokterId null)
  {
    const loginRes = await request(app).post("/api/auth/login").send({ username: "admin", password: PASSWORD });
    const token = loginRes.body.token;
    const meRes = await request(app).get("/api/me").set("Authorization", `Bearer ${token}`);
    check(
      "GET /api/me (ADMIN) -> 200, dokterId null",
      meRes.status === 200 && meRes.body.dokterId === null && meRes.body.role === "ADMIN",
      JSON.stringify(meRes.body)
    );
  }

  // Skenario 3: token kosong / tidak ada
  {
    const res1 = await request(app).get("/api/me");
    check(
      "tanpa header Authorization -> 401 'tidak ditemukan'",
      res1.status === 401 && /tidak ditemukan/i.test(res1.body.message),
      JSON.stringify(res1.body)
    );

    const res2 = await request(app).get("/api/me").set("Authorization", "Bearer ");
    check(
      "'Bearer ' tanpa token -> 401 'tidak ditemukan'",
      res2.status === 401 && /tidak ditemukan/i.test(res2.body.message),
      JSON.stringify(res2.body)
    );
  }

  // Skenario 4: token invalid/rusak
  {
    const res = await request(app).get("/api/me").set("Authorization", "Bearer ini.bukan.jwt.valid");
    check(
      "token rusak -> 401 'tidak valid atau kedaluwarsa'",
      res.status === 401 && /tidak valid|kedaluwarsa/i.test(res.body.message),
      JSON.stringify(res.body)
    );
  }

  // Skenario 4b: token expired (JWT_EXPIRES_IN dipaksa -1s)
  {
    const jwt = require("jsonwebtoken");
    const expiredToken = jwt.sign({ sub: "x", dokterId: null, role: "ADMIN" }, process.env.JWT_SECRET, {
      expiresIn: "-10s",
    });
    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${expiredToken}`);
    check(
      "token kedaluwarsa -> 401 'tidak valid atau kedaluwarsa'",
      res.status === 401 && /tidak valid|kedaluwarsa/i.test(res.body.message),
      JSON.stringify(res.body)
    );
  }

  // Skenario 5: role di-exclude authorize() -> 403
  // /api/me sengaja allow kedua role yang ada (DOKTER, ADMIN), jadi jalur
  // 403 dites langsung ke authorize() dengan allowedRoles lebih sempit
  // (skenario realistis untuk endpoint khusus-admin di masa depan).
  {
    const middleware = authorize("ADMIN");
    const req = { user: { id: "x", dokterId: "y", role: "DOKTER" } };
    let statusCode, body;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    };
    let nextCalled = false;
    middleware(req, res, () => (nextCalled = true));
    check("role tidak diizinkan -> 403, next() tidak dipanggil", statusCode === 403 && !nextCalled, JSON.stringify(body));
  }

  // Skenario 6: authenticate belum jalan (req.user tidak ada) -> 500 dev message
  {
    const middleware = authorize("ADMIN", "DOKTER");
    const req = {};
    let statusCode, body;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    };
    let nextCalled = false;
    middleware(req, res, () => (nextCalled = true));
    check(
      "req.user tidak ada -> 500 pesan developer-facing soal urutan middleware",
      statusCode === 500 && !nextCalled && /authenticate/i.test(body.message || ""),
      JSON.stringify(body)
    );
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} skenario PASS`);
  if (failed.length > 0) {
    console.log("Skenario gagal:", failed.map((f) => f.name));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
