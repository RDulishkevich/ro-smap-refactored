/** Motion springs from the Figma mobile prototype. */

export const spring = {
  tab: { type: 'spring' as const, stiffness: 380, damping: 36 },
  stack: { type: 'spring' as const, stiffness: 320, damping: 32 },
  sheet: { type: 'spring' as const, stiffness: 360, damping: 34 },
  nav: { type: 'spring' as const, stiffness: 450, damping: 28 },
  fab: { type: 'spring' as const, stiffness: 420, damping: 26 },
  pill: { type: 'spring' as const, stiffness: 500, damping: 38 },
  chip: { type: 'spring' as const, stiffness: 500, damping: 30 },
  list: { type: 'spring' as const, stiffness: 380, damping: 28 },
  mount: { type: 'spring' as const, stiffness: 240, damping: 28, delay: 0.04 },
};

export const tap = {
  nav: { scale: 0.85 },
  btn: { scale: 0.92 },
  card: { scale: 0.97 },
  cta: { scale: 0.96 },
} as const;
