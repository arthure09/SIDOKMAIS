-- CreateEnum
CREATE TYPE "StatusPemeriksaanLab" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FlagHasilLab" AS ENUM ('RENDAH', 'NORMAL', 'TINGGI', 'ABNORMAL');

-- AlterEnum
ALTER TYPE "NotifikasiTipe" ADD VALUE 'HASIL_LAB';

-- AlterTable
ALTER TABLE "Notifikasi" ADD COLUMN     "relatedId" TEXT,
ADD COLUMN     "relatedType" TEXT;

-- CreateTable
CREATE TABLE "PemeriksaanLab" (
    "id" TEXT NOT NULL,
    "pasienId" TEXT NOT NULL,
    "kunjunganId" TEXT,
    "dokterPemintaId" TEXT,
    "kategori" TEXT NOT NULL,
    "namaPemeriksaan" TEXT NOT NULL,
    "laboratorium" TEXT,
    "tanggalPermintaan" TIMESTAMP(3) NOT NULL,
    "tanggalHasil" TIMESTAMP(3),
    "status" "StatusPemeriksaanLab" NOT NULL,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PemeriksaanLab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HasilLabItem" (
    "id" TEXT NOT NULL,
    "pemeriksaanLabId" TEXT NOT NULL,
    "namaParameter" TEXT NOT NULL,
    "nilai" TEXT NOT NULL,
    "satuan" TEXT,
    "nilaiRujukan" TEXT,
    "flag" "FlagHasilLab" NOT NULL,
    "urutan" INTEGER,

    CONSTRAINT "HasilLabItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PemeriksaanLab_pasienId_idx" ON "PemeriksaanLab"("pasienId");

-- CreateIndex
CREATE INDEX "PemeriksaanLab_kunjunganId_idx" ON "PemeriksaanLab"("kunjunganId");

-- CreateIndex
CREATE INDEX "PemeriksaanLab_tanggalPermintaan_idx" ON "PemeriksaanLab"("tanggalPermintaan");

-- CreateIndex
CREATE INDEX "PemeriksaanLab_pasienId_tanggalPermintaan_idx" ON "PemeriksaanLab"("pasienId", "tanggalPermintaan");

-- CreateIndex
CREATE INDEX "HasilLabItem_pemeriksaanLabId_idx" ON "HasilLabItem"("pemeriksaanLabId");

-- AddForeignKey
ALTER TABLE "PemeriksaanLab" ADD CONSTRAINT "PemeriksaanLab_pasienId_fkey" FOREIGN KEY ("pasienId") REFERENCES "Pasien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PemeriksaanLab" ADD CONSTRAINT "PemeriksaanLab_kunjunganId_fkey" FOREIGN KEY ("kunjunganId") REFERENCES "Kunjungan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PemeriksaanLab" ADD CONSTRAINT "PemeriksaanLab_dokterPemintaId_fkey" FOREIGN KEY ("dokterPemintaId") REFERENCES "Dokter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HasilLabItem" ADD CONSTRAINT "HasilLabItem_pemeriksaanLabId_fkey" FOREIGN KEY ("pemeriksaanLabId") REFERENCES "PemeriksaanLab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
