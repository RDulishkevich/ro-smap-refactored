---
name: polevka-upload-ux
description: >-
  Upload UX for Полёвка: every file PUT must show real progress (%, MB, stage),
  not only “loading…”. Use when touching uploadUserMedia, AddSound photos/audio,
  avatars, attachments, or presign flows.
---

# Полёвка upload UX

## Must follow

1. **Stages.** At least: `presign` → `put` → `save` (card/meta). Label in Russian what the user waits for.
2. **Byte progress.** Use `uploadUserMedia` + XHR `upload.onprogress` from `@polevka/core`. Show **%** and **МБ / МБ**, not a fake indeterminate bar alone. Pass `kind: 'sound' | 'avatar'` so keys land under `media/sounds/` or `media/avatars/`.
3. **Errors.** Map codes: `too_large`, `presign_expired`/`unauthorized`, `network`, `bad_content_type` — toast with retry, not «ожидайте».
4. **UI.** Prefer shared `UploadProgress` in `apps/web/src/primitives/`. Tokens from `@polevka/design`; Motion springs; no `alert`.
5. **Auth.** No upload without session; key under allowed media prefix.

## Checklist before merge

- [ ] Progress updates during PUT for files &gt; ~100 KB
- [ ] Stage label visible
- [ ] Failure path restores UI / allows retry
- [ ] Does not block the whole app chrome behind a blank “Загрузка…”
