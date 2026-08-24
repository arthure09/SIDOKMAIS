-- CreateTable
CREATE TABLE "PemeriksaanRadiologi" (
    "id" TEXT NOT NULL,
    "pasienId" TEXT NOT NULL,
    "kunjunganId" TEXT,
    "dokterPemintaId" TEXT,
    "dokterPembacaId" TEXT,
    "modalitas" TEXT NOT NULL,
    "namaPemeriksaan" TEXT NOT NULL,
    "unit" TEXT,
    "cito" BOOLEAN NOT NULL DEFAULT false,
    "tanggalPermintaan" TIMESTAMP(3) NOT NULL,
    "tanggalHasil" TIMESTAMP(3),
    "klinis" TEXT,
    "hasil" TEXT NOT NULL,
    "kesan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PemeriksaanRadiologi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PemeriksaanRadiologi_pasienId_idx" ON "PemeriksaanRadiologi"("pasienId");

-- CreateIndex
CREATE INDEX "PemeriksaanRadiologi_kunjunganId_idx" ON "PemeriksaanRadiologi"("kunjunganId");

-- CreateIndex
CREATE INDEX "PemeriksaanRadiologi_pasienId_tanggalPermintaan_idx" ON "PemeriksaanRadiologi"("pasienId", "tanggalPermintaan");

-- AddForeignKey
ALTER TABLE "PemeriksaanRadiologi" ADD CONSTRAINT "PemeriksaanRadiologi_pasienId_fkey" FOREIGN KEY ("pasienId") REFERENCES "Pasien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PemeriksaanRadiologi" ADD CONSTRAINT "PemeriksaanRadiologi_kunjunganId_fkey" FOREIGN KEY ("kunjunganId") REFERENCES "Kunjungan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PemeriksaanRadiologi" ADD CONSTRAINT "PemeriksaanRadiologi_dokterPemintaId_fkey" FOREIGN KEY ("dokterPemintaId") REFERENCES "Dokter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PemeriksaanRadiologi" ADD CONSTRAINT "PemeriksaanRadiologi_dokterPembacaId_fkey" FOREIGN KEY ("dokterPembacaId") REFERENCES "Dokter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
