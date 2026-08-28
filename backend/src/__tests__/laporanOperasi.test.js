// Laporan lengkap cuma keluar untuk operasi yang status EFEKTIF-nya
// COMPLETED — bukan status tersimpan. Operasi yang belum selesai tidak boleh
// membocorkan laporan setengah jadi, dan operasi yang tersimpan SCHEDULED
// tapi tanggalnya sudah lewat harus tetap dapat laporannya karena statusnya
// yang tampil di layar sudah COMPLETED.

const request = require("supertest");
const bcrypt = require("bcrypt");

jest.mock("../lib/prisma", () => ({
  pengguna: { findUnique: jest.fn() },
  operasi: { findUnique: jest.fn() },
}));

const prisma = require("../lib/prisma");
const app = require("../server");
const { parseLaporanBody, tanpaLaporan } = require("../utils/laporanOperasi");

const PASSWORD = "Sidokmais#2026";

const PENGGUNA_ADMIN = {
  id: "pengguna-uuid-admin",
  username: "admin",
  passwordHash: null,
  role: "ADMIN",
  dokterId: null,
  dokter: null,
};

const HARI = 86_400_000;

function operasiDummy(status, tanggalOperasi) {
  return {
    id: "operasi-uuid-1",
    kunjunganId: "kunjungan-uuid-1",
    ruanganId: "ruangan-uuid-1",
    tanggalOperasi,
    jenisTindakan: "Reseksi Tumor",
    tim: ["dr. Budi Santoso", "dr. Siti Rahayu"],
    status,
    catatanPreOp: "Pasien dalam kondisi stabil, siap tindakan.",
    catatanPostOp: null,
    dokterOperator: "dr. Budi Santoso",
    diagnosaPraBedah: "Tumor solid, rencana reseksi",
    deskripsiOperasi: "Insisi sesuai marka, tumor direseksi dengan tepi sayatan bebas.",
    jumlahKehilanganDarah: 250,
    sifatOperasi: "ELEKTIF",
    kunjungan: {
      id: "kunjungan-uuid-1",
      pasienId: "pasien-uuid-1",
      dokterId: "dokter-uuid-budi",
      tanggalMasuk: tanggalOperasi,
      statusKunjungan: "COMPLETED",
      pasien: { id: "pasien-uuid-1", nama: "Andi Pratama", norm: "RM-0001" },
      dokter: { id: "dokter-uuid-budi", nama: "dr. Budi Santoso" },
    },
    ruangan: { id: "ruangan-uuid-1", nama: "OK 1", jenis: "OK", lantai: 3 },
  };
}

async function tokenAdmin() {
  const res = await request(app).post("/api/auth/login").send({ username: "admin", password: PASSWORD });
  return res.body.token;
}

beforeAll(async () => {
  PENGGUNA_ADMIN.passwordHash = await bcrypt.hash(PASSWORD, 10);
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.pengguna.findUnique.mockResolvedValue(PENGGUNA_ADMIN);
});

describe("GET /api/operasi/:id — visibilitas laporan", () => {
  it("mengirim field laporan kalau operasinya sudah selesai", async () => {
    prisma.operasi.findUnique.mockResolvedValue(
      operasiDummy("COMPLETED", new Date(Date.now() - 3 * HARI))
    );

    const res = await request(app)
      .get("/api/operasi/operasi-uuid-1")
      .set("Authorization", `Bearer ${await tokenAdmin()}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("COMPLETED");
    expect(res.body.deskripsiOperasi).toBeDefined();
    expect(res.body.jumlahKehilanganDarah).toBe(250);
  });

  it("menyembunyikan field laporan kalau jadwalnya belum tiba", async () => {
    prisma.operasi.findUnique.mockResolvedValue(
      operasiDummy("SCHEDULED", new Date(Date.now() + 3 * HARI))
    );

    const res = await request(app)
      .get("/api/operasi/operasi-uuid-1")
      .set("Authorization", `Bearer ${await tokenAdmin()}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SCHEDULED");
    expect(res.body.deskripsiOperasi).toBeUndefined();
    expect(res.body.jumlahKehilanganDarah).toBeUndefined();
    // Info jadwal tetap utuh.
    expect(res.body.jenisTindakan).toBe("Reseksi Tumor");
    expect(res.body.tim).toHaveLength(2);
  });

  it("ikut status efektif, bukan status tersimpan", async () => {
    // Tersimpan SCHEDULED tapi tanggalnya sudah lewat → tampil Selesai, jadi
    // laporannya ikut keluar.
    prisma.operasi.findUnique.mockResolvedValue(
      operasiDummy("SCHEDULED", new Date(Date.now() - 3 * HARI))
    );

    const res = await request(app)
      .get("/api/operasi/operasi-uuid-1")
      .set("Authorization", `Bearer ${await tokenAdmin()}`);

    expect(res.body.status).toBe("COMPLETED");
    expect(res.body.deskripsiOperasi).toBeDefined();
  });

  it("operasi dibatalkan tidak punya laporan", async () => {
    prisma.operasi.findUnique.mockResolvedValue(
      operasiDummy("CANCELLED", new Date(Date.now() - 3 * HARI))
    );

    const res = await request(app)
      .get("/api/operasi/operasi-uuid-1")
      .set("Authorization", `Bearer ${await tokenAdmin()}`);

    expect(res.body.status).toBe("CANCELLED");
    expect(res.body.deskripsiOperasi).toBeUndefined();
  });
});

describe("parseLaporanBody", () => {
  it("menerima nilai valid dan membuang field yang tidak dikirim", () => {
    const { errors, data } = parseLaporanBody({
      dokterOperator: "  dr. Budi Santoso  ",
      sifatOperasi: "CITO",
      antibiotikProfilaksis: true,
      jumlahKehilanganDarah: 300,
      jamSelesai: "2026-08-19T04:30:00.000Z",
      jenisTindakan: "bukan field laporan",
    });

    expect(errors).toEqual([]);
    expect(data.dokterOperator).toBe("dr. Budi Santoso");
    expect(data.sifatOperasi).toBe("CITO");
    expect(data.jamSelesai).toBeInstanceOf(Date);
    expect(data).not.toHaveProperty("jenisTindakan");
    expect(data).not.toHaveProperty("komplikasi");
  });

  it("menolak nilai yang salah tipe atau di luar enum", () => {
    const { errors, data } = parseLaporanBody({
      sifatOperasi: "DARURAT",
      jumlahKehilanganDarah: -5,
      antibiotikProfilaksis: "ya",
      jamSelesai: "kemarin",
      dokterOperator: "   ",
    });

    expect(errors).toHaveLength(5);
    expect(data).toEqual({});
  });

  it("null berarti kosongkan field, bukan error", () => {
    const { errors, data } = parseLaporanBody({ komplikasi: null });
    expect(errors).toEqual([]);
    expect(data).toEqual({ komplikasi: null });
  });
});

describe("tanpaLaporan", () => {
  it("tidak mengubah objek aslinya", () => {
    const asli = operasiDummy("SCHEDULED", new Date());
    const bersih = tanpaLaporan(asli);
    expect(asli.deskripsiOperasi).toBeDefined();
    expect(bersih.deskripsiOperasi).toBeUndefined();
  });
});
