import { create } from 'zustand';
import type { LoginResponse } from '../api/types';

type AuthState = {
  token: string | null;
  pengguna: LoginResponse['pengguna'] | null;
  setAuth: (data: LoginResponse) => void;
  logout: () => void;
};

// In-memory saja untuk Hari 9 — token hilang saat app di-reload.
// Persistence (SecureStore) di luar scope hari ini.
export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  pengguna: null,
  setAuth: (data) => set({ token: data.token, pengguna: data.pengguna }),
  logout: () => set({ token: null, pengguna: null }),
}));
