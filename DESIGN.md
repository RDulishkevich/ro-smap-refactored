# Полёвка — Design

## Design read
**Reading this as:** sound map first — listen, find, and add field recordings on a full-bleed map. Soft cream windows, peach accents, charcoal CTAs. Type pair **Geologica (UI) + Klukva (brand)**. Brand: **Полёвка**.

**Mobile (<768):** design system is the **Wellness peach/cream reference** (floating peach dock, white center +, soft 24–32px cards, cream pages, heavy Geologica titles with peach accent words). Desktop keeps map chrome + Wispr rim grammar.

## Product focus
Карта звуков: слушать · находить · добавлять. Social / expeditions / admin are secondary surfaces — never crowd the listen loop.

---

## Mobile Wellness DS (canonical for &lt;768)

Source: mobile peach/cream/charcoal reference (Health & Wellness mock). Implementation: `src/mobile-wellness.css`.

| Token / pattern | Value / rule |
|-----------------|--------------|
| Page | cream `#FFF8F0` (dark `#1A1A1A`) |
| Accent dock / fills | peach `#FBAB57` · soft `#FEC674` |
| Contrast cards | charcoal `#222` / `#1A1A1A` |
| Elevated cards | white / `#2c2c2c` dark · soft diffuse shadow |
| Radii | cards 24 · sheets 28 · dock 32 (`--well-radius-*`) |
| Bottom nav | **floating** peach pill (side inset + bottom gap), icons only, active = black dot |
| Center FAB | white circle + charcoal `+`, elevated over dock |
| Titles | Geologica **700**, tight tracking; peach `.type-accent` on key word |
| Eyebrows | ALL CAPS · tracking ~0.12em · muted |
| Brand wordmark | Klukva @400 only |
| Map chrome | solid cream/white pills, soft shadow, no blur |
| Card primitives | `.ds-card` · `.ds-card--peach` · `.ds-card--ink` |

Do **not** invent a second mobile chrome. Desktop FAB `#fab-add` stays; on mobile it is hidden (Add = nav FAB).

---

## Symbiosis: Полёвка × Wispr Flow (desktop / shared grammar)

We do **not** paste Wispr’s lavender/teal marketing palette or Garamond/Figtree into the app.  
We keep **Полёвка identity** and adopt **Wispr’s structural grammar** (rim, surfaces, live ember, badges, waveform, elevation).

Source: Wispr Flow style reference (`Downloads/Design/1`). Mobile chrome metrics: iOS/Android grid (safe areas via `env()`).

### Rule of ownership

| Layer | Owner | Meaning |
|-------|--------|---------|
| Color identity, fonts, icons, map chrome, product flows | **Полёвка** | Peach ≤10%, cream windows, Geologica + Klukva, Iconsax |
| Borders, elevation, live signal, tag/badge geometry, button rim recipe, brand weight | **Wispr grammar** | 2px ink rim, fill+rim over shadow, ember=live, square tags vs pills, display @400 |
| System insets / touch floors | **Platform grid** | `env(safe-area-*)`; touch ≥44 (iOS) / map chrome 48 (Android) |

### Color map (Wispr → Полёвка)

| Wispr token | Wispr hex | Полёвка token | Our hex (light) | Notes |
|-------------|-----------|---------------|-----------------|-------|
| Lumen Cream | `#ffffeb` | `--surface-page` / `--panel-solid` | `#FFF3E2` / `#FFF9F0` | Keep our cream — warmer peach paper |
| Lumen Stone | `#e4e4d0` | `--surface-stone` | `#F5E6D4` | Cream −1 for tags / soft dividers |
| Vast Ink | `#1a1a1a` | `--ink` / `--cta` (light) | `#222222` | Same role; charcoal is shared |
| Charcoal | `#222222` | `--ink` / `--on-accent` | `#222222` | Identical |
| Fog | `#8a8a80` | `--ink-muted` | `#6b5340` | Warm muted, not cool gray |
| Ember Glow | `#ffa946` | `--accent` / `--surface-live` | `#FBAB57` | **Live only**: playing, active mic, status — not panel fills |
| Lavender Whisper | `#f0d7ff` | *(no lavender)* | — | Role → **soft action**: `--accent-soft` / `.ds-btn--soft` / `.ds-btn--outline`. Primary CTA stays charcoal |
| Forest Ink | `#034f46` | *(no teal)* | — | Role → dark/ink badges on elevated surfaces; do not import teal |
| Pure White | `#ffffff` | `--panel-elevated` | `#FFFFFF` | Nested surfaces / inputs |

