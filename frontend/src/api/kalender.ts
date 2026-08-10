import { apiFetch } from './client';
import type { CatatanKalenderItem, CatatanKalenderListResponse, TipeCatatanKalender } from './types';

type ListParams = {
  dari?: string;
  sampai?: string;
};

export function fetchCatatanKalenderList(token: string, params: ListParams) {
  const query = new URLSearchParams();
  if (params.dari) query.set('dari', params.dari);
  if (params.sampai) query.set('sampai', params.sampai);

  const qs = query.toString();
  return apiFetch<CatatanKalenderListResponse>(`/api/kalender${qs ? `?${qs}` : ''}`, { token });
}

type CatatanKalenderInput = {
  tanggal: string;
  waktu?: string | null;
  judul: string;
  catatan?: string | null;
  tipe: TipeCatatanKalender;
};

export function createCatatanKalender(token: string, body: CatatanKalenderInput) {
  return apiFetch<CatatanKalenderItem>('/api/kalender', { method: 'POST', token, body });
}

export function updateCatatanKalender(token: string, id: string, body: Partial<CatatanKalenderInput>) {
  return apiFetch<CatatanKalenderItem>(`/api/kalender/${id}`, { method: 'PATCH', token, body });
}

export function deleteCatatanKalender(token: string, id: string) {
  return apiFetch<null>(`/api/kalender/${id}`, { method: 'DELETE', token });
}
