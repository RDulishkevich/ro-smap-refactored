---
name: micro-interactions-framer-motion
description: >-
  Motion implementation for Полёвка: CSS/Motion on web (apps/web), Reanimated
  later on Expo. Use when the user asks for micro-interactions, hover polish,
  stack transitions, FAB, or feel snappier.
---

# Motion (Полёвка)

Web: `motion/react` with tokens from `@polevka/design` (`spring`, `tap`).

- Animate **transform and opacity only**.
- Reuse `spring.tab`, `spring.stack`, `spring.fab` — do not invent one-off durations per screen.
- `AnimatePresence` for tabs (`mode="wait"`) and stack screens.
- Native: same stiffness/damping via Reanimated when `apps/native` grows.

Read `.agents/skills/polevka-microinteractions/SKILL.md` for product rules (toast, auth gate, FAB).
