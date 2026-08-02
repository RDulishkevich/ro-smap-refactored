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
| Secondary / soft surface | `#FEC674` | `#3a3228` | Soft cards, secondary chips |
| Ink | `#222222` | `#FFF3E2` | Body text |
| Accent ink (on cream) | `#9a6420` | `#FEC674` | Links / active labels |
| Surface / panel | `#FFF3E2` | `#222222` | Dock, modals, player |
| Panel elevated | `#fff9f0` | `#2c2c2c` | Inputs, nested surfaces |
| CTA | `#222222` | `#FFF3E2` | Primary buttons, play, FABs |
| CTA ink | `#FFF3E2` | `#222222` | Text on CTA |

**Color ratio (restrained product):** cream panels ~70% · charcoal text/CTA ~20% · peach accent ≤10%.

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
- **Icons:** Iconoir (`iconoir-*`)
- **Glass:** cream-tinted light · charcoal dark; blur only on non-scrolling chrome
- **Yandex API 3:** stock `light`/`dark` + POI off — no palette tint
- Default palette id: `coral` (UI «Персик»)

## Hard constraints
- No `backdrop-filter` on `#player-card`
- No `overflow:hidden` / forced `position` on player children
- `.hidden { display:none !important }`
- Map stays clickable (`pointer-events` split)
- Desktop: `#sidebar.sidebar-hidden` is a no-op