**Color ratio (Полёвка):** cream windows ~70% · charcoal text/CTA ~20% · peach (ember) ≤10%.

### Type map

| Wispr role | Wispr face | Полёвка |
|------------|------------|---------|
| Display / editorial | EB Garamond @400, big scale | **Klukva @400** — size, not bold; dock title / brand moments |
| UI / body / buttons | Figtree | **Geologica** — all interactive chrome |
| Marketing display 48–120px | Garamond | Landing only later — **not** in map chrome |

Product type scale (app):  
`--text-caption` 11 · `--text-body-sm` 13 · `--text-body` 16 · `--text-subheading` 20 · `--text-heading-sm` 24 · `--text-heading` 32 · `--text-display` 40 · eyebrow tracking `--tracking-eyebrow`

### Structure map (Wispr recipes → our classes)

| Wispr component | Grammar we keep | Our implementation |
|-----------------|-----------------|--------------------|
| Primary CTA (lavender + 2px ink) | Soft fill needs **2px defined edge** | `.ds-btn--primary` charcoal + rim; `.ds-btn--accent` / `--soft` peach + **2px `#222` rim** |
| Outlined secondary | Cream + 2px ink | `.ds-btn--outline` |
| Ghost / text | No fill, underline on hover | `.ds-btn--ghost` / `.ds-link` |
| Waveform visualizer | Cream pill, 2px ink, 5–7 bars, pulse when live | `#player-wave-pill.wave-pill` + `.is-live` (bars → peach ember) |
| Teal status badge | Pill status | `.ds-badge` / `.badge-chip` (peach/ink, not teal) |
| Dark square badge | Sharp 8px tags | `.ds-tag`, `.details-keyword-chip`, sidebar tags (`--radius-tag` 8px) |
| Hand-drawn underline | Accent scribble under key words | `.ds-scribble` (peach wavy underline) |
| Shadowless elevation | Fill + rim, not heavy shadow | `--control-rim`, soft `--glass-elev` only |
| Cream ↔ dark chambers | Alternating rooms | App: page / window / elevated / live surfaces — **not** full-bleed marketing bands |

### Explicitly not adopted (Wispr marketing)

- Lavender / forest teal hexes  
- EB Garamond / Figtree  
- 120px display headlines in product UI  
- Full-bleed cream↔black section rhythm on the map shell  
- Shadow ban so strict it kills map FAB depth — we keep a **soft** elev on floating chrome  

### Mobile grid (platform, not Wispr)

| Token | Value | Source |
|-------|-------|--------|
| `--mobile-cols` | 4 | Both |
| `--mobile-margin` / `--mobile-gutter` | 16px | Android; denser than iOS 20 for map |
| `--mobile-touch-min` | 44px | iOS floor |
| `--mobile-touch` | 48px | Android floor (map chrome) |
| `--mobile-nav-h` | 56px | Android bottom nav content |
| `--sab` / `--sat` | `env(safe-area-*)` | Never hardcode 34/48 |

Utilities: `.mobile-grid-4`, `.mobile-pad-x`.

---

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
| `#player-card` | Compact playback + `.wave-pill` live indicator |
| `#fab-add` | Desktop only. Mobile: white center FAB in floating peach dock |
| `#mobile-bottom-nav` | Wellness floating peach pill · icons · elevated white **+** · re-tap → map |

## Color tokens (resolved)

| Role | Light | Dark | Use |
|------|-------|------|-----|
| Accent / live (ember) | `#FBAB57` | `#FBAB57` | Playing, active, switches, mobile nav — **not** panel fills |
| Soft | `#FEC674` | `#3a3228` | Soft action islands, selected chips |
| Ink / CTA | `#222222` | cream inverted | Text, primary buttons, rims |
| Accent ink | `#9a6420` | `#FEC674` | Links |
| On accent | `#222222` | `#222222` | Ink on peach |
| Page | `#FFF3E2` | `#1a1a1a` | Behind chrome |
| Window | `#FFF9F0` | `#2c2c2c` | Dock, modals, player |
| Elevated | `#FFFFFF` | `#363636` | Inputs |
| Stone | `#F5E6D4` | `#3a3228` | Tags / dividers |
| Muted | `#6b5340` | `#b8a894` | Secondary labels |
| Eco geo | `#4C6A73` | same / slightly lightened | Геофония markers |
| Eco bio | `#6B7F4E` | same / slightly lightened | Биофония markers |
| Eco anthro | `#963417` | same / slightly lightened | Антропофония markers |

