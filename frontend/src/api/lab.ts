import { apiFetch } from './client';
import type { HasilLabDetail, HasilLabListResponse } from './types';

type ListParams = {
  page?: number;
  limit?: number;
};

export function fetchHasilLabList(token: string, pasienId: string, params: ListParams = {}) {
  const query = new URLSearchParams();
  query.set('pasienId', pasienId);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  return apiFetch<HasilLabListResponse>(`/api/lab?${query.toString()}`, { token });
}

export function fetchHasilLabDetail(token: string, pemeriksaanLabId: string) {
  return apiFetch<HasilLabDetail>(`/api/lab/${pemeriksaanLabId}`, { token });
}
