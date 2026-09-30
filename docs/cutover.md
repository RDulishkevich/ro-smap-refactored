# Production client: React only

`polevka.art` is served from **`apps/web/dist`** (`npm run build` / `npm run build:web`).

- Deep links: `/s/:id`, `/u/:login`, `/e/:eventId` (SPA fallback copies `index.html` → `404.html` for Object Storage).
- Writes: `apiSyncJson` sends **only changed rows**. Server `handleSync` / `applyMergeAndSave` merges. Deletions: `{ deleted: true }`.
- Do **not** publish root `index.html` (vanilla) to the production bucket.

# Vanilla frontend is frozen

The original app (`index.html`, `src/ui/`, `src/core/`) is a **local reference** for behaviour. Do not add product features there.

Legal copy still lives in `src/data/legalDocs.js` and `src/data/publishRules.js` until those files move into `@polevka/core`.

See `docs/legacy-vanilla.md` and `docs/parity-checklist.md`.
