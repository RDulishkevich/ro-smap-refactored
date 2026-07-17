# RO.SMap — Design plan (stabilized)

## Design read
**Reading this as:** product UI for a live audio map, with restrained frosted-glass chrome, leaning toward Impeccable product register + Taste glass aesthetic — not Awwwards maximalism.

## Dials
- DESIGN_VARIANCE: **4** (consistent chrome)
- MOTION_INTENSITY: **3** (state only, 150–250ms)
- VISUAL_DENSITY: **5** (map tool density)

## Must have
1. **Map first** — chrome never steals pan/zoom; overlays use `pointer-events` correctly.
2. **Readable glass** — panels ~60–75% fill + blur 16–20px (map softens behind, text stays crisp).
3. **One grain layer** — cheap static noise, opacity ≤0.04, `pointer-events: none`.
4. **Glass only on chrome shells** — sidebar shell, player shell, map icon buttons, floating panels.
5. **Modals** — semi-solid glass, light blur; scroll must work.
6. **One UI font** — Satoshi/Gilroy stack; Clash Display only for the sidebar brand title.
7. **Accent teal** only for primary/selection/ON toggles.
8. **Glass toggles** in settings (already present).
9. **`prefers-reduced-transparency` / `prefers-reduced-motion`** fallbacks.

## Must avoid
1. `overflow: hidden` on scrollable shells (player, modals, messages) — **broke scroll**.
2. Forcing `position: relative; z-index: 1` on all children — **broke playhead/waveform/absolute UI**.
3. Blur ≥40px + SVG `feTurbulence` on every panel — **lag**.
4. Ultra-low opacity (<30%) glass — unreadable / “dirty” look.
5. Glass on every list row / every nested strip.
6. Page-load choreography, purple SaaS look, Inter, decorative cards.
7. Anything that expands hit-testing over the map.

## Bug fixes in this pass
- Remove overflow/position hacks from `glass.css`.
- Cap blur; drop per-panel SVG filters.
- Keep map clickable; grain never captures events.
- Restore readable contrast for light/dark.
