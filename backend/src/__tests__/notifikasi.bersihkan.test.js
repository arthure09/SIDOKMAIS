// Notifikasi harus dibersihkan SECARA LUNAK (update, bukan delete): pembuat
// pengingat jadwal (utils/pengingatJadwal.js) memakai keberadaan baris
// ber-`relatedId` sebagai tanda "sudah pernah dibuat". Kalau ini diubah jadi
// deleteMany, pengingat yang baru dibersihkan akan muncul lagi tanpa error.

const request = require("supertest");
const bcrypt = require("bcrypt");

jest.mock("../lib/prisma", () => ({
  pengguna: { findUnique: jest.fn() },
  notifikasi: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    createMany: jest.fn(),
  },
  operasi: { findMany: jest.fn() },
  auditLog: { create: jest.fn() },
}));

const prisma = require("../lib/prisma");
const app = require("../server");
const { sinkronkanPengingatOperasi, _resetTenggang } = require("../utils/pengingatJadwal");

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

let token;

beforeAll(async () => {
  PENGGUNA_DOKTER.passwordHash = await bcrypt.hash(PASSWORD, 10);
});

beforeEach(async () => {
  jest.clearAllMocks();
  _resetTenggang();
  prisma.pengguna.findUnique.mockResolvedValue(PENGGUNA_DOKTER);
  prisma.notifikasi.count.mockResolvedValue(0);
  prisma.notifikasi.findMany.mockResolvedValue([]);
  prisma.notifikasi.updateMany.mockResolvedValue({ count: 3 });
  prisma.operasi.findMany.mockResolvedValue([]);

  const login = await request(app)
    .post("/api/auth/login")
    .send({ username: "budi.santoso", password: PASSWORD });
  token = login.body.token;
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe("DELETE /api/notifikasi (bersihkan)", () => {
  test("menandai dibersihkan, BUKAN menghapus baris", async () => {
    const res = await request(app).delete("/api/notifikasi").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.jumlah).toBe(3);

    const [arg] = prisma.notifikasi.updateMany.mock.calls[0];
    expect(arg.where).toEqual({ dokterId: DOKTER_ID, dibersihkanPada: null });
    expect(arg.data.dibersihkanPada).toBeInstanceOf(Date);
    // Kalau modul prisma yang di-mock tidak punya deleteMany sama sekali,
    // pemakaian deleteMany akan meledak — tapi eksplisit lebih jelas.
    expect(prisma.notifikasi.deleteMany).toBeUndefined();
  });

  test("hanya menyentuh notifikasi dokter yang login", async () => {
    await request(app).delete("/api/notifikasi").set(auth());
    const [arg] = prisma.notifikasi.updateMany.mock.calls[0];
    expect(arg.where.dokterId).toBe(DOKTER_ID);
  });

  test("tercatat ke AuditLog", async () => {
    await request(app).delete("/api/notifikasi").set(auth());
    expect(prisma.auditLog.create).toHaveBeenCalled();
    const { data } = prisma.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("DELETE");
    expect(data.entityType).toBe("Notifikasi");
  });

  test("tidak ada yang perlu dibersihkan -> tanpa baris audit", async () => {
    prisma.notifikasi.updateMany.mockResolvedValue({ count: 0 });
    const res = await request(app).delete("/api/notifikasi").set(auth());
    expect(res.body.jumlah).toBe(0);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/notifikasi/read-all", () => {
  test("hanya yang belum dibaca dan belum dibersihkan", async () => {
    const res = await request(app).patch("/api/notifikasi/read-all").set(auth());

    expect(res.status).toBe(200);
    const [arg] = prisma.notifikasi.updateMany.mock.calls[0];
    expect(arg.where).toEqual({ dokterId: DOKTER_ID, isRead: false, dibersihkanPada: null });
    expect(arg.data).toEqual({ isRead: true });
  });

  test("bukan bentrok dengan /:id/read", async () => {
    // Kalau suatu saat route ini dipindah setelah `/:id/read`, "read-all" tetap
    // tidak akan tertangkap pola dua segmen — tes ini menjaga jawabannya 200,
    // bukan 404 dari pencarian notifikasi ber-id "read-all".
    const res = await request(app).patch("/api/notifikasi/read-all").set(auth());
    expect(res.status).toBe(200);
    expect(prisma.notifikasi.findUnique).not.toHaveBeenCalled();
  });
});

describe("GET /api/notifikasi", () => {
  test("yang sudah dibersihkan tidak ikut tampil", async () => {
    await request(app).get("/api/notifikasi").set(auth());
    const [arg] = prisma.notifikasi.findMany.mock.calls.at(-1);
    expect(arg.where.dibersihkanPada).toBeNull();
  });
});

describe("pengingat vs bersihkan", () => {
  test("pengingat yang sudah dibersihkan TIDAK dibuat ulang", async () => {
    prisma.operasi.findMany.mockResolvedValue([
      {
        id: "operasi-1",
        tanggalOperasi: new Date(Date.now() + 3 * 60 * 60 * 1000),
        jenisTindakan: "Mastektomi",
        ruangan: { nama: "OK 1" },
      },
    ]);
    // Barisnya masih ada, cuma sudah dibersihkan — inilah yang membuat
    // pencarian "sudah pernah dibuat" tetap menemukannya.
    prisma.notifikasi.findMany.mockResolvedValue([{ relatedId: "operasi-1" }]);

    const dibuat = await sinkronkanPengingatOperasi(DOKTER_ID, { paksa: true });

    expect(dibuat).toBe(0);
    expect(prisma.notifikasi.createMany).not.toHaveBeenCalled();
  });

  test("pencarian pengingat tidak menyaring isRead/dibersihkanPada", async () => {
    prisma.operasi.findMany.mockResolvedValue([
      {
        id: "operasi-1",
        tanggalOperasi: new Date(Date.now() + 3 * 60 * 60 * 1000),
        jenisTindakan: "Mastektomi",
        ruangan: null,
      },
    ]);
    prisma.notifikasi.findMany.mockResolvedValue([]);
    prisma.notifikasi.createMany.mockResolvedValue({ count: 1 });

    await sinkronkanPengingatOperasi(DOKTER_ID, { paksa: true });

    const [arg] = prisma.notifikasi.findMany.mock.calls[0];
    expect(arg.where.dibersihkanPada).toBeUndefined();
    expect(arg.where.isRead).toBeUndefined();
  });
});
