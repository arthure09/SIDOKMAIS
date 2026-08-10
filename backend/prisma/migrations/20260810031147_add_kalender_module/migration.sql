-- CreateEnum
CREATE TYPE "TipeCatatanKalender" AS ENUM ('REMINDER', 'BLOCKING', 'PRIBADI');

-- CreateTable
CREATE TABLE "CatatanKalender" (
    "id" TEXT NOT NULL,
    "dokterId" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "waktu" TEXT,
    "judul" TEXT NOT NULL,
    "catatan" TEXT,
    "tipe" "TipeCatatanKalender" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatatanKalender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatatanKalender_dokterId_idx" ON "CatatanKalender"("dokterId");

-- CreateIndex
CREATE INDEX "CatatanKalender_tanggal_idx" ON "CatatanKalender"("tanggal");

-- AddForeignKey
ALTER TABLE "CatatanKalender" ADD CONSTRAINT "CatatanKalender_dokterId_fkey" FOREIGN KEY ("dokterId") REFERENCES "Dokter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
