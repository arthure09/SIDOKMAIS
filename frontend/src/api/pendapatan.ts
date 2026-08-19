import { apiFetch } from './client';
import type { PendapatanResponse } from './types';

/**
 * Jasa medis satu bulan. Tanpa `bulan`, backend memilih bulan terisi paling
 * baru — dipakai saat layar pertama dibuka, sebelum daftar bulannya diketahui.
 */
export function fetchPendapatan(token: string, bulan?: string) {
  const qs = bulan ? `?bulan=${bulan}` : '';
  return apiFetch<PendapatanResponse>(`/api/pendapatan${qs}`, { token });
}
