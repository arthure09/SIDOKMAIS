import { apiFetch } from './client';
import type {
  JenisKunjungan,
  KunjunganDetail,
  KunjunganListResponse,
  LingkupJadwal,
  StatusKunjungan,
} from './types';

type ListParams = {
  // Cakupan layar Jadwal. Hanya berpengaruh di mode SIMRS; route dummy
  // mengabaikannya. Lihat parseLingkupJadwal di backend/src/utils/queryParams.js.
  lingkup?: LingkupJadwal;
  status?: StatusKunjungan;
  jenisKunjungan?: JenisKunjungan;
  /** 'YYYY-MM-DD' tanggal kalender WIB, inklusif — pakai toDateParam(). */
  dari?: string;
  sampai?: string;
  page?: number;
  limit?: number;
  /**
   * Izinkan server mundur ke tanggal terakhir yang ada datanya kalau tanggal
   * yang diminta kosong. HANYA untuk tanggal bawaan (hari ini) — jangan
   * dikirim saat dokter memilih tanggal sendiri, karena hasilnya akan digeser
   * diam-diam. Kalau server memakai ini, `tanggalData` di response terisi.
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
