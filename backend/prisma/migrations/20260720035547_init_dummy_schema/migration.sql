-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DOKTER', 'ADMIN');

-- CreateEnum
CREATE TYPE "JenisKelamin" AS ENUM ('L', 'P');

-- CreateEnum
CREATE TYPE "RuanganJenis" AS ENUM ('POLI', 'OK', 'RAWAT_INAP');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StatusKunjungan" AS ENUM ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotifikasiTipe" AS ENUM ('PASIEN_BARU', 'REMINDER_OPERASI', 'PERUBAHAN_JADWAL');

-- CreateEnum
CREATE TYPE "OperasiStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Dokter" (
    "id" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "spesialisasi" TEXT,
    "sip" TEXT,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dokter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pasien" (
    "id" TEXT NOT NULL,
    "norm" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jenisKelamin" "JenisKelamin" NOT NULL,
    "tanggalLahir" TIMESTAMP(3),
    "tempatLahir" TEXT,
    "alamat" TEXT,
    "golonganDarah" TEXT,
    "noRekamMedis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pasien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ruangan" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jenis" "RuanganJenis" NOT NULL,
    "lantai" INTEGER,

    CONSTRAINT "Ruangan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DokterPasienAssignment" (
    "id" TEXT NOT NULL,
    "dokterId" TEXT NOT NULL,
    "pasienId" TEXT NOT NULL,
    "tanggalAssign" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "DokterPasienAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kunjungan" (
    "id" TEXT NOT NULL,
    "pasienId" TEXT NOT NULL,
    "dokterId" TEXT NOT NULL,
    "ruanganId" TEXT NOT NULL,
    "tanggalMasuk" TIMESTAMP(3) NOT NULL,
    "tanggalKeluar" TIMESTAMP(3),
    "diagnosa" TEXT,
    "statusKunjungan" "StatusKunjungan" NOT NULL DEFAULT 'SCHEDULED',
    "isPasienBaru" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kunjungan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pengguna" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "dokterId" TEXT,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pengguna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notifikasi" (
    "id" TEXT NOT NULL,
    "dokterId" TEXT NOT NULL,
    "tipe" "NotifikasiTipe" NOT NULL,
    "pesan" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notifikasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operasi" (
    "id" TEXT NOT NULL,
    "kunjunganId" TEXT NOT NULL,
    "ruanganId" TEXT NOT NULL,
    "tanggalOperasi" TIMESTAMP(3) NOT NULL,
    "jenisTindakan" TEXT NOT NULL,
    "tim" TEXT[],
    "status" "OperasiStatus" NOT NULL DEFAULT 'SCHEDULED',
    "catatanPreOp" TEXT,
    "catatanPostOp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Penjamin" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,

    CONSTRAINT "Penjamin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pendapatan" (
    "id" TEXT NOT NULL,
    "operasiId" TEXT NOT NULL,
    "penjaminId" TEXT NOT NULL,
    "tarifTotal" DECIMAL(14,2) NOT NULL,
    "jumlahDiterimaDokter" DECIMAL(14,2) NOT NULL,
    "isDummy" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pendapatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dokter_nip_key" ON "Dokter"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "Pasien_norm_key" ON "Pasien"("norm");

-- CreateIndex
CREATE INDEX "DokterPasienAssignment_dokterId_idx" ON "DokterPasienAssignment"("dokterId");

-- CreateIndex
CREATE INDEX "DokterPasienAssignment_pasienId_idx" ON "DokterPasienAssignment"("pasienId");

-- CreateIndex
CREATE UNIQUE INDEX "Pengguna_username_key" ON "Pengguna"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Pengguna_dokterId_key" ON "Pengguna"("dokterId");

-- AddForeignKey
ALTER TABLE "DokterPasienAssignment" ADD CONSTRAINT "DokterPasienAssignment_dokterId_fkey" FOREIGN KEY ("dokterId") REFERENCES "Dokter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DokterPasienAssignment" ADD CONSTRAINT "DokterPasienAssignment_pasienId_fkey" FOREIGN KEY ("pasienId") REFERENCES "Pasien"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kunjungan" ADD CONSTRAINT "Kunjungan_pasienId_fkey" FOREIGN KEY ("pasienId") REFERENCES "Pasien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kunjungan" ADD CONSTRAINT "Kunjungan_dokterId_fkey" FOREIGN KEY ("dokterId") REFERENCES "Dokter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kunjungan" ADD CONSTRAINT "Kunjungan_ruanganId_fkey" FOREIGN KEY ("ruanganId") REFERENCES "Ruangan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pengguna" ADD CONSTRAINT "Pengguna_dokterId_fkey" FOREIGN KEY ("dokterId") REFERENCES "Dokter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifikasi" ADD CONSTRAINT "Notifikasi_dokterId_fkey" FOREIGN KEY ("dokterId") REFERENCES "Dokter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operasi" ADD CONSTRAINT "Operasi_kunjunganId_fkey" FOREIGN KEY ("kunjunganId") REFERENCES "Kunjungan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operasi" ADD CONSTRAINT "Operasi_ruanganId_fkey" FOREIGN KEY ("ruanganId") REFERENCES "Ruangan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pendapatan" ADD CONSTRAINT "Pendapatan_operasiId_fkey" FOREIGN KEY ("operasiId") REFERENCES "Operasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pendapatan" ADD CONSTRAINT "Pendapatan_penjaminId_fkey" FOREIGN KEY ("penjaminId") REFERENCES "Penjamin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
