import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type AppPrefs = {
  notifyInApp: boolean;
  autoplayPin: boolean;
  reduceMotion: boolean;
};

const KEY = 'polevka_prefs';
const DEFAULTS: AppPrefs = { notifyInApp: true, autoplayPin: false, reduceMotion: false };

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

type PrefsCtx = { prefs: AppPrefs; setPref: <K extends keyof AppPrefs>(key: K, value: AppPrefs[K]) => void };
const Ctx = createContext<PrefsCtx>({ prefs: DEFAULTS, setPref: () => {} });

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AppPrefs>(() => {
    const next = readPrefs();
    applyMotion(next.reduceMotion);
    return next;
  });
  const setPref = <K extends keyof AppPrefs>(key: K, value: AppPrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* */ }
      if (key === 'reduceMotion') applyMotion(Boolean(value));
      return next;
    });
  };
  const value = useMemo(() => ({ prefs, setPref }), [prefs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePrefs = () => useContext(Ctx);
