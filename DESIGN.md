# RO.SMap — Design

## Design read
Product UI for a regional audio map. Language: **grainy frosted glass** over live cartography. Type: **Gilroy** (geometric sans). Controls: **glass toggles**. Accent stays teal (Don / field recording), not SaaS blue.

## Dials
- DESIGN_VARIANCE: 5
- MOTION_INTENSITY: 5
- VISUAL_DENSITY: 5

## Materials
- **Glass:** `backdrop-filter` + translucent fill + 1px rim highlight + shared SVG grain (low opacity). Solid fallback when `prefers-reduced-transparency`.
- **Map chrome / sidebar / player / settings shell** share `.glass` vocabulary — purposeful glass, not decorative card soup.
- **Motion:** 150–250ms product transitions; ease-out expo; `prefers-reduced-motion` strips transforms to opacity/instant.

## Type
- UI + brand: Gilroy (400/500/600/700), fallbacks: Plus Jakarta Sans, system-ui.
- Tracking on titles: −0.02em to −0.03em. No display/serif pairing.

## Color (restrained)
- Light: cool mist surface, white glass panels, teal accent `#0f766e`.
- Dark: near-ink `#0c1412`, translucent charcoal glass, mint accent `#2dd4bf`.
- Accent only for primary actions, selection, switches ON.
