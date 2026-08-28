import { apiFetch } from './client';
import type { LingkupJadwal, OperasiDetail, OperasiListResponse, OperasiStatus } from './types';

type ListParams = {
  // Cakupan layar Jadwal — hanya berpengaruh di mode SIMRS, route dummy mengabaikannya (lihat parseLingkupJadwal di backend/src/utils/queryParams.js).
  lingkup?: LingkupJadwal;
  status?: OperasiStatus;
  /** 'YYYY-MM-DD' tanggal kalender WIB, inklusif — pakai toDateParam(). */
  dari?: string;
  sampai?: string;
  page?: number;
  limit?: number;
};

export function fetchOperasiList(token: string, params: ListParams) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.dari) query.set('dari', params.dari);
  if (params.sampai) query.set('sampai', params.sampai);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return apiFetch<OperasiListResponse>(`/api/operasi${qs ? `?${qs}` : ''}`, { token });
}

export function fetchOperasiDetail(token: string, operasiId: string) {
  return apiFetch<OperasiDetail>(`/api/operasi/${operasiId}`, { token });
}
