/** Field-kit palette — topographic paper, river clay, one accent. */

export const color = {
  accent: '#B5613F',
  dark: '#2A3230',
  olive: '#5C6750',
  sage: '#8A9278',
  mist: '#7F9B99',
  light: '#E3E5DF',
  cream: '#F2F0EA',
  ink: '#1A1A1A',
  phoneBg: '#E7E8E4',
  birds: '#C47A58',
  birdsTag: '#A45D38',
  mapFill: '#E4E6E2',
  mapPark: '#C9D0C4',
  mapWater: '#7F9B99',
  /** Readable secondary text (~4.5:1 on phoneBg / cream / white). Sage stays decorative. */
  muted: '#5A6354',
} as const;

export const darkColor = {
  phoneBg: '#131513',
  cardBg: '#1C1F1D',
  cream: '#222522',
  inkText: '#F2F2F0',
  headerBg: '#171917',
  navBg: '#171917',
  lightBg: '#262A27',
  muted: '#B0B5A6',
  soft: '#8A9278',
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
  muted: color.muted,
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
  /** Same family as UI — hierarchy is size + 400/500, not a second display face. */
  brand: '"Geist Variable", system-ui, sans-serif',
} as const;

/**
 * One family: Geist Variable. 400 body, 500 titles/UI. No 450 / 550 / 600.
 */
export const typeRoles = {
  display: { fontFamily: fonts.ui, fontSize: 32, fontWeight: 500, lineHeight: 1.1, letterSpacing: '-0.03em' },
  title: { fontFamily: fonts.ui, fontSize: 24, fontWeight: 500, lineHeight: 1.2, letterSpacing: '-0.025em' },
  page: { fontFamily: fonts.ui, fontSize: 18, fontWeight: 500, lineHeight: 1.25, letterSpacing: '-0.02em' },
  wordmark: { fontFamily: fonts.ui, fontSize: 17, fontWeight: 500, lineHeight: 1.1, letterSpacing: '-0.02em' },
  heading: { fontFamily: fonts.ui, fontSize: 16, fontWeight: 500, lineHeight: 1.3, letterSpacing: '-0.01em' },
  subtitle: { fontFamily: fonts.ui, fontSize: 15, fontWeight: 500, lineHeight: 1.35, letterSpacing: '-0.005em' },
  body: { fontFamily: fonts.ui, fontSize: 15, fontWeight: 400, lineHeight: 1.5, letterSpacing: '0em' },
  button: { fontFamily: fonts.ui, fontSize: 14, fontWeight: 500, lineHeight: 1.2, letterSpacing: '0em' },
  label: { fontFamily: fonts.ui, fontSize: 12, fontWeight: 500, lineHeight: 1.3, letterSpacing: '0.01em' },
  caption: { fontFamily: fonts.ui, fontSize: 13, fontWeight: 400, lineHeight: 1.45, letterSpacing: '0em' },
  micro: { fontFamily: fonts.ui, fontSize: 11, fontWeight: 500, lineHeight: 1.3, letterSpacing: '0.01em' },
  timer: { fontFamily: fonts.ui, fontSize: 40, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.03em' },
} as const;

export type TypeRole = keyof typeof typeRoles;

export const breakpoint = 768;
