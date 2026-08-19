// Guard JWT_SECRET (perbaikan temuan security review, 19 Ags 2026).
//
// Yang dijaga: server GAGAL START kalau kunci penandatangan token lemah —
// kosong, terlalu pendek, atau masih placeholder yang ada di repo. Sebelum ini
// docker-compose punya nilai bawaan yang ikut ter-commit, jadi stack yang lupa
// mengisinya tetap menyala dan menerbitkan token yang bisa dipalsukan siapa pun
// yang bisa membaca repo. Seluruh isolasi antar-dokter diturunkan dari klaim
// JWT, jadi kunci yang bisa ditebak meruntuhkan semua pengecekan akses.
//
// Dites lewat require ulang modul: pengecekannya memang di level modul, supaya
// jatuh saat boot dan bukan saat login pertama.

const SECRET_ASLI = process.env.JWT_SECRET;

// File ini tidak me-require server.js, jadi dotenv tidak pernah jalan dan
// JWT_EXPIRES_IN tidak terisi — sementara signToken meneruskannya apa adanya
// ke jsonwebtoken, yang menolak `expiresIn: undefined`.
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "1d";

function muatUlangJwt(secret) {
  jest.resetModules();
  if (secret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = secret;
  return () => require("../utils/jwt");
}

afterEach(() => {
  process.env.JWT_SECRET = SECRET_ASLI;
  jest.resetModules();
});

describe("guard JWT_SECRET", () => {
  it.each([
    ["kosong", undefined],
    ["string kosong", ""],
    ["terlalu pendek", "pendek-banget"],
    ["placeholder dari .env.example", "change-me-to-a-long-random-secret"],
  ])("menolak start kalau secret %s", (_nama, secret) => {
    expect(muatUlangJwt(secret)).toThrow(/JWT_SECRET tidak valid/);
  });

  it("menerima secret acak yang cukup panjang", () => {
    const kuat = require("crypto").randomBytes(48).toString("base64");
    const jwtUtil = muatUlangJwt(kuat)();

    const token = jwtUtil.signToken({ id: "u1", dokterId: "d1", role: "DOKTER" });
    expect(jwtUtil.verifyToken(token)).toMatchObject({
      sub: "u1",
      dokterId: "d1",
      role: "DOKTER",
    });
  });

  it("menolak token yang ditandatangani kunci lain", () => {
    const kunciA = require("crypto").randomBytes(48).toString("base64");
    const kunciB = require("crypto").randomBytes(48).toString("base64");

    const token = muatUlangJwt(kunciA)().signToken({ id: "u1", dokterId: "d1", role: "ADMIN" });
    const verifierLain = muatUlangJwt(kunciB)();

    expect(() => verifierLain.verifyToken(token)).toThrow();
  });

  it("menolak token tanpa tanda tangan (alg: none)", () => {
    const kuat = require("crypto").randomBytes(48).toString("base64");
    const jwtUtil = muatUlangJwt(kuat)();

    // Token ADMIN yang dirakit tangan dengan alg "none" dan signature kosong —
    // bentuk klasik pemalsuan kalau algoritmanya tidak dipin.
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const palsu = `${b64({ alg: "none", typ: "JWT" })}.${b64({
      sub: "penyerang",
      dokterId: "dokter-korban",
      role: "ADMIN",
    })}.`;

    expect(() => jwtUtil.verifyToken(palsu)).toThrow();
  });
});
