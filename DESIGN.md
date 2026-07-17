# RO.SMap — Design (from references)

## Design read
**Reading this as:** product chrome for a live audio map, adapted from grainy-glass travel/weather refs (frosted panels over landscape), Gilroy geometric type, coral accent — no green.

## Reference synthesis
| Ref | Take |
|-----|------|
| Mountain glass | Grainy frost over scenery, thin white rim, bold display type |
| Soft login | Pill controls, solid black primary CTA, orange accent, glass cards |
| Fog weather | Cool charcoal glass, nested solid info blocks, mist atmosphere |
| Cabin / trail cards | Large radius (~32–40px), glass pills, clear hierarchy |

## Tokens
- **Glass fill:** light `rgba(255,255,255,0.42–0.55)` · dark `rgba(22,28,34,0.55–0.7)`
- **Rim:** `1px solid rgba(255,255,255,0.35–0.55)` + inset highlight
- **Blur:** 18–22px on non-scrolling chrome only
- **Grain:** one global layer, opacity ~0.05
- **Accent:** coral `#FF5A3D` (waveform / selection / toggles ON)
- **CTA:** near-black `#141414` pills (play / primary FAB)
- **Type:** Gilroy (brand + UI), Clash Display optional for title only

## Hard constraints (keep working)
- No `backdrop-filter` on `#player-card` (scroll/analyzers)
- No `overflow:hidden` / forced `position` on player children
- `.map-icon-btn.hidden { display:none !important }`
- Map layer stays clickable (`pointer-events` split)
