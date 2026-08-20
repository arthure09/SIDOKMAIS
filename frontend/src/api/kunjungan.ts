import { apiFetch } from './client';
import type { JenisKunjungan, KunjunganDetail, KunjunganListResponse, StatusKunjungan } from './types';

type ListParams = {
  status?: StatusKunjungan;
  jenisKunjungan?: JenisKunjungan;
  /** 'YYYY-MM-DD' tanggal kalender WIB, inklusif — pakai toDateParam(). */
  dari?: string;
  sampai?: string;
  page?: number;
  limit?: number;
};

export function fetchKunjunganList(token: string, params: ListParams) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.jenisKunjungan) query.set('jenisKunjungan', params.jenisKunjungan);
  if (params.dari) query.set('dari', params.dari);
  if (params.sampai) query.set('sampai', params.sampai);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return apiFetch<KunjunganListResponse>(`/api/kunjungan${qs ? `?${qs}` : ''}`, { token });
}

export function fetchKunjunganDetail(token: string, kunjunganId: string) {
  return apiFetch<KunjunganDetail>(`/api/kunjungan/${kunjunganId}`, { token });
}
