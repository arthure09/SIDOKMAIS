-- Identitas pasien masuk ke baris jasa medis, mengikuti tabel "Detail Tindakan"
-- SIREMDIS (screenshot referensi 19 Ags 2026) yang memang punya kolom NORM dan
-- NAMA PASIEN. Membatalkan keputusan 14 Ags 2026 yang sebelumnya menghilangkan
-- keduanya.
--
-- Baris lama dikosongkan lebih dulu: `pasienId` NOT NULL tidak punya nilai yang
-- masuk akal untuk baris yang sudah ada, dan menebaknya justru menghubungkan
-- pelayanan ke pasien yang salah. Seluruh isinya data dummy hasil seed, jadi
-- dihapus lalu digenerate ulang. Kalau nanti sudah ada data nyata, migrasi
-- seperti ini tidak boleh lagi ditulis begini.
DELETE FROM "Pendapatan";

-- AlterTable
ALTER TABLE "Pendapatan" ADD COLUMN     "pasienId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Pendapatan" ADD CONSTRAINT "Pendapatan_pasienId_fkey" FOREIGN KEY ("pasienId") REFERENCES "Pasien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
