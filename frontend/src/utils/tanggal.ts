// Query param pakai tanggal kalender LOKAL (getFullYear/Month/Date), bukan
// toISOString() yang bisa geser ke hari sebelum/sesudahnya di timezone UTC+.
// Backend membacanya sebagai tanggal WIB.
export function toDateParam(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