## Radii
Soft wellness scale (cream cards ~24–32px):
| Token | rem | Use |
|-------|-----|-----|
| `--radius-sm` | 0.75 | nested chips |
| `--radius-md` | 1 | inputs, compact rows |
| `--radius-lg` | 1.5 | cards / sections |
| `--radius-xl` | 1.75 | dock / sheets / mobile nav top |
| `--radius-2xl` | 2 | modals (`.app-modal-panel`) |
| `--radius-tag` | 0.5 | square tags |
| `--radius-pill` | 999px | buttons, badges, wave-pill |

Selection / focus: ink rim, **no colored glow halo**.

## Typography
Keep **Geologica** (UI) + **Klukva** (brand @400). Product ramp (~1.2):

| Token | Size | Role |
|-------|------|------|
| `--text-caption` | 11 | `.type-eyebrow` — ALL CAPS, tracking |
| `--text-body-sm` | 13 | `.type-meta` |
| `--text-body` | 16 | `.type-body` |
| `--text-subheading` | 20 | `.type-subtitle` |
| `--text-heading-sm` | 24 | `.type-title--sm` / metrics |
| `--text-heading` | 32 | `.type-title` |
| `--text-display` | 40 | rare mobile hero |

Accent word in titles: `.type-accent` / `.ds-title-accent` → peach. Dense chrome (player title) stays Geologica bold — not Klukva.

## Buttons
- **Primary** `.ds-btn--primary` — charcoal (Полёвка CTA) + 2px rim (Wispr)
- **Accent / Soft** — peach fill + **2px `#222` rim** (Wispr edge on soft fill)
- **Outline** — cream + 2px ink (Wispr secondary)
- **Ghost / Link** — low emphasis
- Press `scale(0.97)` · focus-visible accent ring · no `transition: all`

## Tags & badges
- Square `.ds-tag` — categories / keywords (Wispr dark-square role)
- Pill `.ds-badge` / `.badge-chip` — status (Wispr pill role)
- Eco → `.ds-tag--live` (ember soft)

## Live audio
`.wave-pill` — Wispr waveform recipe; peach ember when `.is-live`.

## File transfer (upload / download / drag-drop)
Reference motion (cream pill → peach “Uploading…” with fill → charcoal Completed):
- Component: `.file-xfer` + `window.FileXfer` (`src/ui/file-xfer.js`)
- States: `idle` · `drag` · `loading` · `done`
- Wired: add-audio dropzone, photo attach, publish, details WAV, expedition ZIP, list download feedback
- Do not invent a second progress pattern — reuse `FileXfer.run` / `setState`

## Micro-motion (Transitions.dev)
- **Like burst:** `.t-like` + `window.LikeBurst` — peach particles + spring pop (`--like-color` → accent). Details / feed / comments.
- **Input shake:** `.t-input-wrap` / `.t-input` / `.t-error-msg` + `window.InputShake.shake` — auth validation, publish coords, bad credentials.

## Typography
| Role | Family | Weight |
|------|--------|--------|
| UI | Geologica | 400–700 as needed |
| Brand | Klukva | **400** (Wispr display rule: scale, not bold) |

Scribble: `.ds-scribble`. Fonts/palettes under Settings → **Эксперимент**.

## Other
- Icons: Iconsax · Glass floating chrome; opaque dock/player (no blur on scroll)
- Yandex API 3: stock scheme, no palette tint
- Default palette: `coral` («Персик») · Zoom allowed

## Hard constraints
- No `backdrop-filter` on `#player-card` or `#sidebar`
- No `overflow:hidden` / forced `position` on player children
- `.hidden { display:none !important }`
- Map stays clickable (`pointer-events` split)
- Desktop: `#sidebar.sidebar-hidden` is a no-op
- Icon-only controls need `aria-label`
- Do not ship lavender, forest teal, or Garamond/Figtree into product UI
