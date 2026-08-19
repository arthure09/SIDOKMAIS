-- `statusVerifikasi` dihapus (keputusan Arthuro, 19 Ags 2026). Kolom itu tidak
-- pernah ada di tabel "Detail Tindakan" SIREMDIS — murni tambahan dari mock
-- lama. Laporan jasa medis cuma perlu satu angka total per kelompok penjamin,
-- bukan dua kolom uang (cair vs diproses) yang harus dijelaskan bedanya.

-- AlterTable
ALTER TABLE "Pendapatan" DROP COLUMN "statusVerifikasi";

-- DropEnum
DROP TYPE "StatusVerifikasiJasa";
