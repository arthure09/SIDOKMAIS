// Tanggal kunjungan terakhir TIDAK ada di baris assignment — dia hasil query
// kedua yang di-join di JS. Jadi urutan (?urutkan=terbaru|terlama) juga
// dikerjakan di JS setelah pemetaan, dan pemotongan halaman baru terjadi
// sesudah itu. Kalau `skip`/`take` dikembalikan ke query Prisma tanpa
// menghapus pemotongan JS, hasilnya jadi "N nama pertama abjad, diurutkan
// tanggal" — terlihat benar di layar, padahal salah. Layer DB di-mock.

const request = require("supertest");
const bcrypt = require("bcrypt");

jest.mock("../lib/prisma", () => ({
  pengguna: { findUnique: jest.fn() },
  dokterPasienAssignment: { count: jest.fn(), findMany: jest.fn() },
  kunjungan: { findMany: jest.fn() },
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

// Tiga pasien: dua punya kunjungan, satu belum pernah. Sengaja diurut abjad
// (Ani, Budi, Citra) supaya urutan hasil yang benar TIDAK sama dengan urutan
// masuknya — kalau sortnya tidak jalan, tesnya tetap merah.
const ASSIGNMENTS = [
  { pasienId: "p-ani", status: "ACTIVE", pasien: { id: "p-ani", norm: "RM-1", nama: "Ani" } },
  { pasienId: "p-budi", status: "ACTIVE", pasien: { id: "p-budi", norm: "RM-2", nama: "Budi" } },
  { pasienId: "p-citra", status: "ACTIVE", pasien: { id: "p-citra", norm: "RM-3", nama: "Citra" } },
];

const KUNJUNGAN_LALU = [
  { pasienId: "p-ani", tanggalMasuk: new Date("2026-01-10T03:00:00Z"), diagnosa: null, ruangan: null },
  { pasienId: "p-citra", tanggalMasuk: new Date("2026-08-01T03:00:00Z"), diagnosa: null, ruangan: null },
];

async function loginDokter() {
  prisma.pengguna.findUnique.mockResolvedValue(PENGGUNA_DOKTER);
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: PENGGUNA_DOKTER.username, password: PASSWORD });
  return res.body.token;
}

async function ambilList(query) {
  const token = await loginDokter();
  const res = await request(app).get(`/api/pasien${query}`).set("Authorization", `Bearer ${token}`);
  return res;
}

beforeAll(async () => {
  PENGGUNA_DOKTER.passwordHash = await bcrypt.hash(PASSWORD, 10);
});

beforeEach(() => {
  prisma.dokterPasienAssignment.count.mockResolvedValue(ASSIGNMENTS.length);
  prisma.dokterPasienAssignment.findMany.mockResolvedValue(ASSIGNMENTS);
  // Query pertama = kunjungan lampau, kedua = kunjungan mendatang.
  prisma.kunjungan.findMany
    .mockResolvedValueOnce(KUNJUNGAN_LALU)
    .mockResolvedValueOnce([]);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/pasien?urutkan=", () => {
  test("terbaru: kunjungan paling baru di atas, pasien tanpa kunjungan paling bawah", async () => {
    const res = await ambilList("?urutkan=terbaru");

    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.nama)).toEqual(["Citra", "Ani", "Budi"]);
  });

  test("terlama: dibalik, tapi pasien tanpa kunjungan TETAP paling bawah", async () => {
    const res = await ambilList("?urutkan=terlama");

    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.nama)).toEqual(["Ani", "Citra", "Budi"]);
  });

  test("pemotongan halaman ikut urutan baru, bukan urutan dari DB", async () => {
    const res = await ambilList("?urutkan=terbaru&page=1&limit=1");

    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.nama)).toEqual(["Citra"]);
    // Halamannya dipotong di JS, jadi Prisma harus dipanggil TANPA take —
    // kalau tidak, yang tersisa buat diurutkan cuma 1 baris pertama abjad.
    expect(prisma.dokterPasienAssignment.findMany.mock.calls.at(-1)[0].take).toBeUndefined();
  });

  test("tanpa urutkan: urutan dari DB dipakai apa adanya, paginasi di Prisma", async () => {
    const res = await ambilList("?page=2&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.nama)).toEqual(["Ani", "Budi", "Citra"]);
    const arg = prisma.dokterPasienAssignment.findMany.mock.calls.at(-1)[0];
    expect(arg).toMatchObject({ skip: 10, take: 10 });
  });

  test("nilai urutkan di luar daftar ditolak 400", async () => {
    const res = await ambilList("?urutkan=abjad");

    expect(res.status).toBe(400);
    expect(prisma.dokterPasienAssignment.findMany).not.toHaveBeenCalled();
  });
});
