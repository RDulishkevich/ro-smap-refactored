# RO.SMap Secure API (Yandex Cloud Functions)

Серверная точка входа для авторизации и записи в Object Storage.
Клиент больше не может анонимно перезаписывать JSON-базы.

## Что делает API

| action | Auth | Назначение |
|--------|------|------------|
| `health` | нет | проверка живости (`version: 8`) |
| `publicConfig` | нет | публичные ключи (Maps) |
| `register` | нет | регистрация (пароль → scrypt) |
| `login` | нет | вход → JWT |
| `me` | JWT | проверка сессии / refresh + PII из private_meta |
| `changePassword` | JWT | смена пароля |
| `sync` | JWT | GET→merge→sanitize→PUT JSON |
| `patchSound` | JWT | лёгкий патч plays/downloads/лайков без полной перезаписи `map_data.json` |
| `presign` | JWT | presigned PUT для `uploads/{login}/...` и `staging/{login}/...` |
| `commit` | JWT | взять staging → merge → sanitize → PUT публичный JSON |
| `getMail` | JWT | личная почта (проекция); admin — полный `mail.json` |
| `translate` | JWT | Yandex Translate RU→EN (UCS FXName); env `YC_TRANSLATE_API_KEY`, `YC_FOLDER_ID` |
| `requestEmailVerification` | JWT | 6-значный код на email (SMTP); хеш в `_auth/email_codes/{login}.json` |
| `confirmEmailVerification` | JWT | проверка кода → `email` + `emailVerified` в private_meta |

Хеши паролей, staging, коды email и **mail.json** живут в **приватном** бакете `rosmap2026-private` (`_auth/users.json`, `_auth/private_meta.json`, `_auth/email_codes/`, `staging/...`, `mail.json`). Публичный бакет `rosmap2026` — каталог и медиа (без личных сообщений).

## JSON-базы

| Файл | Бакет | Содержимое |
|------|-------|------------|
| `map_data.json` | public | звуки (метаданные + **https** URL аудио/фото) |
| `profiles.json` | public | визитки (bio, avatar URL, gear, sessions…) **без** email/PII |
| `mail.json` | **private** | inbox / notifications / activityLog; клиент получает только свою проекцию через `getMail`/`sync` |
| `feed.json` | public | лента |
| `events.json` | public | ивенты (конкурсы / встречи / RSVP) |
| `_auth/private_meta.json` | private | email и survey-поля профилей |
| `_auth/email_codes/{login}.json` | private | хеш кода подтверждения email (TTL ~10 мин) |

Медиа только в `uploads/{login}/…` (или legacy `audio/` / `images/`). **data-URL и blob: в базах запрещены** — API вычищает при sync.

## Лимиты

| Что | Лимит |
|-----|--------|
| Картинка (presign) | 30 MB |
| Аудио (presign) | 1 GB |
| Тело `sync` | ~2.5 MB (иначе staging+commit) |
| Inbox / notifications | 200 / 100 записей |
| Текст сообщения | 4000 символов |
| Пароль | мин. 8 символов |
| Rate limit | IP 360/мин (без health); sync/commit 120; patchSound 180; presign 90; translate 40; getMail 120; email request 5/10мин на логин, 20/час на IP; email confirm 20/10мин |

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
YANDEX_MAPS_API_KEY=<browser Maps key>
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
ALLOW_DEMO_EMAIL_CODES=0
```

Без SMTP `requestEmailVerification` отвечает `503 mail_not_configured` (клиент показывает toast без кода). На staging можно `ALLOW_DEMO_EMAIL_CODES=1` — тогда в ответе будет `demoCode`. SMTP только у провайдеров в РФ (см. [`docs/email-setup.md`](../../docs/email-setup.md), Unisender Go) — не Brevo/зарубежные ESP из‑за 152‑ФЗ.

После добавления Translate/SMTP env — передеплой функции (`health.version` ≥ 8). Без ключа `translate` отвечает `503 translate_unconfigured`.

## Деплой (консоль или CLI)

1. Сервисный аккаунт с ролями `storage.editor` на оба бакета.
2. Публичный бакет: анонимное чтение JSON/медиа; **запретить** публичный GetObject на `mail.json` (см. `cloud/ops/bucket-deny-sensitive.json`). Запись только через SA/API.
3. Приватный бакет: без публичного доступа (`mail.json`, `_auth/`, `staging/`).
4. Упакуйте функцию:

```bash
cd cloud/api
npm install --omit=dev
zip -r ../rosmap-api.zip index.js package.json node_modules
```

5. Обновите функцию (Node.js 18+), entrypoint `index.handler`, env из списка выше.
6. В клиенте `src/core/state.js` — `YANDEX_FUNCTION_URL`.
7. После деплоя API v6 первый `getMail`/`sync` mail мигрирует старый публичный `mail.json` в private и затирает публичную копию до `[]`.

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
