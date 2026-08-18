import { apiFetch } from './client';
import type {
  KonsultasiDetail,
  KonsultasiListResponse,
  PrioritasKonsultasi,
  StatusKonsultasi,
} from './types';

type ListParams = {
  status?: StatusKonsultasi;
  prioritas?: PrioritasKonsultasi;
  page?: number;
  limit?: number;
};

export function fetchKonsultasiList(token: string, params: ListParams) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.prioritas) query.set('prioritas', params.prioritas);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return apiFetch<KonsultasiListResponse>(`/api/konsultasi${qs ? `?${qs}` : ''}`, { token });
}

export function fetchKonsultasiDetail(token: string, konsultasiId: string) {
  return apiFetch<KonsultasiDetail>(`/api/konsultasi/${konsultasiId}`, { token });
}
