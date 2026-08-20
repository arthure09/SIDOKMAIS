// Pembentukan `where` di GET /api/kunjungan.
//
// Yang dijaga: klausa filter dan klausa scoping akses tidak boleh saling
// menimpa. Sebelum dipindah ke AND, keduanya di-spread ke satu objek —
// whereStatusEfektif("COMPLETED") menghasilkan kunci `OR`, dan scoping akses
// dokter juga `OR`, jadi yang belakangan menghapus yang duluan TANPA error.
// Akibatnya dokter yang memfilter "Selesai" diam-diam menerima semua status.
//
// Layer DB di-mock: yang diperiksa where clause yang DIKIRIM ke Prisma, bukan
// hasil query-nya (pola sama dengan konsultasi.rbac.test.js).

const request = require("supertest");
const bcrypt = require("bcrypt");

jest.mock("../lib/prisma", () => ({
  pengguna: { findUnique: jest.fn() },
  kunjungan: { count: jest.fn(), findMany: jest.fn() },
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

async function loginDokter() {
  prisma.pengguna.findUnique.mockResolvedValue(PENGGUNA_DOKTER);
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: PENGGUNA_DOKTER.username, password: PASSWORD });
  return res.body.token;
}

/** Semua klausa `where` yang dikirim ke prisma.kunjungan.findMany. */
function klausaTerakhir() {
  const { where } = prisma.kunjungan.findMany.mock.calls.at(-1)[0];
  return where.AND ?? [];
}

beforeAll(async () => {
  PENGGUNA_DOKTER.passwordHash = await bcrypt.hash(PASSWORD, 10);
});

beforeEach(() => {
  prisma.kunjungan.count.mockResolvedValue(0);
  prisma.kunjungan.findMany.mockResolvedValue([]);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/kunjungan — pembentukan where", () => {
  test("filter status COMPLETED dan scoping akses dokter dua-duanya ikut terkirim", async () => {
    const token = await loginDokter();

    const res = await request(app)
      .get("/api/kunjungan?status=COMPLETED")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);

    const klausa = klausaTerakhir();

    // Scoping akses: dokter dari JWT, bukan dari query (CLAUDE.md Aturan #2).
    const scoping = klausa.find((k) =>
      k.OR?.some((cabang) => cabang.dokterId === DOKTER_ID)
    );
    expect(scoping).toBeDefined();

    // Klausa status harus tetap ada — ini yang dulu tertimpa. Dikenali dari
    // cabang yang menyebut statusKunjungan, bukan dokterId.
    const filterStatus = klausa.find((k) =>
      k.OR?.some((cabang) => cabang.statusKunjungan !== undefined)
    );
    expect(filterStatus).toBeDefined();
    expect(filterStatus).not.toBe(scoping);
  });

  test("dari/sampai tidak menimpa batas tanggal milik filter status", async () => {
    const token = await loginDokter();

    const res = await request(app)
      .get("/api/kunjungan?status=SCHEDULED&dari=2026-08-20&sampai=2026-08-20")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);

    // 3 klausa berbeda menyentuh tanggalMasuk: status SCHEDULED (gt: now),
    // dari (gte), sampai (lte). Semuanya harus bertahan sebagai klausa sendiri.
    const menyentuhTanggal = klausaTerakhir().filter((k) => k.tanggalMasuk !== undefined);
    expect(menyentuhTanggal).toHaveLength(3);
  });

  test("tanggal tidak valid ditolak 400", async () => {
    const token = await loginDokter();

    const res = await request(app)
      .get("/api/kunjungan?dari=20-08-2026")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(prisma.kunjungan.findMany).not.toHaveBeenCalled();
  });

  test("dari setelah sampai ditolak 400", async () => {
    const token = await loginDokter();

    const res = await request(app)
      .get("/api/kunjungan?dari=2026-08-21&sampai=2026-08-20")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(prisma.kunjungan.findMany).not.toHaveBeenCalled();
  });
});
