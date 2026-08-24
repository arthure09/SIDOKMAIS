// Dashboard = "kegiatan SAYA hari ini", bukan "semua data pasien saya".
//
// Yang dijaga: penyaringnya keterlibatan langsung (`dokterId` di
// Kunjungan/Operasi), BUKAN DokterPasienAssignment yang dipakai modul lain
// untuk menentukan "boleh lihat apa". Perbedaan itu tidak kelihatan dari
// bentuk response — dua-duanya mengembalikan angka — tapi di data asli
// selisihnya besar: satu dokter senior yang pasiennya ditangani banyak orang
// akan melihat kegiatan seluruh rumah sakit sebagai miliknya (diukur 24 Ags
// 2026 di replika SIMRS: 5.169 kunjungan seminggu vs 852 yang benar).
//
// Layer DB di-mock, pola sama dengan pasien.urutan.test.js.

const request = require("supertest");
const bcrypt = require("bcrypt");

jest.mock("../lib/prisma", () => ({
  pengguna: { findUnique: jest.fn() },
  kunjungan: { count: jest.fn(), findMany: jest.fn() },
  operasi: { count: jest.fn(), findMany: jest.fn() },
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

// Dua kunjungan hari ini (pasien A & B) + satu operasi hari ini untuk pasien A.
const KUNJUNGAN_HARI_INI = [{ pasienId: "pasien-A" }, { pasienId: "pasien-B" }];
const OPERASI_HARI_INI = [{ kunjungan: { pasienId: "pasien-A" } }];

let token;

beforeAll(async () => {
  PENGGUNA_DOKTER.passwordHash = await bcrypt.hash(PASSWORD, 10);
});

beforeEach(async () => {
  jest.clearAllMocks();
  prisma.pengguna.findUnique.mockResolvedValue(PENGGUNA_DOKTER);

  prisma.kunjungan.count.mockResolvedValue(2);
  prisma.operasi.count.mockResolvedValue(1);

  prisma.kunjungan.findMany.mockImplementation(({ select }) => {
    if (select?.pasienId) return Promise.resolve(KUNJUNGAN_HARI_INI);
    if (select?.tanggalMasuk && Object.keys(select).length === 1) return Promise.resolve([]);
    return Promise.resolve([]); // pasienPrioritas
  });
  // Pembeda harus `kunjungan.select.pasienId`, bukan sekadar `kunjungan`:
  // query pasienPrioritas juga ikut memilih `kunjungan` (buat nama pasien),
  // jadi penanda yang terlalu longgar membuat mock membalas bentuk yang salah.
  prisma.operasi.findMany.mockImplementation(({ select }) => {
    if (select?.kunjungan?.select?.pasienId) return Promise.resolve(OPERASI_HARI_INI);
    return Promise.resolve([]);
  });

  const login = await request(app)
    .post("/api/auth/login")
    .send({ username: "budi.santoso", password: PASSWORD });
  token = login.body.token;
});

function statistik() {
  return request(app).get("/api/dashboard/statistik").set("Authorization", `Bearer ${token}`);
}

describe("GET /api/dashboard/statistik — lingkup", () => {
  test("menyaring pakai dokterId langsung, TIDAK pakai assignment pasien", async () => {
    await statistik();

    const semuaWhere = [
      ...prisma.kunjungan.count.mock.calls,
      ...prisma.kunjungan.findMany.mock.calls,
      ...prisma.operasi.count.mock.calls,
      ...prisma.operasi.findMany.mock.calls,
    ].map(([arg]) => JSON.stringify(arg.where));

    expect(semuaWhere.length).toBeGreaterThan(0);
    for (const where of semuaWhere) {
      expect(where).toContain(DOKTER_ID);
      // `assignments` = jalur akses per-pasien. Kalau muncul lagi di sini,
      // dashboard kembali menghitung kegiatan dokter lain.
      expect(where).not.toContain("assignments");
    }
  });

  test("pasienHariIni menghitung pasien unik, bukan menjumlah dua sumber", async () => {
    const res = await statistik();

    expect(res.status).toBe(200);
    // Pasien A punya kunjungan DAN operasi hari ini -> tetap dihitung sekali.
    // Penjumlahan naif akan menghasilkan 3.
    expect(res.body.pasienHariIni).toBe(2);
  });

  test("operasi batal tidak dihitung sebagai kegiatan", async () => {
    await statistik();

    for (const [arg] of prisma.operasi.count.mock.calls) {
      expect(arg.where.status).toEqual({ not: "CANCELLED" });
    }
  });

  test("ADMIN tetap dapat nol + catatan, bukan agregat lintas dokter", async () => {
    prisma.pengguna.findUnique.mockResolvedValue({
      id: "pengguna-uuid-admin",
      username: "admin",
      passwordHash: PENGGUNA_DOKTER.passwordHash,
      role: "ADMIN",
      dokterId: null,
      dokter: null,
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: PASSWORD });

    const res = await request(app)
      .get("/api/dashboard/statistik")
      .set("Authorization", `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.pasienHariIni).toBe(0);
    expect(res.body.adminCatatan).toMatch(/tidak relevan/i);
    expect(prisma.kunjungan.count).not.toHaveBeenCalled();
  });
});
