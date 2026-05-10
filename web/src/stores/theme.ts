import { create } from 'zustand';

const STORAGE_KEY = 'sman-admin-theme';
type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  const cached = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (cached === 'light' || cached === 'dark') return cached;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = getInitialTheme();
  applyTheme(initial);

  return {
    theme: initial,
    toggle: () => {
      const next = get().theme === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      set({ theme: next });
    },
  };
});
