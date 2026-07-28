import { create } from 'zustand';
import type { LoginResponse } from '../api/types';
import { clearSession, loadSession, saveSession } from './authStorage';

type AuthState = {
  token: string | null;
  pengguna: LoginResponse['pengguna'] | null;
  hydrated: boolean;
  setAuth: (data: LoginResponse, rememberMe: boolean) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
};

// "Ingat Saya" nyimpen sesi ke SecureStore biar tetap login setelah app
// ditutup/reload. Kalau nggak dicentang, sesi cuma di-memory (hilang saat
// reload) dan storage lama sengaja dibersihkan supaya nggak ada sesi
// tersimpan yang nyangkut dari login sebelumnya.
export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  pengguna: null,
  hydrated: false,
  setAuth: (data, rememberMe) => {
    set({ token: data.token, pengguna: data.pengguna });
    if (rememberMe) {
      saveSession(data).catch(() => {});
    } else {
      clearSession().catch(() => {});
    }
  },
  logout: () => {
    set({ token: null, pengguna: null });
    clearSession().catch(() => {});
  },
  hydrate: async () => {
    const session = await loadSession();
    set({ token: session?.token ?? null, pengguna: session?.pengguna ?? null, hydrated: true });
  },
}));
