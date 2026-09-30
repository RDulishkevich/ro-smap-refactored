---
name: responsive-layout-auditor
description: >-
  Audits desktop vs mobile chrome for Полёвка React app (768px). Use when the
  user says responsive layout auditor, check mobile/desktop, chrome leak, or
  audit breakpoints.
---

# Responsive layout auditor

Breakpoint: `window.innerWidth < 768` / `useIsDesktop()`.

## Must

- Mobile: 3 tabs (feed / map / profile) + stack. Map FAB in the nav notch.
- Desktop: rail 72px + map; library/feed/expeditions as 380px panel, not a phone mock.
- Same `ScreenContent` for pushed screens on both.
- Confirm dialogs stay compact-centered; do not copy map chrome buttons onto both rail and map on desktop.

## Hunt

- `md:` hiding that fights `hidden`.
- Duplicate messages/notifications on desktop (rail is enough).
- Half-height sheets for primary surfaces on mobile.

See `docs/responsive-chrome.md` and `apps/web/src/layouts`.
