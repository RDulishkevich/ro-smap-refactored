# RO.SMap — гайд по UX/UI

Документ описывает **уже выстроенные** правила интерфейса. Новые экраны и виджеты нужно делать **по этим паттернам**, а не изобретать параллельные «окна», «строки» и «комменты».

Для агента Cursor это же правило закреплено в `.cursor/rules/ux-ui.mdc`.

---

## 1. Золотые правила

1. **Не дублировать UI.** Перед новым блоком найди ближайший существующий аналог и скопируй его логику/классы.
2. **Один паттерн — одна задача.**
   - Подтверждение / ввод текста → `CustomUI`
   - Меню «⋯» → `ActionSheet`
   - Короткий фидбек → `showToast`
   - Полноценная форма → модалка `app-modal-*` или секция dock
3. **Комментарии везде одной логикой.** Эталон — комментарии к звуку в карточке метки. Лента и другие места — тот же смысл, можно компактнее, но не «другая вселенная».
4. **Auth сначала.** Любое действие «написать / лайкнуть / RSVP / подписаться» без логина: toast → `openAuthModal` → `return`.
5. **Antispam на запись.** Любой пользовательский текст/спам-жест через `spamGuardCheck` + `spamGuardToast`.
6. **Данные через merge + sync.** Не перезаписывать JSON «вслепую»; использовать существующие `sync*` / merge-хелперы.
7. **Desktop ≥ 768px, mobile &lt; 768.** В JS: `window.innerWidth < 768`. В CSS/Tailwind: `md:`.

---

## 2. Карта поверхностей (что где живёт)

| Поверхность | Когда | Пример |
|-------------|--------|--------|
| Карта + chrome | Всегда фон | `#map`, top toolbar, FAB |
| Rail (слева) | Только desktop | `#app-rail` — иконки разделов |
| Dock / sidebar | Каталог, лента, админка, детали | `#sidebar` |
| Правая панель | Desktop-ивенты | `#events-panel` |
| Bottom / fullscreen sheet | Mobile-аналог правой панели | `#events-sheet` |
| Модалка по центру | Редакторы, авторизация, статьи | `#feed-post-modal`, `#auth-modal`… |
| ActionSheet | Список действий по «⋯» | `#action-sheet-overlay` |
| Toast | Короткое сообщение | `#toast-message` |
| CustomUI | Confirm / prompt | `#ui-modal-overlay` |

**Правило:** длинный скролл-контент (списки, детали) — в **solid panel** (dock/player). Плавающие кнопки карты — **glass**. Не вешать `backdrop-filter` на большие скролл-панели.

---

## 3. Модалки (окна)

### Разметка

- Overlay: классы `app-modal-overlay` + `fixed inset-0` + `hidden` + `opacity-0` + `pointer-events-none` + `transition-opacity duration-300` + затемнение/blur.
- Панель: `app-modal-panel` + `scale-95` + `transition-all` + скругление ~`1.75rem–2.5rem`.
- Закрытие по фону: `onmousedown="if(event.target === this) window.close…()"`.

### Анимация open / close (обязательный ритуал)

**Открыть**

1. `remove('hidden')`
2. `void el.offsetWidth` (reflow)
3. Снять `opacity-0`, `pointer-events-none`
4. С панели снять `scale-95`
5. Опционально `playSfx('open')`

**Закрыть**

1. Добавить `opacity-0`, `pointer-events-none`
2. На панель — `scale-95`
3. Через ~280–300 ms, если всё ещё `opacity-0` → `hidden`

Не открывать модалку через один только `hidden`/`display` без этой анимации — интерфейс «прыгает» и расходится с остальным продуктом.

### Z-index (не выдумывать новые слои без нужды)

| Слой | Назначение |
|------|------------|
| 50–61 | Карта chrome, sidebar, events panel |
| 90 | Уведомления |
| 200–250 | Обычные модалки продукта |
| 260 | Crop изображения |
| 300 | Toast |
| 400 | Онбординг |
| 9997 | CtxPopup (карта) |
| 9998 | ActionSheet |
| 9999 | CustomUI |
| 99999 | Lightbox |

Новая модалка обычно садится в диапазон **200–250**, рядом с похожим редактором.

### Confirm / prompt

```js
const ok = await window.CustomUI.open({
  title: 'Удалить?',
  message: 'Действие нельзя отменить.',
  confirmText: 'Удалить',
  confirmClass: '… bg-red-600 …' // для опасных действий
});
// ok === true | false
// или строка, если showInput: true
```

Черновик при закрытии: `confirmDiscardDraft(message)`.

---

## 4. ActionSheet (меню «⋯»)

Это **не** контекстное меню карты и не CustomUI.

```js
window.ActionSheet.open([
  { icon: 'fa-solid fa-user', label: 'Профиль', onClick: () => { … } },
  { icon: 'fa-solid fa-flag', label: 'Пожаловаться', tone: 'warning', onClick: () => { … } },
  { icon: 'fa-solid fa-trash', label: 'Удалить', tone: 'danger', onClick: () => { … } },
]);
```

