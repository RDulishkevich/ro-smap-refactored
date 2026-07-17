# RO.SMap — Design

## Design read
Product UI for a regional audio map. Language: **grainy frosted glass** over live cartography. Type: **Gilroy** (geometric sans). Controls: **glass toggles**. Accent stays teal (Don / field recording), not SaaS blue.

## Dials
- DESIGN_VARIANCE: 5
- MOTION_INTENSITY: 5
- VISUAL_DENSITY: 5

## Materials
- **Signature:** liquid grainy glass — panels stay translucent (`~14–28%` fill) with `blur(52–60px)` so the live map reads through.
- Specular gradient + SVG grain on glass shells.
- Solid fallback only for `prefers-reduced-transparency`.

## Type
- Display: **Clash Display** (bold titles / player title)
- UI: **Satoshi** (with Gilroy + Plus Jakarta fallbacks)


## Color (restrained)
- Light: cool mist surface, white glass panels, teal accent `#0f766e`.
- Dark: near-ink `#0c1412`, translucent charcoal glass, mint accent `#2dd4bf`.
- Accent only for primary actions, selection, switches ON.
