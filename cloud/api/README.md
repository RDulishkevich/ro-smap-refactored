# RO.SMap Secure API (Yandex Cloud Functions)

Серверная точка входа для авторизации и записи в Object Storage.
Клиент больше не может анонимно перезаписывать JSON-базы.

## Что делает API

| action | Auth | Назначение |
|--------|------|------------|
| `health` | нет | проверка живости (`version: 5`) |
| `register` | нет | регистрация (пароль → scrypt) |
| `login` | нет | вход → JWT |
| `me` | JWT | проверка сессии / refresh |
| `changePassword` | JWT | смена пароля |
| `sync` | JWT | GET→merge→sanitize→PUT JSON |
| `patchSound` | JWT | лёгкий патч plays/downloads/лайков без полной перезаписи `map_data.json` |
| `presign` | JWT | presigned PUT для `uploads/{login}/...` и `staging/{login}/...` |
| `commit` | JWT | взять staging → merge → sanitize → PUT публичный JSON |
| `translate` | JWT | Yandex Translate RU→EN (UCS FXName); env `YC_TRANSLATE_API_KEY`, `YC_FOLDER_ID` |

Хеши паролей и staging живут в **приватном** бакете `rosmap2026-private` (`_auth/users.json`, `staging/...`). Публичный бакет `rosmap2026` — каталог и медиа.

## JSON-базы (публичный бакет)

| Файл | Содержимое |
|------|------------|
| `map_data.json` | звуки (метаданные + **https** URL аудио/фото) |
| `profiles.json` | визитки (bio, avatar URL, gear, sessions…) **без** почты |
| `mail.json` | inbox / notifications / activityLog по `loginName` |
| `feed.json` | лента |
| `events.json` | ивенты (конкурсы / встречи / RSVP) |

Медиа только в `uploads/{login}/…` (или legacy `audio/` / `images/`). **data-URL и blob: в базах запрещены** — API вычищает при sync.

## Лимиты

| Что | Лимит |
|-----|--------|
| Картинка (presign) | 30 MB |
| Аудио (presign) | 1 GB |
| Тело `sync` | ~2.5 MB (иначе staging+commit) |
| Inbox / notifications | 200 / 100 записей |
| Текст сообщения | 4000 символов |
| Rate limit | IP 360/мин (без health); sync/commit 120; patchSound 180; presign 90; translate 40 |

## Переменные окружения функции

```
BUCKET=rosmap2026
PRIVATE_BUCKET=rosmap2026-private
STORAGE_ENDPOINT=https://storage.yandexcloud.net
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
JWT_SECRET=<длинная случайная строка>
ADMIN_PASSWORD=<пароль админа, НЕ хранить в клиенте>
ALLOWED_ORIGIN=*
YC_TRANSLATE_API_KEY=<ключ Translate API>
YC_FOLDER_ID=<folder id, если требуется для ключа>
```

После добавления Translate env — передеплой функции (`health.version` должен стать `5`). Без ключа `translate` отвечает `503 translate_unconfigured`.

## Деплой (консоль или CLI)

1. Сервисный аккаунт с ролями `storage.editor` на оба бакета.
2. Публичный бакет: анонимное чтение JSON/медиа; запись только через SA/API.
3. Приватный бакет: без публичного доступа.
4. Упакуйте функцию:

```bash
cd cloud/api
npm install --omit=dev
zip -r ../rosmap-api.zip index.js package.json node_modules
```

5. Обновите функцию (Node.js 18+), entrypoint `index.handler`, env из списка выше.
6. В клиенте `src/core/state.js` — `YANDEX_FUNCTION_URL`.

## Миграция Stage 2 (profiles → mail)

Один раз после деплоя API v2:

```powershell
node cloud/ops/split-profiles-mail.mjs --dry-run
node cloud/ops/split-profiles-mail.mjs
```

API также умеет лениво вынести почту из `profiles.json` при ближайшем sync, если клиент ещё шлёт старый формат.

## Важно

После деплоя **анонимный** `{ fileName, contentType }` больше не выдаёт upload URL.
Старый клиент без JWT писать в базу не сможет — это ожидаемо.
