# Полёвка — Design

## Design read
**Reading this as:** sound map first — listen, find, and add field recordings on a full-bleed map. Soft cream windows, peach accents (not flat peach fills), charcoal CTAs. Type pair **Geologica (UI) + Klukva (brand)**. Brand: **Полёвка**.

## Product focus
Карта звуков: слушать · находить · добавлять. Social / expeditions / admin are secondary surfaces — never crowd the listen loop.

## Visual architecture

```
┌──────┬────────────┬─────────────────────────────┬──────────┐
│ Rail │ Catalog    │  Top toolbar (search/tags)  │ Events   │
│ icons│ Dock       │                             │ cluster  │
│      │ (always on │         MAP                 │          │
│      │  desktop)  │                             │          │
│      │            │  Player card ───     FABs   │          │
└──────┴────────────┴─────────────────────────────┴──────────┘
```

| Zone | Behavior |
|------|----------|
| `#app-rail` | Top: Library / Feed / Expeditions · Bottom: Messages / Settings / Help / Profile / Logout |
| `#sidebar` dock | **Viewer window**: library, feed, expeditions, sound details, analyzers |
| Compact / Expanded | `#dock-expand-btn` + `localStorage` `rosmap-dock-expanded` |
| `#map-top-toolbar` | Search + active filter chips |
| `#map-top-right-controls` | Events (both); messages/notifications on mobile after login |
| `#player-card` | Compact playback chrome (analyzers open in dock) |
| `#fab-add` | Add sound only (Guessr → Help FAQ) |
| `#mobile-bottom-nav` | Peach bar: Library / Feed / Map / Expeditions / Profile |

## Color tokens (peach palette — restrained, not monochrome)

| Role | Light | Dark | Use |
|------|-------|------|-----|
| Accent | `#FBAB57` | `#FBAB57` | Active, switches, waveform, mobile nav, soft fills |
| Soft surface | `#FEC674` | `#3a3228` | Chips, selected soft cards, accent islands |
| Ink | `#222222` | `#FFF3E2` | Body text |
| Accent ink | `#9a6420` | `#FEC674` | Links / active labels |
| On accent fill | `#222222` | `#222222` | Text/icons on peach (never white) |
| Page surface | `#FFF3E2` | `#1a1a1a` | App page behind chrome |
| Windows / panels | `#FFF9F0` | `#2c2c2c` | Dock, modals, player |
| Panel elevated | `#FFFFFF` | `#363636` | Inputs, nested surfaces |
| CTA | `#222222` | `#FFF3E2` | Primary buttons, play, FABs |
| CTA ink | `#FFF3E2` | `#222222` | Text on CTA |
| Muted | `#6b5340` | `#b8a894` | Secondary labels (never slate-400 on panels) |

**Color ratio:** cream windows ~70% · charcoal text/CTA ~20% · peach accent ≤10% (nav bar, chips, active states — not entire panels).

## Radii
`--radius-md` 1.35rem · `--radius-lg` 1.85rem · `--radius-xl` 2.15rem · `--radius-2xl` 2.5rem.

## Buttons
- **Primary** (`.ds-btn.ds-btn--primary`): charcoal fill, cream ink — use for all main CTAs (auth, publish, save)
- **Accent** (`.ds-btn--accent` / mobile nav): peach fill, charcoal ink
- **Soft** (`.ds-btn--soft` / `.ds-soft-fill`): peach soft islands
- **Link** (`.ds-link`): accent-ink text links
- **Ghost**: transparent + rim
- Do **not** ship new `bg-blue-*` / `text-indigo-*` in markup — remaps exist only as legacy safety net
- Press: `scale(0.97)`, ~180ms ease-out — no `transition: all`
- Focus: visible `:focus-visible` ring (accent)
- Touch targets: chrome icon buttons ≥2.75rem (44px)

## Typography
| Role | Family | Notes |
|------|--------|-------|
| UI / body | **Geologica** | Default `data-font="geo-klukva"` |
| Brand / titles | **Klukva** | Optical bump; prefer for brand moments, not dense tool labels |

Fonts + alternate palettes live under Settings → **Эксперимент** (collapsed). Default product look stays Geologica+Klukva / Персик. Player track title uses **Geologica** (tool UI); Klukva for `#dock-title` / brand moments.

## Other
- **Icons:** Iconsax (`icon-*`)
- **Glass:** cream-tinted floating chrome; solid opaque dock/player (no blur on scroll)
- **Yandex API 3:** stock `light`/`dark` + POI off — no palette tint
- Default palette id: `coral` (UI «Персик»)
- Zoom allowed (no `user-scalable=no`)

## Hard constraints
- No `backdrop-filter` on `#player-card` or `#sidebar`
- No `overflow:hidden` / forced `position` on player children
- `.hidden { display:none !important }`
- Map stays clickable (`pointer-events` split)
- Desktop: `#sidebar.sidebar-hidden` is a no-op
- Icon-only controls need `aria-label`
