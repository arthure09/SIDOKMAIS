/**
 * Ambil yang belum pernah dimunculkan, lalu tandai semuanya sudah dilihat.
 * `baseline` = poll pertama: isinya cuma dijadikan penanda, tidak dinotifikasi
 * (kalau tidak, tiap buka app semua notifikasi lama muncul lagi).
 * `sudahDilihat` dimutasi di sini — pemanggilnya cuma perlu satu Set.
 *
 * Sengaja dipisah dari notifikasiHp.ts: fungsi ini murni logika, tanpa modul
 * native, jadi self-check-nya bisa dijalankan langsung dengan `node`.
 */
export function serapNotifikasi<T extends { id: string }>(
  data: T[],
  sudahDilihat: Set<string>,
  baseline: boolean,
): T[] {
  const baru = baseline ? [] : data.filter((n) => !sudahDilihat.has(n.id));
  for (const n of data) sudahDilihat.add(n.id);
  return baru;
}
