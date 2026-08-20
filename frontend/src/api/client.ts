import { useAuthStore } from '../store/authStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('Tidak bisa terhubung ke server', 0);
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    // Token yang kita kirim ditolak server (kedaluwarsa / dicabut) = sesi sudah
    // mati. Tanpa ini tiap layar cuma menampilkan "Token tidak valid atau
    // kedaluwarsa" dan user terjebak, karena token basi tetap ada di store.
    // logout() mengosongkan token, dan RootNavigator otomatis balik ke Login.
    // Dibatasi ke request yang MEMBAWA token — 401 dari /auth/login itu
    // "password salah", bukan sesi mati.
    if (res.status === 401 && options.token) {
      useAuthStore.getState().logout();
    }

    const message = (json && typeof json.message === 'string') ? json.message : `Request gagal (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return json as T;
}
