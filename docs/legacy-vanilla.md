# Legacy vanilla (frozen)

Корневой `index.html` и `src/ui/`, `src/core/` — архив исходного клиента Полёвки.

**Не деплоить на polevka.art.** Продакшен — только `apps/web/dist`.

Новые фичи пишутся в `apps/web` и `packages/core`. Vanilla трогать только если нужно снять эталон поведения (поля публикации, merge JSON, права staff).

Оставить как источник истины, пока не перенесены полностью:

- `src/data/legalDocs.js`
- `src/data/publishRules.js`
- `src/data/ucsCatalog.js`, `src/data/gearCatalog.js`
- `src/core/audioConvert.js`, `wavMeta.js`, `ucsName.js` (уже реэкспорт через `@polevka/core`)
