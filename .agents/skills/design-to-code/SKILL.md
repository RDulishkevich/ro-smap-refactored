---
name: design-to-code
description: >-
  Converts Figma or screenshot designs into Полёвка production UI (React/TSX in
  apps/web, tokens from packages/design). Use when the user says design-to-code,
  implement this Figma, build from mockup, or paste a Figma URL.
---

# Design to code (Полёвка)

1. Read `.agents/skills/polevka-design/SKILL.md` and `packages/design/src/tokens.ts`.
2. Reuse screens in `apps/web/src/screens` and primitives in `apps/web/src/primitives`. Do not paste a new phone shell.
3. Map Figma frames: mobile tab/stack vs desktop rail+map (`useIsDesktop`, 768).
4. Lucide icons, Geologica/Klukva, Motion springs from `@polevka/design`.
5. Wire data through `@polevka/core` (API, sounds, consent). No mock-only screens for production flows.
6. Vanilla `index.html` is legacy until React reaches parity — new UI goes in `apps/web`.
