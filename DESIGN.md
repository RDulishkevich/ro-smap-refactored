# Полёвка — Design

## Design read
**Reading this as:** map-first product chrome — full-bleed map, left icon rail, floating catalog dock, top search, contextual player. Soft cream panels, peach accent, charcoal CTAs. Type pair **Geologica (UI) + Klukva (brand)**. Brand: **Полёвка**.

## Visual architecture

```
┌──────┬────────────┬─────────────────────────────┬──────────┐
│ Rail │ Catalog    │  Top toolbar (search/tags)  │ Profile  │
│ icons│ Dock       │                             │ cluster  │
│      │ (always on │         MAP                 │          │
│      │  desktop)  │                             │          │
│      │            │  Player card ───     FABs   │          │
└──────┴────────────┴─────────────────────────────┴──────────┘
```

| Zone | Behavior |
|------|----------|
| `#app-rail` | Top: Library / Feed / Expeditions · Bottom: Messages / Settings / Profile / Logout |
| `#sidebar` dock | **Viewer window**: library, feed, expeditions, sound details, analyzers |
| Compact / Expanded | `#dock-expand-btn` + `localStorage` `rosmap-dock-expanded` |
| `#map-top-toolbar` | Search + active filter chips |
| `#map-top-right-controls` | Notifications (desktop); + account on mobile |
| `#player-card` | Compact playback chrome (analyzers open in dock) |
| `#fab-add` | Bottom-right on desktop |
| `#mobile-bottom-nav` | Peach accent bar, charcoal icons (mobile) |

## Color tokens (exact hex)

| Role | Light | Dark | Use |
|------|-------|------|-----|
| Accent | `#FBAB57` | `#FBAB57` | Active, switches, waveform, soft fills |
| Secondary / soft surface | `#FEC674` | `#FBAB57` | Soft fills, accent chips |
| Ink | `#222222` | `#FFF3E2` | Body text |
| Accent ink (on cream) | `#9a6420` | `#FEC674` | Links / active labels |
| On accent fill | `#222222` | `#222222` | Text/icons on peach (never white) |
| Page surface | `#FFF3E2` | `#222222` | App chrome / map-adjacent fills |
| Windows / panels | `#FEC674` | `#2c2c2c` | Dock, modals, player, sheets |
| Panel elevated | `#FFF3E2` | `#222222` | Inputs, nested surfaces |
| CTA | `#222222` | `#FFF3E2` | Primary buttons, play, FABs |
| CTA ink | `#FFF3E2` | `#222222` | Text on CTA |

**Color ratio (restrained product):** cream page · peach windows · charcoal text/CTA · peach accent on chrome ≤10%.

## Radii
Cards / dock / modals use soft product radii: `--radius-md` 1.35rem · `--radius-lg` 1.85rem · `--radius-xl` 2.15rem · `--radius-2xl` 2.5rem.

## Buttons
- **Primary** (`.ds-btn--primary` / `#auth-action-btn` / play / FAB): charcoal fill, cream ink
- **Accent** (`.ds-btn--accent` / mobile nav): peach fill, charcoal ink
- **Soft** (`.ds-btn--soft`): secondary peach / elevated dark
- **Ghost**: transparent + rim
- Press feedback: `scale(0.97)`, ~180ms ease-out — no `transition: all`

## Typography
| Role | Family | Notes |
|------|--------|-------|
| UI / body | **Geologica** | Default `data-font="geo-klukva"` |
| Brand / titles | **Klukva** | Optical bump `--font-brand-optical: 1.16` |
| Klukva-only | Klukva | `--font-optical: 1.12` (reads small at 1:1) |

Product scale (fixed rem, ~1.125–1.2): `--text-xs` … `--text-2xl`. Body line-height ~1.48; brand titles tighter + `text-wrap: balance`.

## Other
- **Icons:** Iconsax (`icon-*` via iconsax-font-icon CDN)
- **Glass:** peach-tinted light windows · charcoal dark; blur only on non-scrolling chrome
- **Yandex API 3:** stock `light`/`dark` + POI off — no palette tint
- Default palette id: `coral` (UI «Персик»)

## Hard constraints
- No `backdrop-filter` on `#player-card`
- No `overflow:hidden` / forced `position` on player children
- `.hidden { display:none !important }`
- Map stays clickable (`pointer-events` split)
- Desktop: `#sidebar.sidebar-hidden` is a no-op
