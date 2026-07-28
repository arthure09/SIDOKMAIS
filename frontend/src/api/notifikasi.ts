import { apiFetch } from './client';
import type { NotifikasiItemApi, NotifikasiListResponse } from './types';

type ListParams = {
  isRead?: boolean;
  page?: number;
  limit?: number;
  /** Cuma dipakai server-side kalau role ADMIN — diabaikan untuk DOKTER. */
  dokterId?: string;
};

export function fetchNotifikasiList(token: string, params: ListParams = {}) {
  const query = new URLSearchParams();
  if (params.isRead !== undefined) query.set('isRead', String(params.isRead));
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.dokterId) query.set('dokterId', params.dokterId);

  const qs = query.toString();
  return apiFetch<NotifikasiListResponse>(`/api/notifikasi${qs ? `?${qs}` : ''}`, { token });
}

export function markNotifikasiRead(token: string, id: string) {
  return apiFetch<NotifikasiItemApi>(`/api/notifikasi/${id}/read`, { token, method: 'PATCH' });
}
