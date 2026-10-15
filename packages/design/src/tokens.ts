/** Figma Make mobile palette — canonical Полёвка DS (web + future RN). */

export const color = {
  accent: '#B5613F',
  dark: '#2D3C39',
  olive: '#6F7C4E',
  sage: '#9DB170',
  mist: '#92B3B1',
  light: '#D9E2C3',
  cream: '#F4E8D8',
  ink: '#1A1A1A',
  phoneBg: '#E8EDEA',
  birds: '#D78763',
  birdsTag: '#B86A3A',
  mapFill: '#E4EDE9',
  mapPark: '#C8D8C2',
  mapWater: '#92B3B1',
  muted: '#B0B8A8',
} as const;

export const darkColor = {
  phoneBg: '#0B0B0B',
  cardBg: '#171717',
  cream: '#1C1C1C',
  inkText: '#F0F0F0',
  headerBg: '#111111',
  navBg: '#111111',
  lightBg: '#2E2E2E',
  muted: '#A0A0A0',
  soft: '#B0B0B0',
  /** Secondary solid CTA (logout, 2FA) — replaces forest `color.dark` in chrome. */
  solid: '#3A3A3A',
  mapBg: '#121212',
  switchOff: 'rgba(255,255,255,0.2)',
  border: 'rgba(255,255,255,0.12)',
} as const;

export const lightTheme = {
  phoneBg: color.phoneBg,
  cardBg: '#ffffff',
  cream: color.cream,
  inkText: color.ink,
  headerBg: '#ffffff',
  navBg: '#ffffff',
  lightBg: color.light,
  muted: color.olive,
  soft: color.sage,
  solid: color.dark,
  mapBg: color.mapFill,
  switchOff: 'rgba(45,60,57,0.18)',
  border: 'rgba(45,60,57,0.07)',
  isDark: false as const,
};

export const darkTheme = {
  phoneBg: darkColor.phoneBg,
  cardBg: darkColor.cardBg,
  cream: darkColor.cream,
  inkText: darkColor.inkText,
  headerBg: darkColor.headerBg,
  navBg: darkColor.navBg,
  lightBg: darkColor.lightBg,
  muted: darkColor.muted,
  soft: darkColor.soft,
  solid: darkColor.solid,
  mapBg: darkColor.mapBg,
  switchOff: darkColor.switchOff,
  border: darkColor.border,
  isDark: true as const,
};

export type ThemeTokens = {
  phoneBg: string;
  cardBg: string;
  cream: string;
  inkText: string;
  headerBg: string;
  navBg: string;
  lightBg: string;
  muted: string;
  soft: string;
  solid: string;
  mapBg: string;
  switchOff: string;
  border: string;
  isDark: boolean;
};

export function makeTheme(dark: boolean): ThemeTokens {
  return dark ? darkTheme : lightTheme;
}

export const pinColor: Record<string, string> = {
  nature: color.sage,
  water: color.mist,
  urban: color.accent,
  forest: color.dark,
  birds: color.birds,
};

export const typeMeta: Record<string, { label: string; bg: string; color: string }> = {
  nature: { label: 'Природа', bg: color.light, color: color.olive },
  water: { label: 'Вода', bg: 'rgba(146,179,177,0.22)', color: color.mist },
  urban: { label: 'Город', bg: color.cream, color: color.accent },
  forest: { label: 'Лес', bg: 'rgba(45,60,57,0.12)', color: color.dark },
  birds: { label: 'Птицы', bg: color.cream, color: color.birdsTag },
};

export const radius = {
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  fab: 999,
  phone: 48,
  mapNotch: 36,
} as const;

export const fonts = {
  ui: '"Geist Variable", system-ui, sans-serif',
  brand: 'Klukva, Georgia, "Times New Roman", serif',
} as const;

/**
 * Klukva speaks (display / title / page / wordmark) — 400 only, never bold.
 * Geist works (heading → micro) — 400 body, 500 UI. No 450 / 550 / 600.
 */
export const typeRoles = {
  display: { fontFamily: fonts.brand, fontSize: 34, fontWeight: 400, lineHeight: 1.05, letterSpacing: '0em' },
  title: { fontFamily: fonts.brand, fontSize: 26, fontWeight: 400, lineHeight: 1.15, letterSpacing: '0em' },
  page: { fontFamily: fonts.brand, fontSize: 22, fontWeight: 400, lineHeight: 1.15, letterSpacing: '0em' },
  wordmark: { fontFamily: fonts.brand, fontSize: 20, fontWeight: 400, lineHeight: 1, letterSpacing: '0.02em' },
  heading: { fontFamily: fonts.ui, fontSize: 16, fontWeight: 500, lineHeight: 1.3, letterSpacing: '-0.01em' },
  subtitle: { fontFamily: fonts.ui, fontSize: 15, fontWeight: 500, lineHeight: 1.35, letterSpacing: '-0.005em' },
  body: { fontFamily: fonts.ui, fontSize: 15, fontWeight: 400, lineHeight: 1.5, letterSpacing: '0em' },
  button: { fontFamily: fonts.ui, fontSize: 14, fontWeight: 500, lineHeight: 1.2, letterSpacing: '0em' },
  label: { fontFamily: fonts.ui, fontSize: 11, fontWeight: 500, lineHeight: 1.3, letterSpacing: '0.04em' },
  caption: { fontFamily: fonts.ui, fontSize: 13, fontWeight: 400, lineHeight: 1.45, letterSpacing: '0em' },
  micro: { fontFamily: fonts.ui, fontSize: 10, fontWeight: 500, lineHeight: 1.3, letterSpacing: '0.02em' },
} as const;

export type TypeRole = keyof typeof typeRoles;

export const breakpoint = 768;
