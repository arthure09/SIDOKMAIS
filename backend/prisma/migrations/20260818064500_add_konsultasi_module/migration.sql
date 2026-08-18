-- CreateEnum
CREATE TYPE "PrioritasKonsultasi" AS ENUM ('BIASA', 'CITO');

-- CreateEnum
CREATE TYPE "StatusKonsultasi" AS ENUM ('MENUNGGU_JAWABAN', 'SUDAH_DIJAWAB');

-- CreateTable
CREATE TABLE "Konsultasi" (
    "id" TEXT NOT NULL,
    "pasienId" TEXT NOT NULL,
    "kunjunganId" TEXT,
    "dokterPengirimId" TEXT NOT NULL,
    "dokterTujuanId" TEXT NOT NULL,
    "prioritas" "PrioritasKonsultasi" NOT NULL DEFAULT 'BIASA',
    "status" "StatusKonsultasi" NOT NULL DEFAULT 'MENUNGGU_JAWABAN',
    "tanggalPermintaan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diagnosisKerja" TEXT NOT NULL,
    "kesadaran" TEXT,
    "tekananDarah" TEXT,
    "nadi" INTEGER,
    "pernapasan" INTEGER,
    "suhu" DOUBLE PRECISION,
    "tinggiBadan" INTEGER,
    "beratBadan" DOUBLE PRECISION,
    "nyeri" INTEGER,
    "konsulYangDiminta" TEXT NOT NULL,
    "penemuan" TEXT,
    "diagnosisJawaban" TEXT,
    "anjuran" TEXT,
    "setujuUntuk" TEXT,
    "tanggalJawaban" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Konsultasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Konsultasi_dokterTujuanId_tanggalPermintaan_idx" ON "Konsultasi"("dokterTujuanId", "tanggalPermintaan");

-- CreateIndex
CREATE INDEX "Konsultasi_pasienId_idx" ON "Konsultasi"("pasienId");

-- AddForeignKey
ALTER TABLE "Konsultasi" ADD CONSTRAINT "Konsultasi_pasienId_fkey" FOREIGN KEY ("pasienId") REFERENCES "Pasien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Konsultasi" ADD CONSTRAINT "Konsultasi_kunjunganId_fkey" FOREIGN KEY ("kunjunganId") REFERENCES "Kunjungan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Konsultasi" ADD CONSTRAINT "Konsultasi_dokterPengirimId_fkey" FOREIGN KEY ("dokterPengirimId") REFERENCES "Dokter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Konsultasi" ADD CONSTRAINT "Konsultasi_dokterTujuanId_fkey" FOREIGN KEY ("dokterTujuanId") REFERENCES "Dokter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

