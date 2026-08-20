// Tanggal untuk QUERY PARAM, bukan untuk ditampilkan: ambil tanggal kalender
// LOKAL device (getFullYear/Month/Date), BUKAN toISOString() yang bisa geser
// ke hari sebelum/sesudahnya kalau device-nya di timezone +.
//
// Backend membacanya sebagai tanggal WIB — lihat backend/src/utils/wib.js.
export function toDateParam(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
