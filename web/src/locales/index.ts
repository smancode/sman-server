import { create } from 'zustand';
import zhCN from './zh-CN.json';
import enUS from './en-US.json';

type LocaleDict = Record<string, { text: string; context?: string }>;

const translations: Record<string, LocaleDict> = {
  'zh-CN': zhCN as unknown as LocaleDict,
  'en-US': enUS as unknown as LocaleDict,
};

interface LocaleState {
  locale: string;
}

const LOCALE_CACHE_KEY = 'sman-admin-locale';

function getInitialLocale(): string {
  const cached = localStorage.getItem(LOCALE_CACHE_KEY);
  if (cached && translations[cached]) return cached;

  const browserLang = navigator.language || '';
  if (browserLang.toLowerCase().startsWith('zh')) return 'zh-CN';
  return 'en-US';
}

const useLocaleStore = create<LocaleState>(() => ({
  locale: getInitialLocale(),
}));

export function setLocale(locale: string) {
  if (!translations[locale]) {
    console.warn(`[i18n] Unsupported locale: ${locale}, falling back to zh-CN`);
    useLocaleStore.setState({ locale: 'zh-CN' });
    localStorage.setItem(LOCALE_CACHE_KEY, 'zh-CN');
    return;
  }
  useLocaleStore.setState({ locale });
  localStorage.setItem(LOCALE_CACHE_KEY, locale);
}

export function t(key: string, params?: Record<string, string>): string {
  const currentLocale = useLocaleStore.getState().locale;

  let text = translations[currentLocale]?.[key]?.text || translations['zh-CN']?.[key]?.text;
  if (text) {
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`\${${k}}`, v);
      }
    }
    return text;
  }

  console.error(`[i18n] Missing key: "${key}"`);
  return key;
}

export function getCurrentLocale(): string {
  return useLocaleStore.getState().locale;
}

export function useLocale() {
  return useLocaleStore((s) => s.locale);
}
