import { apiFetch } from './client';
import type { OperasiDetail, OperasiListResponse, OperasiStatus } from './types';

type ListParams = {
  status?: OperasiStatus;
  page?: number;
  limit?: number;
};

export function fetchOperasiList(token: string, params: ListParams) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return apiFetch<OperasiListResponse>(`/api/operasi${qs ? `?${qs}` : ''}`, { token });
}

export function fetchOperasiDetail(token: string, operasiId: string) {
  return apiFetch<OperasiDetail>(`/api/operasi/${operasiId}`, { token });
}
