# Legacy vanilla (frozen)

Эталон исходного клиента: `src/ui/`, `src/core/` и снимок `archive/vanilla/index.html`.

**polevka.art (GitHub Pages)** отдаёт корневой `index.html` из сборки `apps/web`. Vanilla с продакшена снят.

Новые фичи пишутся в `apps/web` и `packages/core`. Vanilla трогать только если нужно снять эталон поведения (поля публикации, merge JSON, права staff).

Оставить как источник истины, пока не перенесены полностью:

- `src/data/legalDocs.js`
- `src/data/publishRules.js`
- `src/data/ucsCatalog.js`, `src/data/gearCatalog.js`
- `src/core/audioConvert.js`, `wavMeta.js`, `ucsName.js` (уже реэкспорт через `@polevka/core`)
