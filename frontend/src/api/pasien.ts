import { apiFetch } from './client';
import type {
  AssignmentStatus,
  JenisKunjungan,
  PasienDetail,
  PasienListResponse,
  UrutanPasien,
} from './types';

type ListParams = {
  search?: string;
  status?: AssignmentStatus;
  jenisKunjungan?: JenisKunjungan;
  urutkan?: UrutanPasien;
  page?: number;
  limit?: number;
};

export function fetchPasienList(token: string, params: ListParams) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.jenisKunjungan) query.set('jenisKunjungan', params.jenisKunjungan);
  if (params.urutkan) query.set('urutkan', params.urutkan);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return apiFetch<PasienListResponse>(`/api/pasien${qs ? `?${qs}` : ''}`, { token });
}

export function fetchPasienDetail(token: string, pasienId: string) {
  return apiFetch<PasienDetail>(`/api/pasien/${pasienId}`, { token });
}
