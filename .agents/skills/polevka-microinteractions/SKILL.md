---
name: polevka-microinteractions
description: >-
  Полёвка microinteraction rules (trigger, rules, feedback, loops) plus motion
  craft for the React app. Use when adding button feedback, loading, toggles,
  toasts, stack transitions, FAB, form validation, or when the UI feels dead.
---

# Полёвка microinteractions

## Model

Every moment has: **trigger** (tap, long-press, route) → **rules** (auth, spam, consent) → **feedback** (scale, toast, spring) → **loop** (idle, playing, recording).

## Triggers

- Primary actions: visible CTA in accent (`#B5613F`).
- ⋯ / context: `useUi().openMenu`, not a custom dropdown.
- Auth-gated: toast, then `{ type: 'auth' }` screen. Do not fail silently.

## Rules

- `spamGuardCheck` before comments, likes, publish.
- Cookie consent `all` before login/register.
- Confirm destructive actions with `useUi().confirm`.

## Feedback

- Tap: `whileTap={{ scale: 0.85–0.96 }}`.
- Tab change: spring 380/36, horizontal slide.
- Stack push/pop: spring 320/32 from the right (mobile).
- FAB: rotate 45° spring 420/26; satellite buttons stagger 70ms.
- Toast: ~2.8s, dark pill, no blocking modal.
- Playing: waveform opacity + play/pause morph.

## Loops

- Map pin selected → `PinPlayer` sheet; tap map to dismiss.
- Recording: timer + bars; stop → add-sound.
- Do not add a second loading spinner language — one muted label «…» on busy CTAs.

Web uses `motion`. Native later: Reanimated, same timings.
