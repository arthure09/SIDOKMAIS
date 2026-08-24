// Modul Radiologi: route dummy (Supertest) + pembersih narasi versi SIMRS.
//
// Layer DB di-mock, pola sama dengan pasien.urutan.test.js. Route SIMRS-nya
// sendiri tidak bisa dites lewat Supertest di sini — jest.setup.js memaksa
// SUMBER_DATA=dummy — jadi yang diuji dari sisi SIMRS cuma fungsi murninya,
// sama seperti simrs.test.js.

const request = require("supertest");
const bcrypt = require("bcrypt");

jest.mock("../lib/prisma", () => ({
  pengguna: { findUnique: jest.fn() },
  dokterPasienAssignment: { findFirst: jest.fn() },
  pemeriksaanRadiologi: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
}));

const prisma = require("../lib/prisma");
const app = require("../server");
const { bersihkanNarasi } = require("../routes/simrs/radiologi.routes");

const PASSWORD = "Sidokmais#2026";
const DOKTER_ID = "dokter-uuid-budi";
const PASIEN_SAYA = "pasien-uuid-1";
const PASIEN_ORANG_LAIN = "pasien-uuid-9";

const PENGGUNA_DOKTER = {
  id: "pengguna-uuid-budi",
  username: "budi.santoso",
  passwordHash: null,
  role: "DOKTER",
  dokterId: DOKTER_ID,
  dokter: { id: DOKTER_ID, nama: "dr. Budi Santoso", spesialisasi: "Bedah Onkologi" },
};

const BARIS = {
  id: "rad-1",
  pasienId: PASIEN_SAYA,
  modalitas: "CT Scan",
  namaPemeriksaan: "CT Scan Thorax dengan Kontras",
  unit: "Radiodiagnostik Lantai 1",
  cito: false,
  tanggalPermintaan: new Date("2026-08-20T02:00:00.000Z"),
  tanggalHasil: new Date("2026-08-20T06:00:00.000Z"),
  klinis: "Evaluasi pasca kemoterapi",
  hasil: "Massa lobus superior paru kiri, mengecil dibanding pemeriksaan sebelumnya.",
  kesan: null,
};

let token;

beforeAll(async () => {
  PENGGUNA_DOKTER.passwordHash = await bcrypt.hash(PASSWORD, 10);
});

beforeEach(async () => {
  jest.clearAllMocks();
  prisma.pengguna.findUnique.mockResolvedValue(PENGGUNA_DOKTER);
  // Dokter ini cuma dipasangkan ke PASIEN_SAYA.
  prisma.dokterPasienAssignment.findFirst.mockImplementation(({ where }) =>
    Promise.resolve(where.pasienId === PASIEN_SAYA ? { id: "assign-1" } : null)
  );

  const login = await request(app)
    .post("/api/auth/login")
    .send({ username: "budi.santoso", password: PASSWORD });
  token = login.body.token;
});

function get(url) {
  return request(app).get(url).set("Authorization", `Bearer ${token}`);
}

