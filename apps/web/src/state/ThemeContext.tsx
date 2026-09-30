import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { makeTheme, type ThemeTokens } from '@polevka/design';

type ThemeCtx = { th: ThemeTokens; isDark: boolean; toggleTheme: () => void };
const Ctx = createContext<ThemeCtx>({ th: makeTheme(false), isDark: false, toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('polevka_theme') === 'dark'; } catch { return false; }
  });
  const th = useMemo(() => makeTheme(isDark), [isDark]);
  const toggleTheme = () => {
    setIsDark((d) => {
      const next = !d;
      try { localStorage.setItem('polevka_theme', next ? 'dark' : 'light'); } catch { /* */ }
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  };
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('dark', isDark);
  return <Ctx.Provider value={{ th, isDark, toggleTheme }}>{children}</Ctx.Provider>;
}

export const useTh = () => useContext(Ctx).th;
export const useToggleTheme = () => useContext(Ctx).toggleTheme;
export const useIsDark = () => useContext(Ctx).isDark;
