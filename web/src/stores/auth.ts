import { create } from 'zustand';

const STORAGE_KEY = 'sman-admin-token';

interface AuthState {
  token: string;
  setToken: (token: string) => void;
  clearToken: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(STORAGE_KEY) || '',
  setToken: (token: string) => {
    localStorage.setItem(STORAGE_KEY, token);
    set({ token });
  },
  clearToken: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ token: '' });
  },
}));
