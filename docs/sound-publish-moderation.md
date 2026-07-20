# Добавление звука и модерация

Как устроен полный цикл записи в RO.SMap: форма → метаданные/имя файла → статусы → уведомления → правки. Для агентов и разработчиков; UX-паттерны UI — в `docs/ux-ui-guide.md`, UCS — в `docs/ucs-naming.md`.

**Правила для авторов и модераторов (продуктовый текст):** `docs/community-rules.md` и UI-модалка из `src/data/publishRules.js` (`openPublishRulesModal`). При отклонении админ выбирает чип с кодом пункта (S1…C3…).

---

## 1. Статусы записи

| Статус | Кто видит на карте | Где ещё |
|--------|--------------------|---------|
| `draft` | Только автор (кабинет) | Черновик; после отклонения тоже `draft` + `rejectionReason` |
| `pending` | Автор + админы | Очередь модерации |
| `published` | Все (если проходит фильтры) | Каталог / карта |
| `rejected` | Устаревший явный статус; новые отклонения переводятся в `draft` | Фильтр админки «Отклонённые» включает и `draft` с причиной |

Поля на объекте звука (`map_data.json` / `formatSoundObject`):

- `status` — одно из значений выше
- `rejectionReason` — текст причины (живёт, пока автор не отправит снова на модерацию)
- `seenByAuthor` — `false` после решения модератора; кабинет показывает toast и гасит флаг
- `sessionId` — привязка к экспедиции (проекту)
- `sessionTitle` — денормализованное название экспедиции (для карточки и WAV, если профиль недоступен)
- `fileName` — UCS-имя для скачивания (не ключ в Object Storage)
- `images` / `gearConfigImages` — URL фото; при публикации WAV URL также пишутся в iXML (`IMAGE_URLS` / `IMAGES_JSON`) и LIST INFO comment

Ключ в облаке: `uploads/{login}/audio_{soundId}.wav` — платформенный id только в пути хранилища и в метаданных файла, **не** в UCS-имени.

---

## 2. Как автор добавляет звук

1. Открыть модалку добавления (`#add-modal` / `toggleAddModal`).
2. Загрузить WAV (или другой аудиоформат; метаданные вшиваются только в WAV).
3. Заполнить поля: название, описание, UCS-категория/CatID, FXName, место, дата/время, техника, лицензия, теги, экспедиция и т.д.
4. Выбрать точку на карте (`tempAddCoords` / `add-coords`).
5. **Черновик** → `publishSound('draft')`  
   **Опубликовать** → `publishSound('pending')` (на модерацию).

Ключевые функции:

| Функция | Файл | Роль |
|---------|------|------|
| `publishSound` | `src/ui/ui.js` | Сбор формы, embed WAV, upload, sync |
| `editSound` | `src/ui/ui.js` | Открыть форму на существующей записи |
| `collectAddFormEmbedMeta` | `src/ui/ui.js` | Снимок формы → BWF/iXML |
| `embedWavMetadata` | `src/core/wavMeta.js` | Вшить bext / iXML / LIST INFO |
| `generateUCSFileName` / `collectUcsNameFromForm` | `ucsName.js` + `ui.js` | UCS-имя |
| `readWavFileMetadata` / `applyUploadedAudioMeta` | `wavReadMeta.js` + `ui.js` | Подставить мета из файла при загрузке |

Сервер (`cloud/api`) не даёт обычному пользователю сразу выставить `published`: новая запись уходит как `draft` или `pending`.

---

## 3. Имя файла и метаданные

### UCS-имя (видно пользователю)

```
CatID_FXName_CreatorID_SourceID[_UserData].wav
```

- **SourceID** = проект из названия экспедиции (`sessionId` → sanitize title). Без экспедиции → `NONE`.
- Платформенный тег `ROSMAP` и уникальный `soundId` **в имя не попадают**.

Подробности: `docs/ucs-naming.md`.

### Внутри WAV (не в имени)

При публикации WAV (фото загружаются **до** embed, чтобы URL попали в файл):

