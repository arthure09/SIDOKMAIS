-- Tahap 4 docs/rencana-revisi-modul-dokter.md — Pendapatan berhenti jadi turunan
-- Operasi dan jadi satu baris jasa medis per pelayanan (operasi, konsul, dsb).
--
-- Tabel lama di-DROP, bukan di-ALTER: seluruh isinya data dummy hasil seed dan
-- dua kolomnya (tarifTotal, jumlahDiterimaDokter) diganti satu kolom `jasa`,
-- jadi tidak ada yang perlu dipindahkan. Ini fase dummy — kalau nanti sudah ada
-- data nyata, migrasi seperti ini tidak boleh lagi ditulis begini.

-- CreateEnum
CREATE TYPE "StatusVerifikasiJasa" AS ENUM ('MENUNGGU', 'TERVERIFIKASI');

-- AlterTable
ALTER TABLE "Penjamin" ADD COLUMN     "isJkn" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "Pendapatan";

-- CreateTable
CREATE TABLE "Pendapatan" (
    "id" TEXT NOT NULL,
    "dokterId" TEXT NOT NULL,
    "penjaminId" TEXT NOT NULL,
    "namaTindakan" TEXT NOT NULL,
    "tanggalTindakan" TIMESTAMP(3) NOT NULL,
    "jasa" DECIMAL(14,2) NOT NULL,
    "unitPelayanan" TEXT NOT NULL,
    "statusVerifikasi" "StatusVerifikasiJasa" NOT NULL DEFAULT 'TERVERIFIKASI',
    "isDummy" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pendapatan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pendapatan_dokterId_tanggalTindakan_idx" ON "Pendapatan"("dokterId", "tanggalTindakan");

-- AddForeignKey
ALTER TABLE "Pendapatan" ADD CONSTRAINT "Pendapatan_dokterId_fkey" FOREIGN KEY ("dokterId") REFERENCES "Dokter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pendapatan" ADD CONSTRAINT "Pendapatan_penjaminId_fkey" FOREIGN KEY ("penjaminId") REFERENCES "Penjamin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
