// Pengingat jadwal operasi (Notifikasi REMINDER_OPERASI).
//
// Yang dijaga:
//   1. Idempoten — dipanggil berkali-kali, satu operasi tetap satu pengingat.
//      Ini yang paling gampang rusak: pembuatnya dipanggil dari endpoint BACA
//      yang di-poll HP tiap beberapa detik, jadi bug di sini tidak muncul
//      sebagai error, melainkan sebagai daftar notifikasi yang membengkak
//      sendiri sampai tidak terbaca.
//   2. Pesannya tidak memuat identitas pasien — Notifikasi disimpan di
//      PostgreSQL lokal, pasiennya milik SIMRS.
//   3. Kegagalan membaca jadwal tidak menggagalkan GET /api/notifikasi.

const request = require("supertest");
const bcrypt = require("bcrypt");

jest.mock("../lib/prisma", () => ({
  pengguna: { findUnique: jest.fn() },
  notifikasi: { count: jest.fn(), findMany: jest.fn(), createMany: jest.fn() },
  operasi: { findMany: jest.fn() },
}));

const prisma = require("../lib/prisma");
const app = require("../server");
const {
  sinkronkanPengingatOperasi,
  pesanPengingat,
  _resetTenggang,
} = require("../utils/pengingatJadwal");

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

// Dua operasi terjadwal hari ini, di rentang H-0..H-2.
function jadwalPalsu() {
  const nanti = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return [
    {
      id: "operasi-1",
      tanggalOperasi: nanti,
      jenisTindakan: "Mastektomi Radikal",
      ruangan: { nama: "OK Bedah 1" },
    },
    {
      id: "operasi-2",
      tanggalOperasi: nanti,
      jenisTindakan: "Biopsi Eksisi",
      ruangan: { nama: "OK Bedah 2" },
    },
  ];
}

beforeAll(async () => {
  PENGGUNA_DOKTER.passwordHash = await bcrypt.hash(PASSWORD, 10);
});

beforeEach(() => {
  jest.clearAllMocks();
  _resetTenggang();
  prisma.pengguna.findUnique.mockResolvedValue(PENGGUNA_DOKTER);
  prisma.operasi.findMany.mockResolvedValue(jadwalPalsu());
  prisma.notifikasi.findMany.mockResolvedValue([]);
  prisma.notifikasi.createMany.mockResolvedValue({ count: 2 });
  prisma.notifikasi.count.mockResolvedValue(0);
});

describe("sinkronkanPengingatOperasi", () => {
  test("membuat satu pengingat per operasi yang belum punya", async () => {
    const dibuat = await sinkronkanPengingatOperasi(DOKTER_ID, { paksa: true });

    expect(dibuat).toBe(2);
    const { data } = prisma.notifikasi.createMany.mock.calls[0][0];
    expect(data.map((d) => d.relatedId)).toEqual(["operasi-1", "operasi-2"]);
    expect(data.every((d) => d.tipe === "REMINDER_OPERASI")).toBe(true);
    expect(data.every((d) => d.relatedType === "Operasi")).toBe(true);
    expect(data.every((d) => d.dokterId === DOKTER_ID)).toBe(true);
  });

  test("operasi yang sudah punya pengingat tidak dibuatkan lagi", async () => {
    prisma.notifikasi.findMany.mockResolvedValue([{ relatedId: "operasi-1" }]);

    const dibuat = await sinkronkanPengingatOperasi(DOKTER_ID, { paksa: true });

    expect(dibuat).toBe(1);
    const { data } = prisma.notifikasi.createMany.mock.calls[0][0];
    expect(data.map((d) => d.relatedId)).toEqual(["operasi-2"]);
  });

  test("semua sudah punya -> tidak menulis apa pun", async () => {
    prisma.notifikasi.findMany.mockResolvedValue([
      { relatedId: "operasi-1" },
      { relatedId: "operasi-2" },
    ]);

    const dibuat = await sinkronkanPengingatOperasi(DOKTER_ID, { paksa: true });

    expect(dibuat).toBe(0);
    expect(prisma.notifikasi.createMany).not.toHaveBeenCalled();
  });

  test("tidak ada jadwal -> tidak query notifikasi sama sekali", async () => {
    prisma.operasi.findMany.mockResolvedValue([]);

    const dibuat = await sinkronkanPengingatOperasi(DOKTER_ID, { paksa: true });

    expect(dibuat).toBe(0);
    expect(prisma.notifikasi.findMany).not.toHaveBeenCalled();
  });

  test("rem 60 detik: panggilan kedua tanpa paksa tidak mengulang pekerjaan", async () => {
    await sinkronkanPengingatOperasi(DOKTER_ID);
    prisma.operasi.findMany.mockClear();

    const kedua = await sinkronkanPengingatOperasi(DOKTER_ID);

    expect(kedua).toBe(0);
    expect(prisma.operasi.findMany).not.toHaveBeenCalled();
  });

  test("hanya jadwal dokter itu sendiri yang diambil", async () => {
    await sinkronkanPengingatOperasi(DOKTER_ID, { paksa: true });

    const { where } = prisma.operasi.findMany.mock.calls[0][0];
    expect(where.kunjungan).toEqual({ dokterId: DOKTER_ID });
    expect(where.status).toBe("SCHEDULED");
  });
});

describe("pesanPengingat", () => {
  const sekarang = new Date("2026-08-24T03:00:00.000Z"); // 10.00 WIB

  test("hari ini / besok / N hari lagi dibedakan", () => {
    const buat = (iso) =>
      pesanPengingat({ waktu: new Date(iso), tindakan: "Mastektomi", ruangan: "OK 1" }, sekarang);

    expect(buat("2026-08-24T06:00:00.000Z")).toContain("hari ini");
    expect(buat("2026-08-25T06:00:00.000Z")).toContain("besok");
    expect(buat("2026-08-26T06:00:00.000Z")).toContain("2 hari lagi");
  });

  test("jam ditulis WIB, bukan waktu server", () => {
    // 06.00 UTC = 13.00 WIB. Kalau timeZone-nya lupa, ini akan berbunyi 06.00.
    const pesan = pesanPengingat(
      { waktu: new Date("2026-08-24T06:00:00.000Z"), tindakan: null, ruangan: null },
      sekarang,
    );
    expect(pesan).toContain("13.00 WIB");
  });

  test("tindakan/ruangan kosong tidak meninggalkan pemisah menggantung", () => {
    const pesan = pesanPengingat(
      { waktu: new Date("2026-08-24T06:00:00.000Z"), tindakan: null, ruangan: null },
      sekarang,
    );
    expect(pesan).toBe("Operasi hari ini pukul 13.00 WIB.");
  });
});

describe("GET /api/notifikasi", () => {
  async function login() {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "budi.santoso", password: PASSWORD });
    return res.body.token;
  }

  test("pengingat dibuat saat daftar dibaca", async () => {
    const token = await login();
    const res = await request(app)
      .get("/api/notifikasi")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(prisma.notifikasi.createMany).toHaveBeenCalled();
  });

  test("jadwal tidak bisa dibaca -> daftar TETAP tampil", async () => {
    prisma.operasi.findMany.mockRejectedValue(new Error("replika SIMRS tidak terjangkau"));

    const token = await login();
    const res = await request(app)
      .get("/api/notifikasi")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