- bext: описание, originator, **OriginatorReference ≈ soundId**, дата/время, coding history
- iXML `USER`: поля формы + `SOUND_ID`, `PLATFORM_ID` (`ROSMAP`), `PROJECT_ID`, `SESSION_ID`, `SESSION_TITLE`, `IMAGE_URLS`, `IMAGES_JSON`, `ROSMAP_JSON`
- LIST INFO: title, author, comment (в т.ч. expedition + photo URLs), license, keywords…

В форме добавления — **одна** кнопка «Правила» (в шапке модалки).

Повторная загрузка такого файла может восстановить поля формы через `applyUploadedAudioMeta`.

---

## 4. Экспедиции

- Экспедиция = `profile.sessions[]`; звук ссылается через `sessionId`.
- Выбор `#add-session` пересчитывает UCS `SourceID` (проект).
- Привязка в кабинете: `assignSoundToSession` — также обновляет `fileName`.
- Просмотр: `openExpeditionViewModal`.
- **Скачать архив** (`downloadExpeditionArchive`): ZIP опубликованных записей с URL; владелец/админ дополнительно получают свои неопубликованные файлы с валидным URL.
- Массовая отправка черновиков экспедиции: `publishSessionDrafts` → все в `pending` + уведомления автору.

---

## 5. Модерация (админ)

Очередь: админ-панель → звуки (`renderAdminList`), фильтры `all` / `pending` / `rejected`, строка поиска `setAdminSearchQuery('sounds'|…)`.

Действия: `setSoundStatus(id, status)` в `src/core/auth.js`.

| Действие | Результат |
|----------|-----------|
| Одобрить → `published` | `rejectionReason` очищается; уведомление автору; подписчикам — `new_sound` |
| Отклонить → **всегда** CustomUI с причиной | Статус становится **`draft`**, причина в `rejectionReason`; уведомление с текстом причины; клик → `editSound` |
| Вернуть / на модерацию → **всегда** CustomUI с причиной | Статус `pending`, причина сохраняется; уведомление автору |
| На модерацию → `pending` | Из админ-меню / повторная отправка автором |

Консоль: `approve`, `reject`, `status` → тот же `setSoundStatus`.

---

## 6. Уведомления

Тип: `moderation`. Хранятся в `mail.json` / `profile.notifications` через `pushNotifications`.

| Событие | Текст (смысл) | Клик |
|---------|---------------|------|
| Автор отправил на модерацию | «… отправлена на модерацию» | `editSound` (правка своей pending) |
| Одобрено | «… одобрена и опубликована» | Карточка звука / детали |
| Отклонено | «… отклонена и возвращена в черновик: {причина}» | Сразу форма черновика (`editSound`) |

Поля нотификации (кроме базовых): `action`, `moderationStatus`, `rejectionReason`.

`openNotification` в `auth.js`: для moderation + edit/pending/rejected/draft не вызывает `selectSound` по карте (неопубликованные там не видны), а открывает редактор.

---

## 7. Повторная отправка после отклонения

1. Автор открывает уведомление или кабинет → «Исправить».
2. Правит поля / файл / точку.
3. Снова **Опубликовать** → статус `pending`, `rejectionReason` очищается.
4. Снова приходит уведомление «отправлена на модерацию».

Сохранение как **Черновик** причину отклонения **не стирает**, чтобы в кабинете она оставалась видимой.

---

## 8. Чеклист при изменении логики

- [ ] Статусы и видимость (`isSoundStatusVisible`) согласованы с картой и кабинетом
- [ ] Новые поля формы попадают в `collectAddFormEmbedMeta` / iXML и в объект звука при `publishSound`
- [ ] UCS: проект из экспедиции; `soundId` / `ROSMAP` только в метаданных
- [ ] Любое решение модератора → `pushNotifications` автору
- [ ] Клик по отклонению → `editSound`, не «звук не найден на карте»
- [ ] Архив экспедиции фильтрует по `sessionId` и доступности URL
- [ ] Не форсировать `published` с клиента для не-админа (сервер это режет)

---

## 9. Быстрые якоря в коде

```
publishSound          → src/ui/ui.js
editSound             → src/ui/ui.js
setSoundStatus        → src/core/auth.js
pushNotifications     → src/core/auth.js
openNotification      → src/core/auth.js
downloadExpeditionArchive → src/ui/ui.js
embedWavMetadata      → src/core/wavMeta.js
buildUcsFileName      → src/core/ucsName.js
```
