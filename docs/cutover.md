# Production client: React only

`polevka.art` — GitHub Pages (ветка `main`, корень репозитория). Сборка: `npm run build` → скопировать `apps/web/dist` в корень (`index.html`, `404.html`, `assets/*`).

- Deep links `/s/:id` работают через `404.html` = копия `index.html`.
- Writes: `apiSyncJson` sends **only changed rows**. Server `handleSync` / `applyMergeAndSave` merges. Deletions: `{ deleted: true }`.
- Vanilla homepage живёт в `archive/vanilla/index.html`, не на домене.

# Vanilla frontend is frozen

The original app (`archive/vanilla/index.html`, `src/ui/`, `src/core/`) is a **local reference** for behaviour. Do not add product features there.

Legal copy still lives in `src/data/legalDocs.js` and `src/data/publishRules.js` until those files move into `@polevka/core`.

See `docs/legacy-vanilla.md` and `docs/parity-checklist.md`.
