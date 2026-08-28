import { apiFetch } from './client';
import type { PendapatanResponse, PeriodePendapatan } from './types';

/** Jasa medis dalam satu rentang tanggal (`YYYY-MM-DD`, keduanya inklusif). Tanpa periode, backend memilih bulan terisi paling baru. */
export function fetchPendapatan(token: string, periode?: PeriodePendapatan | null) {
  const qs = periode
    ? `?tanggalAwal=${periode.tanggalAwal}&tanggalAkhir=${periode.tanggalAkhir}`
    : '';
  return apiFetch<PendapatanResponse>(`/api/pendapatan${qs}`, { token });
}
