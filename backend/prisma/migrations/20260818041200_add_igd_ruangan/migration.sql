-- Tahap 1 docs/rencana-revisi-modul-dokter.md: kategori kunjungan
-- (Rawat Jalan / IGD / Rawat Inap) diturunkan dari Ruangan.jenis, bukan kolom
-- baru di Kunjungan. Yang kurang cuma nilai IGD.
ALTER TYPE "RuanganJenis" ADD VALUE 'IGD';
