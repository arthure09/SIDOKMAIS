import { apiFetch } from './client';
import type { LoginResponse } from './types';

// Identitas terbaru dari server — mengisi ulang sesi lama di SecureStore yang belum punya `nip`, tanpa memaksa login ulang.
export function fetchMe(token: string) {
  return apiFetch<LoginResponse['pengguna']>('/api/auth/me', { token });
}

export function login(username: string, password: string) {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
}
