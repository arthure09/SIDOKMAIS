import { apiFetch } from './client';
import type {
  JenisKunjungan,
  KunjunganDetail,
  KunjunganListResponse,
  LingkupJadwal,
  StatusKunjungan,
} from './types';

type ListParams = {
  // Cakupan layar Jadwal — hanya berpengaruh di mode SIMRS, route dummy mengabaikannya (lihat parseLingkupJadwal di backend/src/utils/queryParams.js).
  lingkup?: LingkupJadwal;
  status?: StatusKunjungan;
  jenisKunjungan?: JenisKunjungan;
  /** 'YYYY-MM-DD' tanggal kalender WIB, inklusif — pakai toDateParam(). */
  dari?: string;
  sampai?: string;
  page?: number;
  limit?: number;
  /**
   * Izinkan server mundur ke tanggal terakhir yang ada datanya kalau tanggal bawaan (hari ini) kosong —
   * jangan dikirim saat dokter memilih tanggal sendiri, hasilnya akan digeser diam-diam. `tanggalData` di
   * response terisi kalau server benar-benar memakainya.
   */
  bolehMundur?: boolean;
};

export function fetchKunjunganList(token: string, params: ListParams) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.jenisKunjungan) query.set('jenisKunjungan', params.jenisKunjungan);
  if (params.dari) query.set('dari', params.dari);
  if (params.sampai) query.set('sampai', params.sampai);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.bolehMundur) query.set('bolehMundur', '1');

  const qs = query.toString();
  return apiFetch<KunjunganListResponse>(`/api/kunjungan${qs ? `?${qs}` : ''}`, { token });
}

export function fetchKunjunganDetail(token: string, kunjunganId: string) {
  return apiFetch<KunjunganDetail>(`/api/kunjungan/${kunjunganId}`, { token });
}
