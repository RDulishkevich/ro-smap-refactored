# Полёвка Secure API (Yandex Cloud Functions)

Серверная точка входа для авторизации и записи в Object Storage.
Клиент больше не может анонимно перезаписывать JSON-базы.

Публичный продукт: **Полёвка** (`polevka.art`). Техническое имя репозитория/бакетов может оставаться `rosmap*`.

## Что делает API

| action | Auth | Назначение |
|--------|------|------------|
| `health` | нет | проверка живости (`version: 23`, `ydb`, `vapid`) |
| `publicConfig` | нет | публичные ключи (Maps + VAPID public) |
| `savePushSubscription` | access | сохранить Web Push подписку устройства |
| `deletePushSubscription` | access | снять подписку (выход / выкл. уведомлений) |
| `register` | нет | регистрация (пароль → scrypt) |
| `login` | нет | вход → HttpOnly cookies + access JWT; при remember — `refreshToken` в JSON (опц. TOTP) |
| `refresh` | `body.refreshToken` или cookie | новая пара токенов |
| `logout` / `logoutAll` | cookie / JWT | выход с устройства / везде (`tokenVersion++`) |
| `me` | access | проверка сессии / PII + ротация cookies |
| `changePassword` | access | смена пароля + инвалидация других сессий |
| `totpSetup` / `totpConfirm` / `totpDisable` | access | TOTP 2FA |
| `getSecurityEvents` | access admin | журнал security events |
| `requestPasswordReset` | нет | код сброса на **подтверждённый** email |
| `confirmPasswordReset` | нет | код + новый пароль |
| `sync` | access | CAS (If-Match) → merge → sanitize → PUT JSON (+ HMAC); 409 `write_conflict` |
| `patchSound` | access | лёгкий патч plays/downloads/лайков без полной перезаписи `map_data.json` |
| `presign` | access | presigned PUT; медиа и staging JSON требуют `contentLength` (≤ 30 MB / 1 GB / 2.5 MB) |
| `commit` | access | взять staging → merge → sanitize → PUT публичный JSON |
| `getMail` | access | свой ящик + партнёры; admin — все; moderator — свой + `support` |
| `deleteAccount` | access | самоудаление: пароль + TOTP; нельзя `admin`/`support` |
| `exportMyData` | access | JSON своих данных (без хешей пароля) |
| `translate` | access | Yandex Translate RU→EN (UCS FXName) |
| `requestEmailVerification` | access | 6-значный код на email (SMTP); хеш в `_auth/email_codes/{login}.json` |
| `confirmEmailVerification` | access | проверка кода → `email` + `emailVerified` в private_meta |
| `adminDeleteUser` | access admin | полное удаление учётки + PII; профиль → «Удалённый аккаунт» |
| `adminUnbindEmail` | access admin | снять email / `emailVerified` |
| `adminSendEmail` | access admin | письмо пользователю (verified email) |

### Роли

| Роль | Права (sanitize / API) |
|------|------------------------|
| `admin` | всё staff + роли, block, events full merge, `adminDeleteUser` / `adminUnbindEmail` |
| `moderator` | модерация map/feed/mail, жалобы, поддержка |
| `user` | обычный продукт |

Хеши паролей, staging, коды email/сброса и **ящики `_mail/boxes/{login}.json`** живут в **приватном** бакете `rosmap2026-private`. Публичный бакет `rosmap2026` — каталог и медиа (без личных сообщений).

## JSON-базы

| Файл | Бакет | Содержимое |
|------|-------|------------|
| `map_data.json` | public | звуки (метаданные + **https** URL аудио/фото) |
| `profiles.json` | public | визитки **без** email/PII |
| `_mail/boxes/{login}.json` | **private** | inbox / notifications / activityLog одного человека |
| `mail.json` | **private** (legacy) | читается только для миграции в ящики |
| `feed.json` | public | лента |
| `events.json` | public | ивенты |
| `_auth/private_meta.json` | private | email и survey-поля |
| `_auth/email_codes/{login}.json` | private | хеш кода подтверждения email |
| `_auth/password_resets/{login}.json` | private | хеш кода сброса пароля |
| `_auth/security_events.json` | private | журнал security events |
| `_auth/push/{login}.json` | private | Web Push-подписки устройства (endpoint + ключи) |
| `_auth/integrity/*.sig` | private | HMAC-SHA256 критичных JSON. Каталог / users / meta / `_mail/` без `.sig` → 503, кроме `INTEGRITY_ALLOW_UNSIGNED=1` |

Медиа только в `uploads/{login}/…`. **data-URL и blob: в базах запрещены.**

