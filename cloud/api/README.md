# Полёвка Secure API (Yandex Cloud Functions)

Серверная точка входа для авторизации и записи в Object Storage.
Клиент больше не может анонимно перезаписывать JSON-базы.

Публичный продукт: **Полёвка** (`polevka.art`). Техническое имя репозитория/бакетов может оставаться `rosmap*`.

## Что делает API

| action | Auth | Назначение |
|--------|------|------------|
| `health` | нет | проверка живости (`version: 10`) |
| `publicConfig` | нет | публичные ключи (Maps) |
| `register` | нет | регистрация (пароль → scrypt) |
| `login` | нет | вход → JWT |
| `me` | JWT | проверка сессии / refresh + PII из private_meta |
| `changePassword` | JWT | смена пароля (залогинен) |
| `requestPasswordReset` | нет | код сброса на **подтверждённый** email |
| `confirmPasswordReset` | нет | код + новый пароль |
| `sync` | JWT | GET→merge→sanitize→PUT JSON |
| `patchSound` | JWT | лёгкий патч plays/downloads/лайков без полной перезаписи `map_data.json` |
| `presign` | JWT | presigned PUT для `uploads/{login}/...` и `staging/{login}/...` |
| `commit` | JWT | взять staging → merge → sanitize → PUT публичный JSON |
| `getMail` | JWT | личная почта (проекция); staff — полный `mail.json` |
| `translate` | JWT | Yandex Translate RU→EN (UCS FXName) |
| `requestEmailVerification` | JWT | 6-значный код на email (SMTP); хеш в `_auth/email_codes/{login}.json` |
| `confirmEmailVerification` | JWT | проверка кода → `email` + `emailVerified` в private_meta |
| `adminDeleteUser` | JWT admin | полное удаление учётки + PII; профиль → «Удалённый аккаунт» |
| `adminUnbindEmail` | JWT admin | снять email / `emailVerified` |

### Роли

| Роль | Права (sanitize / API) |
|------|------------------------|
| `admin` | всё staff + роли, block, events full merge, `adminDeleteUser` / `adminUnbindEmail` |
| `moderator` | модерация map/feed/mail, жалобы, поддержка |
| `user` | обычный продукт |

Хеши паролей, staging, коды email/сброса и **mail.json** живут в **приватном** бакете `rosmap2026-private`. Публичный бакет `rosmap2026` — каталог и медиа (без личных сообщений).

## JSON-базы

| Файл | Бакет | Содержимое |
|------|-------|------------|
| `map_data.json` | public | звуки (метаданные + **https** URL аудио/фото) |
| `profiles.json` | public | визитки **без** email/PII |
| `mail.json` | **private** | inbox / notifications / activityLog |
| `feed.json` | public | лента |
| `events.json` | public | ивенты |
| `_auth/private_meta.json` | private | email и survey-поля |
| `_auth/email_codes/{login}.json` | private | хеш кода подтверждения email |
| `_auth/password_resets/{login}.json` | private | хеш кода сброса пароля |

Медиа только в `uploads/{login}/…`. **data-URL и blob: в базах запрещены.**

Письма: `cloud/api/mailTemplates.js` (обязателен в zip деплоя).

## Лимиты

| Что | Лимит |
|-----|--------|
| Картинка (presign) | 30 MB |
| Аудио (presign) | 1 GB |
| Тело `sync` | ~2.5 MB (иначе staging+commit) |
| Inbox / notifications | 200 / 100 записей |
| Текст сообщения | 4000 символов |
| Пароль | мин. 8 символов |
| Rate limit | IP 360/мин (без health); sync/commit 120; patchSound 180; presign 90; translate 40; getMail 120; email/reset request 5/10мин на логин, 20/час на IP; confirm 20/10мин |

## Переменные окружения функции

```
BUCKET=rosmap2026
PRIVATE_BUCKET=rosmap2026-private
STORAGE_ENDPOINT=https://storage.yandexcloud.net
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
JWT_SECRET=<длинная случайная строка>
ADMIN_PASSWORD=<пароль админа, НЕ хранить в клиенте>
ALLOWED_ORIGIN=https://polevka.art,https://www.polevka.art,https://rdulishkevich.github.io,http://localhost,http://127.0.0.1
YC_TRANSLATE_API_KEY=<ключ Translate API>
YC_FOLDER_ID=<folder id>
YANDEX_MAPS_API_KEY=<браузерный ключ Maps JS, HTTP Referer>
SMTP_HOST=mail.hosting.reg.ru
SMTP_PORT=465
SMTP_USER=noreply@polevka.art
SMTP_PASS=...
MAIL_FROM=Полёвка <noreply@polevka.art>
ALLOW_DEMO_EMAIL_CODES=0
```

Без SMTP email/reset отвечают `503 mail_not_configured`. SMTP только у провайдеров в РФ (см. [`docs/email-setup.md`](../../docs/email-setup.md)) — не Brevo/зарубежные ESP из‑за 152‑ФЗ.

После смены кода/SMTP — передеплой (`health.version` ≥ 10).

## Деплой (консоль или CLI)

1. Сервисный аккаунт с ролями `storage.editor` на оба бакета.
2. Публичный бакет: анонимное чтение JSON/медиа; **запретить** публичный GetObject на `mail.json`.
3. Приватный бакет: без публичного доступа.
4. Упакуйте функцию:

```bash
cd cloud/api
npm install --omit=dev
zip -r ../rosmap-api.zip index.js mailTemplates.js package.json node_modules
```

Или PowerShell: `Compress-Archive -Path index.js, mailTemplates.js, package.json, package-lock.json, node_modules ...`  
(см. `cloud/ops/set-regru-smtp.ps1`).

5. Обновите функцию (Node.js 18+), entrypoint `index.handler`, env из списка выше.
6. В клиенте `src/core/state.js` — `YANDEX_FUNCTION_URL`.

## Важно

После деплоя **анонимный** `{ fileName, contentType }` больше не выдаёт upload URL.
Старый клиент без JWT писать в базу не сможет — это ожидаемо.
