import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { DICT, type I18nKey, type Locale } from '../lib/i18n';

export type AppPrefs = {
  notifyInApp: boolean;
  notifyDevice: boolean;
  autoplayPin: boolean;
  reduceMotion: boolean;
  locale: Locale;
};

const KEY = 'polevka_prefs';
const DEFAULTS: AppPrefs = { notifyInApp: true, notifyDevice: true, autoplayPin: false, reduceMotion: false, locale: 'ru' };

function readPrefs(): AppPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function applyMotion(on: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('pv-reduce-motion', on);
}

function applyLocale(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale === 'en' ? 'en' : 'ru';
}

type PrefsCtx = { prefs: AppPrefs; setPref: <K extends keyof AppPrefs>(key: K, value: AppPrefs[K]) => void };
const Ctx = createContext<PrefsCtx>({ prefs: DEFAULTS, setPref: () => {} });

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AppPrefs>(() => {
    const next = readPrefs();
    applyMotion(next.reduceMotion);
    applyLocale(next.locale || 'ru');
    return { ...DEFAULTS, ...next };
  });
  const setPref = <K extends keyof AppPrefs>(key: K, value: AppPrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* */ }
      if (key === 'reduceMotion') applyMotion(Boolean(value));
      if (key === 'locale') applyLocale(value as Locale);
      return next;
    });
  };
  const value = useMemo(() => ({ prefs, setPref }), [prefs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePrefs = () => useContext(Ctx);

export function useT() {
  const { prefs } = usePrefs();
  const locale: Locale = prefs.locale === 'en' ? 'en' : 'ru';
  return (key: I18nKey) => DICT[locale][key] || DICT.ru[key];
}