Письма: `cloud/api/mailTemplates.js` (обязателен в zip деплоя).  
Сессии / TOTP / lockout / HMAC: `cloud/api/sessionSecurity.js` (обязателен в zip деплоя).

Подробности по угрозам и чеклистам: [`docs/security.md`](../../docs/security.md).

## Лимиты

| Что | Лимит |
|-----|--------|
| Картинка (presign) | 30 MB |
| Аудио (presign) | 1 GB |
| Тело `sync` / staging JSON | ~2.5 MB; non-staff ≤ 80 строк (`too_many_rows`); staging PUT требует `contentLength` |
| Inbox / notifications | 200 / 100 записей |
| Текст сообщения | 4000 символов |
| Пароль | мин. 8 символов |
| Access JWT / refresh | 30 мин / 14 суток при «запомнить меня»; иначе refresh — session cookie |
| Login lockout | 8 fails → 15 мин (IP+login) |
| Rate limit | IP 360/мин (без health); login 25; refresh 60; sync/commit 120; patchSound 180; presign 90; translate 40; getMail 120; email/reset request 5/10мин на логин, 20/час на IP; confirm 20/10мин; totp 20/10мин |
| Cooldown | sync 400 мс; сообщение 1.6 с; лайк 280 мс; play 800 мс |

## Переменные окружения функции

```
BUCKET=rosmap2026
PRIVATE_BUCKET=rosmap2026-private
STORAGE_ENDPOINT=https://storage.yandexcloud.net
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
JWT_SECRET=<длинная случайная строка>
ADMIN_PASSWORD=<пароль админа, НЕ хранить в клиенте>
ALLOWED_ORIGIN=https://polevka.art,https://www.polevka.art,http://localhost,http://127.0.0.1
YC_TRANSLATE_API_KEY=<ключ Translate API>
YC_FOLDER_ID=<folder id>
YANDEX_MAPS_API_KEY=<браузерный ключ Maps JS, HTTP Referer>
SMTP_HOST=mail.hosting.reg.ru
SMTP_PORT=465
SMTP_USER=noreply@polevka.art
SMTP_PASS=...
MAIL_FROM=Полёвка <noreply@polevka.art>
ALLOW_DEMO_EMAIL_CODES=0
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:support@polevka.art
```

Без SMTP email/reset отвечают `503 mail_not_configured`. SMTP только у провайдеров в РФ (см. [`docs/email-setup.md`](../../docs/email-setup.md)) — не Brevo/зарубежные ESP из‑за 152‑ФЗ.

После смены кода/SMTP — передеплой (`health.version` ≥ 18).

v18: HMAC обязателен на каталог и учётки (сначала `node cloud/ops/seal-integrity.cjs` или временно `INTEGRITY_ALLOW_UNSIGNED=1`). Лимиты логина/почты и lockout пишутся в `_auth/rate_buckets.json` / `login_locks.json`, чтобы пережить cold start. Масштаб функции: `pwsh cloud/ops/set-scale-policy.ps1`.

v17: YDB Document API — источник правды (строки звуков / профилей / почты / учёток). Публичный JSON в Object Storage — кэш карты для гостей. Без `YDB_DOCAPI_ENDPOINT` API продолжает S3+CAS.

Создать БД: `pwsh cloud/ops/ydb-create.ps1` → миграция `node cloud/ops/migrate-to-ydb.cjs` → env функции + роль `ydb.databaseUser` у SA.

## Деплой (консоль или CLI)

1. Сервисный аккаунт с ролями `storage.editor` на оба бакета.
2. Публичный бакет: анонимное чтение JSON/медиа; **запретить** публичный GetObject на `mail.json`.
3. Приватный бакет: без публичного доступа.
4. Упакуйте функцию:

```bash
cd cloud/api
npm install --omit=dev
zip -r ../rosmap-api.zip index.js sessionSecurity.js mailTemplates.js ydbDoc.js mailCrypto.js webPush.js package.json node_modules
```

Или PowerShell: `Compress-Archive -Path index.js, mailTemplates.js, package.json, package-lock.json, node_modules ...`  
(см. `cloud/ops/set-regru-smtp.ps1`).

5. Обновите функцию (Node.js 18+), entrypoint `index.handler`, env из списка выше.
6. В клиенте `src/core/state.js` — `YANDEX_FUNCTION_URL`.

## Важно

После деплоя **анонимный** `{ fileName, contentType }` больше не выдаёт upload URL.
Старый клиент без JWT писать в базу не сможет — это ожидаемо.