- Mobile: шторка снизу.
- Desktop: компактная панель по центру.
- Для якоря у курсора на карте — `CtxPopup`, не ActionSheet.

Эталон вызова: `openCommentMenu` / `openReplyMenu` в `src/ui/ui.js`.

---

## 5. Dock, вкладки, rail

| API | Назначение |
|-----|------------|
| `openDockView(view)` | Показать секцию dock (`library`, `feed`, `details`, `admin`…) |
| `switchSidebarTab(tab)` | Вкладки каталога: `library` \| `feed` \| `expeditions` \| `help` |
| `showDockPanel` / `hideDockPanel` | Показать/скрыть `#sidebar` |
| `setDockHeader(title, subtitle, showBack)` | Заголовок dock |
| `switchAdminSection(section)` | Подвкладки админки |

На desktop детали/настройки/кабинет часто **встраиваются в dock**. На mobile — отдельные полноэкранные/оверлейные режимы. Не ломай это разделение.

Body-флаги: `dock-is-hidden`, `dock-view-details`, `events-panel-open`, `events-open` — используй существующие, не плоди новые без причины.

---

## 6. Формы: поля и подписи

| Класс | Роль |
|-------|------|
| `.modal-label` | Подпись над полем |
| `.modal-input` | Текстовое поле / select / textarea (min-height ~44px) |

Дополнительно можно навешивать Tailwind (`text-xs`, `dark:bg-slate-900`), но **базовый класс не заменять** своим `input { … }` в новом CSS.

Кнопки:

| Класс | Где |
|-------|-----|
| `.map-icon-btn` | Иконки на карте |
| `.ui-tab` + `.is-active` | Вкладки |
| `.admin-subtab-btn` + `.active` | Админ-секции |
| `.admin-tool-btn` | Быстрые действия в админке |
| Primary CTA | `rounded-xl` + `font-bold` + `bg-blue-600` / accent |

Опасные действия — красный confirm через CustomUI, не тихий `confirm()`.

---

## 7. Списки, карточки, строки

| Паттерн | Классы | Где смотреть |
|---------|--------|-------------|
| Админ-строка | `.admin-entity-row`, `__title`, `__meta` | списки в `auth.js` |
| Карточка ленты | `.feed-card`, `__badge`, `__title`, `__meta`, `__text` | `renderSidebarFeed` |
| Карточка ивента | `.event-card`, `__meta`, `.event-pill` | `events.js` |
| Пустой список | `.library-empty`, `.events-empty` или одна строка `text-slate-400 italic` | |

Новый список сущностей в админке → **admin-entity-row**, не новая сетка карточек «с нуля».  
Контент для пользователя в ленте/ивентах → **card**-паттерн того раздела.

---

## 8. Комментарии — единый канон

### Эталон: комментарии к звуку (карточка метки)

Источник правды:

- схема: `normalizeComment` / `normalizeReply` в `src/data/sounds.js`
- UI: `renderComments`, `addComment`, `toggleCommentReaction`, `openCommentMenu` в `src/ui/ui.js`
- merge: `__mergeCommentLists` (реакции LWW по `reactedAt` / более новой ревизии)

**Поля комментария**

```js
{
  id,            // стабильный id
  author,        // отображаемое имя
  authorId,      // login для профиля
  text,          // текст (экранировать при рендере)
  date,          // человекочитаемая дата (опционально)
  createdAt,     // ISO
  replies: [],   // ответы (у звуков)
  reactedBy: [], // логины ♥
  reactedAt?,    // для LWW
  updatedAt?
}
```

**Обязательное поведение**

1. Без логина → toast + `openAuthModal`.
2. `spamGuardCheck('comment:${login}', { minIntervalMs: 2500, maxPerWindow: 8, … })`.
3. Автор кликабелен → `openPublicProfile(authorId, author)`.
4. Меню «⋯» → ActionSheet: профиль / ответить / реакция / пожаловаться / (админ) удалить.
5. ♥ — toggle в `reactedBy` + bump `reactedAt`/`updatedAt`, не «навсегда union без снятия».
6. После успеха — toast (по ситуации) и sync через существующий пайплайн звука.
7. Empty state: короткая muted-строка («Нет комментариев» / «напишите первым»).

**Разметка (ориентиры классов):** `comment-author-wrap`, `comment-avatar`, `comment-author-link`, `comment-menu-btn`, `comment-reaction-btn`, `comment-replies`, `swipe-reply-row`.

### Компактный вариант: лента

Лента в dock пересобрана под тот же канон:

- аватар + автор → `openPublicProfile`;
- ♥ на комментарии (`toggleFeedCommentReaction`, LWW);
- меню «⋯» → `ActionSheet` (`openFeedCommentMenu`);
- compose: `modal-input` + send;
- auth + antispam как у звука.

Отличия от карточки метки (намеренно): без вложенных replies/swipe — плоский тред под постом. Пост-меню админа тоже через ActionSheet (`openFeedPostMenu`).

