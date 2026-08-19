-- CreateEnum
CREATE TYPE "SifatOperasi" AS ENUM ('ELEKTIF', 'CITO');

-- CreateEnum
CREATE TYPE "JenisPembedahan" AS ENUM ('BERSIH', 'BERSIH_TERKONTAMINASI', 'KONTAMINASI', 'KOTOR');

-- AlterTable
ALTER TABLE "Operasi" ADD COLUMN     "antibiotikProfilaksis" BOOLEAN,
ADD COLUMN     "asistenOperator" TEXT,
ADD COLUMN     "deskripsiOperasi" TEXT,
ADD COLUMN     "diagnosaPascaBedah" TEXT,
ADD COLUMN     "diagnosaPraBedah" TEXT,
ADD COLUMN     "dokterAnestesi" TEXT,
ADD COLUMN     "dokterOperator" TEXT,
ADD COLUMN     "jamMulaiInsisi" TIMESTAMP(3),
ADD COLUMN     "jamSelesai" TIMESTAMP(3),
ADD COLUMN     "jenisAnestesi" TEXT,
ADD COLUMN     "jenisPembedahan" "JenisPembedahan",
ADD COLUMN     "jumlahKehilanganDarah" INTEGER,
ADD COLUMN     "kategoriOperasi" TEXT,
ADD COLUMN     "kejadianToksikasi" TEXT,
ADD COLUMN     "komplikasi" TEXT,
ADD COLUMN     "lokasiAnestesi" TEXT,
ADD COLUMN     "obatAnestesi" TEXT,
ADD COLUMN     "pemasanganImplan" TEXT,
ADD COLUMN     "perawatInstrumentator" TEXT,
ADD COLUMN     "perawatSirkuler" TEXT,
ADD COLUMN     "responHipersensitivitas" TEXT,
ADD COLUMN     "sifatOperasi" "SifatOperasi",
ADD COLUMN     "spesimen" TEXT,
ADD COLUMN     "teknikAnestesiLokal" TEXT,
ADD COLUMN     "tindakanDilakukan" TEXT,
ADD COLUMN     "transfusi" TEXT;
