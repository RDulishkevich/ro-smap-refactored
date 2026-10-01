/** Motion springs from the Figma mobile prototype. */

export const spring = {
  tab: { type: 'tween' as const, duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
  stack: { type: 'tween' as const, duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
  sheet: { type: 'tween' as const, duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
  nav: { type: 'tween' as const, duration: 0.16, ease: [0.22, 1, 0.36, 1] as const },
  fab: { type: 'tween' as const, duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
  pill: { type: 'tween' as const, duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
  chip: { type: 'tween' as const, duration: 0.16, ease: [0.22, 1, 0.36, 1] as const },
  list: { type: 'tween' as const, duration: 0.16, ease: [0.22, 1, 0.36, 1] as const },
  mount: { type: 'tween' as const, duration: 0.16, ease: [0.22, 1, 0.36, 1] as const },
  fade: { type: 'tween' as const, duration: 0.16, ease: [0.22, 1, 0.36, 1] as const },
};

export const tap = {
  nav: { scale: 0.98 },
  btn: { scale: 0.97 },
  card: { scale: 0.995 },
  cta: { scale: 0.98 },
} as const;
