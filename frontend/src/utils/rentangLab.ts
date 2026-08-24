// Rel rujukan: menempatkan satu nilai hasil lab pada rentang rujukannya,
// sebagai pecahan 0..1 supaya layar tinggal memberinya lebar.
//
// Ini murni GEOMETRI, bukan penilaian klinis. Layar tidak boleh memakai
// `diLuar` untuk mewarnai sesuatu sebagai abnormal — penanda abnormal satu-
// satunya tetap `flag` dari backend (lihat catatan di simrs/lab.routes.js:
// menghitung abnormal sendiri dari nilai vs rujukan adalah penafsiran, dan
// backend sengaja tidak melakukannya). `diLuar` hanya dipakai untuk menjepit
// penanda supaya tidak keluar dari rel.

export type RelRujukan = {
  /** Awal segmen rujukan, pecahan 0..1 dari lebar rel. */
  awal: number;
  /** Akhir segmen rujukan, pecahan 0..1. */
  akhir: number;
  /** Posisi nilai hasil, pecahan 0..1 (sudah dijepit ke dalam rel). */
  posisi: number;
  diLuar: boolean;
};

/** "11,4" dan "11.4" sama-sama dipakai di data SIMRS. Teks non-angka -> null. */
export function angkaLab(teks: string | null | undefined): number | null {
  if (teks === null || teks === undefined) return null;
  const bersih = String(teks).trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(bersih)) return null;
  return Number(bersih);
}

/**
 * Bentuk rujukan yang benar-benar muncul: "13.2 - 17.3", "0-35", "< 5",
 * "> 10", "Negatif". Yang terakhir tidak punya rentang numerik -> null.
 * Batas yang null berarti terbuka ("< 5" = tanpa batas bawah).
 */
export function parseRujukan(teks: string | null | undefined): { bawah: number | null; atas: number | null } | null {
  if (!teks) return null;
  const s = String(teks).trim().replace(/,/g, ".");

  // Rentang: pemisahnya bisa "-", en dash, atau "s/d". Tanda minus di angka
  // pertama ikut ditangkap, jadi "-5 - 5" tetap terbaca benar.
  const rentang = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:-|–|s\/d)\s*(-?\d+(?:\.\d+)?)$/i);
  if (rentang) {
    const bawah = Number(rentang[1]);
    const atas = Number(rentang[2]);
    return atas >= bawah ? { bawah, atas } : null;
  }

  const kurang = s.match(/^[<≤]\s*=?\s*(-?\d+(?:\.\d+)?)$/);
  if (kurang) return { bawah: null, atas: Number(kurang[1]) };

  const lebih = s.match(/^[>≥]\s*=?\s*(-?\d+(?:\.\d+)?)$/);
  if (lebih) return { bawah: Number(lebih[1]), atas: null };

  return null;
}

/** null = tidak bisa digambar (hasil kualitatif, rujukan teks, dsb). */
export function hitungRelRujukan(nilai: string | null, rujukan: string | null): RelRujukan | null {
  const v = angkaLab(nilai);
  const r = parseRujukan(rujukan);
  if (v === null || r === null) return null;

  // Domain rel = rentang rujukan diperluas supaya nilai yang meleset jauh tetap
  // kelihatan di dalam rel, plus napas 15% di kedua ujung. Batas terbuka
  // ("< 5") memakai nilai itu sendiri sebagai ujung yang lain.
  let bawah = Math.min(r.bawah ?? v, v);
  let atas = Math.max(r.atas ?? v, v);
  const rentang = atas - bawah || Math.abs(v) || 1;
  bawah -= rentang * 0.15;
  atas += rentang * 0.15;

  const pecahan = (x: number) => (x - bawah) / (atas - bawah);

  return {
    awal: r.bawah === null ? 0 : pecahan(r.bawah),
    akhir: r.atas === null ? 1 : pecahan(r.atas),
    posisi: Math.min(Math.max(pecahan(v), 0), 1),
    diLuar: (r.bawah !== null && v < r.bawah) || (r.atas !== null && v > r.atas),
  };
}
