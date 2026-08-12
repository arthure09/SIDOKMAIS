// Aplikasi ini diasumsikan satu zona waktu (WIB, UTC+7) — belum ada
// per-user timezone. Kalau nanti perlu lebih benar, frontend harus kirim
// offset device eksplisit, bukan asumsi WIB di sini. Dipakai lab/dashboard/
// kalender routes yang tadinya masing-masing nulis ulang math ini sendiri.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// "YYYY-MM-DD" (tanggal kalender LOKAL device, WIB) -> instant UTC awal hari
// itu. Date.parse membaca string tanpa jam sebagai UTC 00:00, jadi digeser
// mundur sebesar offset WIB supaya pas dibandingkan ke kolom DateTime
// Postgres (instant UTC) tidak meleset. Return null kalau `value` bukan
// tanggal valid.
function parseTanggalAwalWIB(value) {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed - WIB_OFFSET_MS);
}

// Sama seperti parseTanggalAwalWIB, tapi instant akhir hari itu (23:59:59.999
// WIB), dipakai sebagai batas atas rentang tanggal inklusif.
function parseTanggalAkhirWIB(value) {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed - WIB_OFFSET_MS + 24 * 60 * 60 * 1000 - 1);
}

// Rentang [mulai, akhir] satu hari kalender WIB penuh dari tengah malam WIB
// (dinyatakan sebagai instant UTC yang secara numerik sama dengan tengah
// malam WIB, mis. hasil Date.UTC(y, m, d) sebelum dikurangi offset).
function rentangDariTengahMalamWIB(tengahMalamWIB) {
  return {
    mulai: new Date(tengahMalamWIB - WIB_OFFSET_MS),
    akhir: new Date(tengahMalamWIB - WIB_OFFSET_MS + 24 * 60 * 60 * 1000 - 1),
  };
}

// Rentang [mulai, akhir] hari kalender WIB tempat `instant` jatuh. `instant`
// (waktu server, UTC) digeser maju 7 jam dulu supaya getUTCFullYear/Month/Date
// yang dibaca adalah tanggal kalender WIB, baru dikonversi ke rentang lewat
// rentangDariTengahMalamWIB.
function rentangHariWIB(instant) {
  const wib = new Date(instant.getTime() + WIB_OFFSET_MS);
  const tengahMalamWIB = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate());
  return rentangDariTengahMalamWIB(tengahMalamWIB);
}

// Hari dalam seminggu menurut kalender WIB (0=Minggu ... 6=Sabtu). Pakai
// getUTCDay setelah digeser +7 jam, bukan getDay, supaya tidak ikut timezone
// mesin yang menjalankan (server/container biasanya UTC).
function hariWIB(instant) {
  return new Date(instant.getTime() + WIB_OFFSET_MS).getUTCDay();
}

// Instant baru pada tanggal kalender WIB yang sama dengan `instant`, tapi
// jam:menit WIB diganti. Dipakai untuk menaruh jadwal dummy di jam yang masuk
// akal — faker.date.* menghasilkan waktu acak sepanjang 24 jam, termasuk dini
// hari, yang untuk poliklinik/operasi jelas keliru.
function setJamWIB(instant, jam, menit = 0) {
  return new Date(rentangHariWIB(instant).mulai.getTime() + jam * 3600000 + menit * 60000);
}

// Geser mundur ke Jumat kalau `instant` jatuh di Sabtu/Minggu WIB. Poliklinik
// dan jadwal operasi elektif tidak berjalan di akhir pekan.
function keHariKerjaWIB(instant) {
  const hari = hariWIB(instant);
  if (hari === 6) return new Date(instant.getTime() - 24 * 3600000); // Sabtu -> Jumat
  if (hari === 0) return new Date(instant.getTime() - 2 * 24 * 3600000); // Minggu -> Jumat
  return instant;
}

module.exports = {
  WIB_OFFSET_MS,
  parseTanggalAwalWIB,
  parseTanggalAkhirWIB,
  rentangDariTengahMalamWIB,
  rentangHariWIB,
  hariWIB,
  setJamWIB,
  keHariKerjaWIB,
};