describe("GET /api/radiologi (dummy)", () => {
  test("tanpa pasienId -> 400, bukan daftar radiologi seluruh rumah sakit", async () => {
    const res = await get("/api/radiologi");
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain("pasienId wajib diisi");
    expect(prisma.pemeriksaanRadiologi.findMany).not.toHaveBeenCalled();
  });

  test("pasien dokter lain -> 403 dan query tidak pernah dijalankan", async () => {
    const res = await get(`/api/radiologi?pasienId=${PASIEN_ORANG_LAIN}`);
    expect(res.status).toBe(403);
    expect(prisma.pemeriksaanRadiologi.findMany).not.toHaveBeenCalled();
  });

  test("pasien sendiri -> 200, narasi TIDAK ikut, kesan cuma jadi penanda", async () => {
    prisma.pemeriksaanRadiologi.count.mockResolvedValue(2);
    prisma.pemeriksaanRadiologi.findMany.mockResolvedValue([
      BARIS,
      { ...BARIS, id: "rad-2", kesan: "  " },
      { ...BARIS, id: "rad-3", kesan: "Massa mengecil." },
    ]);

    const res = await get(`/api/radiologi?pasienId=${PASIEN_SAYA}`);

    expect(res.status).toBe(200);
    // Daftar tidak boleh membawa narasi: di SIMRS kolomnya longtext ~632
    // karakter per baris dan tidak satu pun ditampilkan di layar daftar.
    expect(res.body.data[0]).not.toHaveProperty("hasil");
    expect(res.body.data[0]).not.toHaveProperty("klinis");
    // Kesan null dan kesan berisi spasi sama-sama dianggap tidak ada.
    expect(res.body.data.map((d) => d.adaKesan)).toEqual([false, false, true]);
  });

  test("filter tanggal masuk ke where, bukan disaring belakangan", async () => {
    prisma.pemeriksaanRadiologi.count.mockResolvedValue(0);
    prisma.pemeriksaanRadiologi.findMany.mockResolvedValue([]);

    await get(`/api/radiologi?pasienId=${PASIEN_SAYA}&dariTanggal=2026-08-01&sampaiTanggal=2026-08-31`);

    const { where } = prisma.pemeriksaanRadiologi.findMany.mock.calls[0][0];
    expect(where.pasienId).toBe(PASIEN_SAYA);
    expect(where.tanggalPermintaan.gte).toBeInstanceOf(Date);
    expect(where.tanggalPermintaan.lte).toBeInstanceOf(Date);
  });
});

describe("GET /api/radiologi/:id (dummy)", () => {
  test("id tidak ada -> 404", async () => {
    prisma.pemeriksaanRadiologi.findUnique.mockResolvedValue(null);
    const res = await get("/api/radiologi/tidak-ada");
    expect(res.status).toBe(404);
  });

  test("laporan pasien dokter lain -> 403, isinya tidak bocor", async () => {
    prisma.pemeriksaanRadiologi.findUnique.mockResolvedValue({
      ...BARIS,
      pasienId: PASIEN_ORANG_LAIN,
    });

    const res = await get("/api/radiologi/rad-1");

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain(BARIS.hasil);
  });

  test("laporan pasien sendiri -> 200 lengkap dengan narasinya", async () => {
    prisma.pemeriksaanRadiologi.findUnique.mockResolvedValue(BARIS);
    const res = await get("/api/radiologi/rad-1");
    expect(res.status).toBe(200);
    expect(res.body.hasil).toBe(BARIS.hasil);
  });
});

describe("bersihkanNarasi (SIMRS)", () => {
  test("teks polos dibiarkan apa adanya", () => {
    expect(bersihkanNarasi("Cor dan pulmo dalam batas normal.")).toBe(
      "Cor dan pulmo dalam batas normal."
    );
  });

  test("tag HTML dibuang, <br> dan </p> jadi ganti baris", () => {
    expect(bersihkanNarasi("<p>Cor normal.</p><p>Pulmo:<br>infiltrat kanan.</p>")).toBe(
      "Cor normal.\nPulmo:\ninfiltrat kanan."
    );
  });

  test("entitas HTML dikembalikan ke karakter aslinya", () => {
    expect(bersihkanNarasi("Ukuran &lt; 5 mm&nbsp;&amp; batas tegas")).toBe(
      "Ukuran < 5 mm & batas tegas"
    );
  });

  test("CRLF disamakan, baris kosong beruntun dipadatkan", () => {
    expect(bersihkanNarasi("Baris satu.\r\n\r\n\r\n\r\nBaris dua.")).toBe(
      "Baris satu.\n\nBaris dua."
    );
  });

  test("spasi di ujung baris dibuang", () => {
    expect(bersihkanNarasi("Temuan.   \nLanjutan.")).toBe("Temuan.\nLanjutan.");
  });

  test("kosong, spasi saja, dan null -> null (bukan string kosong di layar)", () => {
    expect(bersihkanNarasi("")).toBeNull();
    expect(bersihkanNarasi("   \n  ")).toBeNull();
    expect(bersihkanNarasi("<p></p>")).toBeNull();
    expect(bersihkanNarasi(null)).toBeNull();
  });
});
