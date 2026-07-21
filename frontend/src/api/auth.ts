import { apiFetch } from './client';
import type { LoginResponse } from './types';

export function login(username: string, password: string) {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
}
