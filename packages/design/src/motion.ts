/** Motion from the Figma mobile prototype. Opacity/transform only — no layout springs. */

export const spring = {
  tab: { type: 'spring' as const, stiffness: 240, damping: 38, mass: 1 },
  stack: { type: 'spring' as const, stiffness: 220, damping: 36, mass: 1 },
  sheet: { type: 'spring' as const, stiffness: 240, damping: 36, mass: 0.95 },
  nav: { type: 'spring' as const, stiffness: 280, damping: 38, mass: 0.9 },
  fab: { type: 'spring' as const, stiffness: 300, damping: 34, mass: 0.9 },
  pill: { type: 'spring' as const, stiffness: 320, damping: 40, mass: 0.85 },
  chip: { type: 'spring' as const, stiffness: 320, damping: 38, mass: 0.85 },
  list: { type: 'spring' as const, stiffness: 240, damping: 36, mass: 0.95 },
  mount: { type: 'spring' as const, stiffness: 180, damping: 32, mass: 1.05 },
  fade: { type: 'tween' as const, duration: 0.36, ease: [0.16, 1, 0.3, 1] as const },
};

export const tap = {
  nav: { scale: 0.92 },
  btn: { scale: 0.96 },
  card: { scale: 0.985 },
  cta: { scale: 0.97 },
} as const;
