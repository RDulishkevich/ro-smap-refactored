# Полёвка — Design

**Reading this as:** sound map first — listen, find, and add field recordings. Earth-tone Figma system (terracotta accent, sage/olive, cream). Type pair **Geologica (UI) + Klukva (brand)**. Brand: **Полёвка**.

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
| dark | `#2D3C39` | Strong fill, forest pins |
| olive | `#6F7C4E` | Secondary text |
| sage | `#9DB170` | Muted labels |
| light | `#D9E2C3` | Soft fills |
| cream | `#F4E8D8` | Warm cards |
| ink | `#1A1A1A` | Text on light |
| phoneBg | `#E8EDEA` | Canvas |

Dark: canvas `#1A2926`, cards `#243530`, chrome `#1E2E2A`.

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
