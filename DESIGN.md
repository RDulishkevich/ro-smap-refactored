# RO.SMap — Design

## Design read
**Reading this as:** map-first product chrome (logistics-dashboard architecture): full-bleed map, left icon rail, always-visible floating catalog dock (compact ↔ expanded), top search toolbar, contextual player — grainy glass, Gilroy, coral accent (no green/lime).

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
| `#app-rail` | Library / Feed / Expeditions (desktop) |
| `#sidebar` dock | Always visible on `md+`; mobile drawer via burger |
| Compact / Expanded | `#dock-expand-btn` + `localStorage` `rosmap-dock-expanded` |
| `#map-top-toolbar` | Search + active filter chips |
| `#player-card` | Floating contextual card beside dock |
| `#fab-add` | Bottom-right on desktop |

## Tokens
- **Glass fill:** light `rgba(255,255,255,0.42–0.55)` · dark `rgba(22,28,34,0.55–0.7)`
- **Rim:** `1px solid rgba(255,255,255,0.35–0.55)` + inset highlight
- **Blur:** 18–22px on non-scrolling chrome only
- **Grain:** one global layer, opacity ~0.05
- **Accent:** coral `#FF5A3D`
- **CTA:** near-black `#141414` pills
- **Type:** Gilroy (brand + UI)

## Hard constraints (keep working)
- No `backdrop-filter` on `#player-card` (scroll/analyzers)
- No `overflow:hidden` / forced `position` on player children
- `.map-icon-btn.hidden { display:none !important }`
- Map layer stays clickable (`pointer-events` split)
- Desktop: `#sidebar.sidebar-hidden` is a no-op (dock always open)
