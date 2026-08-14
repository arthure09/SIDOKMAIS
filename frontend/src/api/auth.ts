import { apiFetch } from './client';
import type { LoginResponse } from './types';

// Identitas terbaru dari server. Dipakai ProfilDokterScreen supaya sesi lama
// yang tersimpan di SecureStore (login sebelum `nip`/`sip` ikut dikirim) ikut
// terisi tanpa memaksa user login ulang.
export function fetchMe(token: string) {
  return apiFetch<LoginResponse['pengguna']>('/api/auth/me', { token });
}

export function login(username: string, password: string) {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
}
