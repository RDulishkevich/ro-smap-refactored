# Архитектура интерфейса: ПК и мобильная версия

Каноническая схема chrome Полёвки. Breakpoint: **desktop ≥ 768px**, **mobile &lt; 768px**  
(`window.innerWidth < 768` / Tailwind `md:`).

Связано: [`ux-ui-guide.md`](ux-ui-guide.md), `.cursor/rules/ux-ui.mdc`.

---

## 1. Принцип

Один DOM, две раскладки chrome. Контент (карта, dock, модалки) общий; **точки входа** в разделы разные.

| Слой | Desktop | Mobile |
|------|---------|--------|
| Навигация разделов | Левый `#app-rail` | Нижний `#mobile-bottom-nav` |
| Аккаунт (сообщения, уведомления, профиль, выход) | Низ рейки | Профиль / кабинет + иконки у карты |
| Ивенты | `#events-fab` → `#events-panel` справа | `#events-fab` → `#events-sheet` снизу |
| Каталог / лента / помощь | Dock `#sidebar` слева | Тот же dock на весь экран (кроме bottom rail) |
| Поиск | `#map-top-toolbar` | Тот же |

**Не дублировать** одну и ту же кнопку на рейке и в правом верхнем углу на desktop.

---

## 2. Карта chrome (схема)

```text
DESKTOP (≥768)
┌──────────────────────────────────────────────────────────┐
│  [rail]     [search toolbar]              [events fab]   │
│   lib                                                    │
│   feed                                                   │
│   exp                                                    │
│   ···                                                    │
│   admin?                                                 │
│   msg                                                    │
│   notif                                                  │
│   settings                                               │
│   help                                                   │
│   profile                                                │
│   logout?                                                │
│                                                          │
│  [dock panel]              MAP                           │
│                            [FAB + / Guessr]              │
└──────────────────────────────────────────────────────────┘

MOBILE (<768)
┌──────────────────────────────────────────────────────────┐
│  [search]                         [events][msg][notif]   │
│                                                          │
│                         MAP                              │
│                     [FAB + / Guessr]                     │
│                                                          │
│  ┌──────────┬──────┬─────┬────────┬─────────┐            │
│  │Библиотека│Лента │Карта│Настрой.│ Профиль │  bottom   │
│  └──────────┴──────┴─────┴────────┴─────────┘            │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Канонические ID

### Desktop-only (на mobile скрыты)

| ID | Назначение |
|----|------------|
| `#app-rail` | Левая икон-рейка |
| `#rail-library` / `#rail-feed` / `#rail-expeditions` / `#rail-help` | Разделы dock |
| `#rail-admin` | Staff (появляется по роли) |
| `#msg-btn` / `#notif-btn` | Сообщения / уведомления |
| `#settings-btn` / `#profile-btn` / `#logout-btn` | Аккаунт |
| `#events-panel` | Правая панель ивентов |

### Mobile-only (на desktop скрыты)

| ID | Назначение |
|----|------------|
| `#mobile-bottom-nav` | 5 пунктов: library, feed, map, settings, profile |
| `#msg-wrap-mobile` / `#notif-wrap-mobile` | Конверт и колокол у карты (после логина) |
| `#events-sheet` | Полноэкранный/sheet ивентов |
| `#cabinet-mobile-menu` | Строки кабинета (в т.ч. «Сообщения») |
| `#dock-mobile-tabs` | Библиотека / Экспедиции внутри dock |

### Shared

| ID | Desktop | Mobile |
|----|---------|--------|
| `#events-fab` | Открывает панель | Открывает sheet |
| `#map-top-toolbar` | Поиск | Поиск |
| `#fab-add` / `#fab-guessr` | Низ-справа | Выше bottom nav |
| `#sidebar` | Левый dock | Fullscreen минус `--mobile-fs-bottom` |
| Модалки `app-modal-*` | Центр | Fullscreen минус bottom rail (кроме компактных confirm) |

Legacy / скрыты намеренно: `#burger-btn`, `#settings-btn-mobile`, `#profile-btn-mobile` — не показывать; вход через bottom nav / rail.

---

## 4. Правила видимости (обязательно)

1. Класс Tailwind `hidden` = скрыто. Снятие `hidden` в JS (`refreshMessagesUI` / `refreshNotificationsUI`) **включает** кнопку.
2. **Не полагаться** на `md:hidden` у элементов с `.map-icon-btn` / `.app-rail__btn`: у них `display: inline-flex`, он перебивает Tailwind.
3. Канон в CSS (`style.css`):
   - `.map-icon-btn.hidden` / `.app-rail__btn.hidden` → `display: none !important`
   - `@media (min-width: 768px)` → `#msg-wrap-mobile`, `#notif-wrap-mobile`, `#settings-btn-mobile`, `#profile-btn-mobile`, `#burger-btn`, `#mobile-bottom-nav` → `display: none !important`
   - `@media (max-width: 767px)` → `#app-rail` → `display: none !important`
4. Обёртки mobile-кнопок: `class="relative md:hidden"` **и** desktop `!important` hide.
5. Перед релизом chrome: на ≥768 залогиненным не должно быть колокола/конверта в правом верхнем углу — только `#events-fab`.

---

## 5. Потоки навигации

### Desktop

- Раздел → `switchSidebarTab` / `openDockView` → rail `is-active`.
- Сообщения / уведомления → иконки рейки.
- Ивенты → FAB → `#events-panel`.
- Скрыть dock → карта на весь экран, rail остаётся.

### Mobile

- Bottom nav → `mobileNavGo('library'|'feed'|'map'|'settings'|'profile')`.
- «Карта» закрывает dock / events sheet.
- Сообщения: конверт у карты **или** Профиль → кабинет → «Сообщения».
- Уведомления: колокол у карты (после логина).
- Ивенты: FAB → `#events-sheet`.
- Dock занимает экран **кроме** `--mobile-fs-bottom` (место под bottom nav).

---

## 6. Dock и модалки

| Режим | Desktop | Mobile |
|-------|---------|--------|
| Library / feed / expeditions / help | Панель слева | Fullscreen − bottom rail |
| details / messages / settings / cabinet / admin | Тот же dock, nested view | Fullscreen − bottom rail |
| Confirm (`#ui-modal-overlay`) | Компактно по центру | Компактно по центру |
| Auth / legal / feed editors | `app-modal-overlay` | Fullscreen − bottom rail |

Не делать отдельные «полу-листы» для основных поверхностей — см. ux-ui-guide, mobile fullscreen.

---

## 7. Чеклист при добавлении кнопки

1. Нужна ли она на **обоих** breakpoint’ах или только на одном?
2. Desktop → рейка или правая панель; mobile → bottom nav / top-right / кабинет.
3. Если `map-icon-btn` + показ после логина — добавить ID в desktop `display: none !important` блок.
4. Не копировать `#xxx-mobile` на desktop «на всякий случай».
5. Обновить эту таблицу ID при новом chrome-элементе.

---

## 8. Антипаттерны

- Колокол/конверт в `map-top-right` на desktop (дубль рейки).
- Полагаться только на `md:hidden` для `.map-icon-btn`.
- Показывать `#settings-btn-mobile` / `#profile-btn-mobile` (дубль bottom nav).
- Прятать ленту с desktop без `#rail-feed`.
- Изобретать третий bottom bar или второй rail.
