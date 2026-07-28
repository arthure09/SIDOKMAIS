import * as SecureStore from 'expo-secure-store';
import type { LoginResponse } from '../api/types';

const SESSION_KEY = 'sidokmais_auth_session';

export async function saveSession(data: LoginResponse) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(data));
}

export async function loadSession(): Promise<LoginResponse | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LoginResponse) : null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
