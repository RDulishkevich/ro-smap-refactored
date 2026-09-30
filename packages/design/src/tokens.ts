/** Figma Make mobile palette — canonical Полёвка DS (web + future RN). */

export const color = {
  accent: '#B5613F',
  dark: '#2D3C39',
  olive: '#6F7C4E',
  sage: '#9DB170',
  light: '#D9E2C3',
  cream: '#F4E8D8',
  ink: '#1A1A1A',
  phoneBg: '#E8EDEA',
  birds: '#D78763',
  birdsTag: '#B86A3A',
  mapFill: '#E4EDE9',
  mapPark: '#C8D8C2',
  mapWater: '#A8C8CC',
  muted: '#B0B8A8',
} as const;

export const darkColor = {
  phoneBg: '#1A2926',
  cardBg: '#243530',
  cream: '#243530',
  inkText: color.light,
  headerBg: '#1E2E2A',
  navBg: '#1E2E2A',
  lightBg: '#2A3D38',
  border: 'rgba(157,177,112,0.1)',
} as const;

export const lightTheme = {
  phoneBg: color.phoneBg,
  cardBg: '#ffffff',
  cream: color.cream,
  inkText: color.ink,
  headerBg: '#ffffff',
  navBg: '#ffffff',
  lightBg: color.light,
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
  border: string;
  isDark: boolean;
};

export function makeTheme(dark: boolean): ThemeTokens {
  return dark ? darkTheme : lightTheme;
}

export const pinColor: Record<string, string> = {
  nature: color.sage,
  water: color.olive,
  urban: color.accent,
  forest: color.dark,
  birds: color.birds,
};

export const typeMeta: Record<string, { label: string; bg: string; color: string }> = {
  nature: { label: 'Природа', bg: color.light, color: color.olive },
  water: { label: 'Вода', bg: color.light, color: color.dark },
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
  ui: 'Geologica, system-ui, sans-serif',
  brand: 'Klukva, Geologica, serif',
} as const;

export const breakpoint = 768;
