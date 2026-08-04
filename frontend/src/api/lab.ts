import { apiFetch } from './client';
import type { HasilLabDetail, HasilLabListResponse } from './types';

type ListParams = {
  page?: number;
  limit?: number;
  /** Format "YYYY-MM-DD", filter berdasarkan tanggalPermintaan */
  dariTanggal?: string;
  /** Format "YYYY-MM-DD", filter berdasarkan tanggalPermintaan */
  sampaiTanggal?: string;
};

export function fetchHasilLabList(token: string, pasienId: string, params: ListParams = {}) {
  const query = new URLSearchParams();
  query.set('pasienId', pasienId);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.dariTanggal) query.set('dariTanggal', params.dariTanggal);
  if (params.sampaiTanggal) query.set('sampaiTanggal', params.sampaiTanggal);

  return apiFetch<HasilLabListResponse>(`/api/lab?${query.toString()}`, { token });
}

export function fetchHasilLabDetail(token: string, pemeriksaanLabId: string) {
  return apiFetch<HasilLabDetail>(`/api/lab/${pemeriksaanLabId}`, { token });
}
