# Полёвка — Design

**Reading this as:** sound map first — listen, find, and add field recordings. Field-kit tokens (clay accent, topographic paper). Type: **Geist Variable** 400/500 for all roles. Scale: [`docs/typography.md`](docs/typography.md). Brand: **Полёвка**. No Klukva.

**Implementation:** React/TSX in `apps/web`, tokens in `packages/design`. Vanilla (`index.html`) is a frozen archive and is not deployed.

**Desktop (≥768):** dashboard chrome — padded canvas, rounded 32px window, icon rail (app illustration, not favicon), top search + profile. Map view is full-width; lists keep a 360px panel on the left. Sound / expedition / profile / record cards use a wide left pane with map stacked over the player on the right. Auth is a full-window overlay. Never ship the Figma phone mock as the desktop product.

## Brand mark

| Asset | Use |
|-------|-----|
| `assets/polevka-favicon.png` / `apps/web` Favicon | Browser / nav mark |
| `assets/polevka-mark-*.png` | Light/dark vole |
| `assets/polevka-app-icon.png` · `icons/icon-*.png` | PWA / Expo |

## Tokens (canonical)

| Token | Hex | Role |
|-------|-----|------|
| accent | `#B5613F` | CTA, active tab, likes (≤10% of UI) |
| dark | `#2A3230` | Strong fill, forest pins |
| olive | `#5C6750` | Secondary text |
| sage | `#8A9278` | Decorative only |
| mist | `#7F9B99` | Water, cool accents, rail banners |
| light | `#E3E5DF` | Soft fills |
| cream | `#F2F0EA` | Warm paper |
| ink | `#1A1A1A` | Text on light |
| phoneBg | `#E7E8E4` | Canvas |
| muted | `#5A6354` | Readable secondary |

Dark: canvas `#131513`, cards `#1C1F1D`, chrome `#171917`, solid CTA `#3A3A3A`. Map tiles inverted; map chrome buttons light.

Radii: 12 / 16 / 24 / pill FAB. Map FAB notch 36px. Icons: **Lucide**. Motion springs: see `packages/design/src/motion.ts`.

Peach Wellness (`#FBAB57` floating dock) and Wispr peach grammar are **retired** for the React app. Do not mix them into `apps/web`.

## Product focus

Карта звуков: слушать · находить · добавлять. Social / expeditions / admin are secondary — never crowd the listen loop.

## Chrome

| | Mobile | Desktop |
|--|--------|---------|
| Nav | Bottom 3 tabs + map FAB | 72px rail |
| Feed / catalog / expeditions | Feed tab sub-pills | Rail → 380px panel |
| Events / messages | Stack screens | Rail shortcuts + overlay |
| Player | PinPlayer / detail | Same components over map |

## Primitives

`NavBar`, `ScreenHeader`, `SoundTypeTag`, `WaveformSVG`, `PinPlayer`, `DecorBand`, `MapFab` — `apps/web/src/primitives`.

Confirm / toast / ⋯ menus: `UiContext`. No `alert`/`confirm`.