| Фича | Делать так |
|------|------------|
| ♥ на комменте | `toggleFeedCommentReaction` / как `toggleCommentReaction` |
| «⋯» | `ActionSheet.open` |
| Persist | `syncFeedPosts` + `__mergeCommentLists` |

**Запрещено:** свой HTML «чат» с другими отступами, свои confirm’ы вместо ActionSheet, запись комментария без antispam, показ сырого `innerHTML` текста пользователя без escape.

---

## 9. Реакции, просмотры, RSVP (рядом с комментами)

| Действие | Паттерн |
|----------|---------|
| ♥ на посте ленты | `toggleFeedReaction` — auth + antispam + `reactedBy`/`reactedAt` |
| Просмотр поста | `recordFeedView` — один раз на login за сессию + sync |
| RSVP ивента | `rsvpEvent` — auth + antispam + participant row + `syncEventsData` |

Всегда: **сначала локальный optimistic/state map → sync → при успехе toast/перерисовка**.

---

## 10. Auth-gate (копипаста)

```js
if (!window.currentUser) {
  window.showToast('Войдите, чтобы …');
  if (window.openAuthModal) window.openAuthModal();
  return;
}
```

Админ-only:

```js
if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) {
  window.showToast('Только администратор');
  return;
}
```

---

## 11. Toast

```js
window.showToast('Сохранено');
window.showToast('…', { silent: true }); // без звука
```

Не использовать `alert()` / `confirm()` браузера в продуктовом UI.

---

## 12. Empty states и бейджи

- Пустой список: иконка + 1 заголовок + опционально 1 пояснение / CTA.
- Счётчики на FAB/rail: маленький pill (`hidden`, пока 0).
- Статусы: готовые pill-классы (`.event-pill--live`, `.pub-status-*`, `.feed-card__badge--*`), не произвольные цветные `span` без системы.

---

## 13. Mobile vs desktop

| Тема | Mobile | Desktop |
|------|--------|---------|
| Навигация | `#dock-mobile-tabs`, burger | `#app-rail` + dock |
| Ивенты | sheet `#events-sheet` | панель `#events-panel` |
| ActionSheet | снизу | по центру |
| Модалки | ближе к верху, учитывай safe-area / dvh | по центру |
| Player padding | обычный | справа запас под events panel при `body.events-panel-open` |

Новый «боковой» контент на desktop → панель как events; на mobile → sheet с тем же `*-body` контентом (как `renderEventsPanel` пишет в оба хоста).

---

## 14. Тема и цвет

- Тёмная тема: класс `html.dark` (`setTheme`).
- В разметке пары: `bg-white dark:bg-slate-800`, `text-slate-600 dark:text-slate-300`.
- Акценты: CSS-переменные `--accent`, `--ink`, палитры `data-palette`.
- Не вводить «ещё один purple gradient» вне существующей системы стекла/панелей.

---

## 15. Чеклист перед новым UI

- [ ] Есть ли уже модалка / sheet / row / comment для этого?
- [ ] Open/close через стандартный opacity/scale/hidden?
- [ ] Поля через `modal-label` + `modal-input`?
- [ ] Списки — `admin-entity-row` или card раздела?
- [ ] Меню действий — ActionSheet?
- [ ] Confirm — CustomUI?
- [ ] Фидбек — toast?
- [ ] Нужен ли login / admin / antispam?
- [ ] Комменты — по канону §8?
- [ ] Sync через существующий merge, не raw overwrite?
- [ ] Mobile (&lt;768) и desktop проверены?
- [ ] Dark mode не сломан?

---

## 16. Шпаргалка API

| Нужно | Вызов |
|-------|--------|
| Toast | `showToast(msg)` |
| Confirm / prompt | `CustomUI.open(opts)` |
| Меню ⋯ | `ActionSheet.open(items)` |
| Логин | `openAuthModal()` |
| Dock | `openDockView(view)` / `switchSidebarTab(tab)` |
| Коммент к звуку | `addComment` / `renderComments` / `toggleCommentReaction` |
| Коммент ленты | `addFeedComment` / `toggleFeedComments` |
| Merge комментов | `__mergeCommentLists` |
| Antispam | `spamGuardCheck` + `spamGuardToast` |
| Профиль | `openPublicProfile(login, name)` |
| Ивенты UI | `openEventsPanel` / `openEventsSheet` / `renderEventsPanel` |

Ключевые файлы: `src/ui/ui.js`, `src/style.css`, `src/glass.css`, `index.html`, `src/data/sounds.js`, `src/core/events.js`, `src/core/antispam.js`, `src/core/auth.js`.

---

## 17. Для людей (коротко)

- **Окно по центру** = модалка (редактор, вход, статья).
- **Шторка снизу / список кнопок** = ActionSheet (три точки).
- **Левая большая панель** = dock (библиотека, лента, админка).
- **Правая узкая панель** = ивенты (на телефоне — отдельная шторка).
- **Всплывающая строка сверху** = toast («сохранено», «войдите»).
- **Красный вопрос «точно удалить?»** = CustomUI, не браузерный confirm.
- **Комментарии под меткой** = образец для любых других комментариев в продукте.
