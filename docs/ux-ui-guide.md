# Полёвка — гайд по UX/UI

Канон для новой работы: **React/TSX** в [`apps/web`](../apps/web). Токены: [`packages/design`](../packages/design). Chrome: [`responsive-chrome.md`](responsive-chrome.md). Для агента: `.cursor/rules/ux-ui.mdc` и `.agents/skills/polevka-design/SKILL.md`.

Корневой `index.html` (vanilla) — **замороженный архив**. Продакшен — `apps/web`. Не наращивать vanilla.

---

## 1. Золотые правила

1. **Не дублировать UI.** Сначала `apps/web/src/primitives` и `screens`.
2. **Один паттерн — одна задача.**
   - Confirm → `useUi().confirm`
   - Меню ⋯ → `useUi().openMenu`
   - Фидбек → `useUi().toast`
   - Формы → `ScreenHeader` + поля как на `AuthScreen`
3. **Комментарии одной моделью** (`normalizeComment` в `@polevka/core`).
4. **Auth сначала.** Лайк / комментарий / публикация без сессии: toast → экран `auth`. Cookies: согласие `all` до логина (`@polevka/core` consent).
5. **Antispam.** `spamGuardCheck` + сообщение через toast.
6. **Данные.** Публичные JSON с бакета + `apiSyncJson` / `apiPatchSound`. Не затирать облако вслепую.
7. **Desktop ≥ 768 / mobile < 768** (`useIsDesktop`).
8. **Бренд Полёвка.** Не RO·SMap, не «Карта Звуков».
9. **Без glow.** Акцент терракота `#B5613F`, не peach Wellness.
10. **Радиусы** 12 / 16 / 24 / pill из `packages/design`.
11. **Legal.** Stack `legal` + «Скачать PDF» (печать). Документы в `src/data/legalDocs.js` / `publishRules.js`.
12. **Поддержка Полёвки.** FAQ-бот, затем «обращение» с номером.

## 1.1 Шрифты и иконки (React)

| Роль | Значение |
|------|----------|
| UI | Geist Variable (`--pv-font-ui`) |
| Бренд | Klukva |
| Иконки | Lucide |

Legacy vanilla по-прежнему Iconsax + `src/fonts.css` — не смешивать в `apps/web`.

## 2. Поверхности (React)

| Поверхность | Где |
|-------------|-----|
| Карта | Leaflet OSM (`SoundMap`); Yandex key через `publicConfig` когда подключите движок |
| Рейка | только desktop |
| Панель 380px | каталог / лента / экспедиции / профиль |
| Стек экранов | детали звука, auth, запись, сообщения, help, staff, legal |
| Toast / confirm / меню | `UiContext` |

## 3. Мобилка

Три вкладки: Лента (публикации / каталог / экспедиции), Карта (+ FAB запись/добавить), Профиль. Стек едет справа. Confirm — компактный по центру.

## 4. ПК

Карта на весь холст. Рейка: карта, каталог, лента, экспедиции, помощь, staff, профиль. Не телефон по центру.

## 5. Legacy vanilla (не расширять)

Старые паттерны `app-modal-overlay`, `CustomUI`, `openActionsMenu`, `#mobile-bottom-nav` (5 пунктов) остаются в `index.html` / `src/ui/ui.js` до паритета. Новые экраны — только `apps/web`.
