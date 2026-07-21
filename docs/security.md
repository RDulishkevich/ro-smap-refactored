# Безопасность Полёвки (RO.SMap)

Документ описывает модель угроз, текущие меры защиты, границы доверия и операционные чеклисты.  
Актуально для Secure API **v13+** (cookie-сессии, refresh, TOTP, HMAC-целостность JSON).

Связанные материалы:

- деплой API — [`cloud/api/README.md`](../cloud/api/README.md)
- ops / бакеты — [`cloud/ops/README.md`](../cloud/ops/README.md)
- политика ПДн — [`docs/privacy-policy.md`](privacy-policy.md)
- почта / верификация — [`docs/email-setup.md`](email-setup.md)

---

## 1. Модель доверия

| Зона | Доверие | Что хранит |
|------|---------|------------|
| Браузер (фронт) | **недоверенный** | UI, флаг сессии, access JWT в memory/`sessionStorage` (не `localStorage`) |
| Secure API (Yandex Cloud Function) | **доверенный** | проверка JWT/cookies, merge/sanitize, presign, Translate, TOTP |
| `rosmap2026` (public) | публичное чтение | каталог звуков, визитки, лента, медиа |
| `rosmap2026-private` | только SA / API | `_auth/`, `mail.json`, `staging/`, PII, HMAC-подписи |

**Правило:** всё, что приходит с клиента, считается поддельным, пока сервер не проверил сессию и не прогнал данные через sanitize.

---

## 2. Архитектура защиты (кратко)

```text
Browser (credentials: include)
  │  POST { action, … }
  │  Cookie: rosmap_at (access) + rosmap_rt (refresh)  HttpOnly; Secure; SameSite=None
  │  опционально X-Rosmap-Token (access JWT в memory)
  ▼
Cloud Function (Secure API)
  │  verify access JWT (typ=access, tv=tokenVersion)
  │  resolve role from _auth + profiles
  │  merge + sanitize → put JSON (+ HMAC sig) / presign
  ▼
Object Storage
  ├── rosmap2026          (public read: map/profiles/feed/events/uploads)
  └── rosmap2026-private  (_auth, mail.json, staging, private_meta, integrity/*.sig)
```

Клиент **не** пишет JSON анонимно. Старый `{ fileName, contentType }` без сессии → `401`.

---

## 3. Что защищено

### 3.1 Аутентификация и пароли

- Регистрация / вход только через API (`register` / `login`).
- Пароли: **scrypt** + salt, сравнение через `timingSafeEqual`.
- Хеши в `_auth/users.json` (private bucket).
- Минимальная длина пароля: **8**.
- **Access JWT** TTL **30 минут** (`typ: access`); **refresh JWT** TTL **14 суток** (`typ: refresh`).
- Оба токена в **HttpOnly** cookies (`rosmap_at` / `rosmap_rt`), `Secure; SameSite=None` (SPA на другом origin).
- Клиент шлёт `credentials: 'include'`; access JWT дублируется в `sessionStorage`/`memory` для заголовка `X-Rosmap-Token` (не в `localStorage`).
- Подпись JWT проверяется с `timingSafeEqual`.
- `tokenVersion` (`tv` в JWT): смена пароля / logout everywhere / отключение 2FA инвалидирует все старые токены.
- Legacy plaintext `rosmap_users_db` и JWT в `localStorage` очищаются.

### 3.2 Refresh / logout

| action | Назначение |
|--------|------------|
| `refresh` | новый access+refresh по cookie `rosmap_rt` |
| `logout` | сброс cookies на этом устройстве |
| `logoutAll` | `tokenVersion++` + сброс cookies (выход везде) |

Клиент при `401` на auth-запросе один раз пробует `refresh`, затем повторяет запрос.

### 3.3 TOTP 2FA

- Действия: `totpSetup` → секрет + `otpauth://` URL; `totpConfirm` (код); `totpDisable` (пароль + код).
- При включённой 2FA `login` без кода возвращает `{ needsTotp: true }` (без выдачи сессии).
- UI: кабинет → вкладка безопасности; при входе — промпт кода.
- Рекомендуется для `admin` / `moderator`.

### 3.4 Login lockout и rate limit

- После **8** неудачных попыток (IP+login) — блокировка **15 минут** (`login_locked`).
- API rate limits: login 25/мин на IP; register 8; refresh 60; totp 20/10мин; плюс прежние sync/presign/email.
- Общий потолок IP: 360/мин (кроме health/publicConfig).

### 3.5 Авторизация и роли

- Роль **не** берётся слепо из JWT на запись.
- На защищённых actions вызывается `resolveAuthUser`:
  - читает `_auth` + `profiles.json`;
  - сверяет `tv` / `tokenVersion`;
  - принимает только `typ: access`;
  - учитывает `blocked`;
  - выдаёт актуальную роль (`admin` / `moderator` / `user`).
- **Admin:** роли, блокировки, purge, security events, полный merge events, опасные команды консоли.
- **Moderator (staff):** модерация звуков / жалоб / поддержки; без ролей, block и purge.
- Клиентский `role` в DevTools не даёт прав на сервере.

### 3.6 Личные сообщения (`mail.json`)

- Файл живёт только в **private** bucket.
- Публичный объект удалён; bucket policy запрещает анонимный `GetObject` на `mail.json` (SA исключён).
- Чтение: `action=getMail` (сессия); poll/bootstrap **не** ходят в публичный CDN за mail.
- Ответ sync/commit: **проекция** — свой ящик + свои исходящие; полный снимок у staff.

Миграция / проверка:

```powershell
node cloud/ops/migrate-mail-private.cjs
# Ожидание: https://storage.yandexcloud.net/rosmap2026/mail.json → 403/404
```

### 3.7 Профили и PII

- Публичный `profiles.json` — визитки **без** email / survey / consent.
- PII в `_auth/private_meta.json` (private).
- Отдаётся владельцу через `me` / `login`.

### 3.8 Карта звуков / лента / ивенты

Сервер на каждый sync:

| Ресурс | Обычный пользователь | Staff (admin/moderator) | Только admin |
|--------|----------------------|-------------------------|--------------|
| Свои звуки | да (self-publish → `pending`) | да | да |
| Чужие звуки | только comments / reactions / plays / downloads | полный merge | полный |
| Комментарии | `authorId` = JWT login | полный | полный |
| Лайки | только своё имя в списках | полный | полный |
| Feed | create запрещён; social ограничены | полный merge | полный |
| Events | RSVP | RSVP | полный merge (create/edit/delete) |

Клиент: escape HTML в комментариях к звукам (защита от stored XSS).

### 3.9 Медиа и uploads

- Presign только для `uploads/{login}/…` и `staging/{login}/…`.
- `_auth/` и корневые JSON через presign недоступны (`use_sync`).
- Path traversal (`..`) режется.
- В JSON запрещены `data:` / `blob:` URL медиа — только `https` или относительные пути.
- Лимиты: изображение ≤ 30 MB, аудио ≤ 1 GB.

### 3.10 Целостность JSON (HMAC)

При каждом `putJson` критичных ключей пишется подпись:

- путь: `_auth/integrity/<key>.sig` (private)
- алгоритм: HMAC-SHA256 от сырого UTF-8 тела, ключ = `JWT_SECRET`

При чтении: если `.sig` есть и не совпадает → объект считается повреждённым/подменённым, в лог + security event `integrity_mismatch`, клиенту — fallback. Объекты без `.sig` (legacy) читаются как раньше.

Покрыто: `mail.json`, `profiles.json`, `map_data.json`, `feed.json`, `events.json`, `_auth/*`.

### 3.11 Security events

- Файл: `_auth/security_events.json` (private), до 200 последних событий.
- Типы: `login_ok` / `login_fail` / `login_locked` / `totp_fail` / `totp_enabled` / `totp_disabled` / `password_changed` / `logout` / `logout_all` / `integrity_mismatch`.
- Чтение: `getSecurityEvents` — только **admin**.

### 3.12 Секреты и фронт

| Секрет | Где |
|--------|-----|
| `JWT_SECRET`, `ADMIN_PASSWORD`, S3 keys, Translate | env Cloud Function |
| `YANDEX_MAPS_API_KEY` | env → `action=publicConfig` (не в git / не в HTML) |
| Ключи 2GIS / Google Maps | только user localStorage (опциональные провайдеры) |

В исходниках фронта **нет** write-секретов.  
URL функции и бакета публичны по природе SPA.

Ключ Maps после `publicConfig` виден в Network — нормально для JS Maps API. Защита: **HTTP Referer** в кабинете Яндекса (`polevka.art`, `localhost`, `127.0.0.1`).

### 3.13 CORS и заголовки API

- Whitelist Origin (не `*`):
  - `https://polevka.art`
  - `https://www.polevka.art`
  - `https://rdulishkevich.github.io`
  - `http://localhost` / `http://127.0.0.1` (любой порт)
- `Access-Control-Allow-Credentials: true` для trusted Origin (нужно для cookie-сессий).
- Чужой Origin получает «чужой» ACAO (`https://polevka.art`) → браузер блокирует.
- Дополнительно: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Vary: Origin`.

Env: `ALLOWED_ORIGIN=comma,separated,list` (см. `cloud/api/.env.example`).

### 3.14 Клиент: CSP, SRI, Tailwind

- Content-Security-Policy в `index.html`: **без `unsafe-eval`** (Play CDN Tailwind убран).
- Self-hosted CSS: `src/tailwind.built.css` (`npm run build:css`).
- SRI (`integrity` + `crossorigin`) на Font Awesome / Omnitone / React / ReactDOM.
- `script-src` допускает `https:` для карт (Яндекс / MapLibre / 2GIS и т.д.) + `'unsafe-inline'` для inline boot; `object-src 'none'`, `frame-ancestors 'none'`.

### 3.15 Антиспам

- Клиент: `spamGuardCheck` на комментарии, сообщения, реакции, публикацию.

### 3.16 Ошибки API

- Ответы 500 без `detail` с внутренним `err.message` (нет утечки стека клиенту).

---

## 4. Публичные данные (осознанно)

Доступны анонимно из public bucket (нужно для карты без логина):

- `map_data.json` — метаданные звуков и https-URL медиа  
- `profiles.json` — публичные визитки (без email/PII)  
- `feed.json`, `events.json`  
- `uploads/…` — медиафайлы  

Сюда **нельзя** класть переписку, хеши паролей, email, коды подтверждения.

---

## 5. Остаточный риск

Безопасность — процесс. После v13 остаётся:

| Риск | Комментарий |
|------|-------------|
| XSS + злоупотребление сессией | HttpOnly cookies нельзя украсть в JS, но XSS всё ещё может дергать API с `credentials` в контексте жертвы |
| Слабый пароль без 2FA | 2FA есть, но не обязательна для всех (рекомендуется staff) |
| Ключ Maps в Network | HTTP Referer lock |
| Зависимости npm (API + Tailwind) | Регулярный `npm audit` |
| Человеческий фактор | Утечка env, слабый admin-пароль, ошибочная bucket policy |
| WAF / DDoS на уровне CDN | выносится в ops (Yandex / Cloudflare), не в приложение |

Формулировка «нас точно не взломают» некорректна. Корректно: критичные сливы и клиентское повышение привилегий закрыты на production-уровне.

---

## 6. Операционный чеклист

### После каждого деплоя API

```powershell
# health — ожидание version >= 13
Invoke-RestMethod -Method POST -Uri $env:YANDEX_FUNCTION_URL `
  -ContentType "application/json" -Body '{"action":"health"}'

# CORS + credentials (свой Origin)
# Origin: https://polevka.art → ACAO = https://polevka.art
# Access-Control-Allow-Credentials: true

# mail не публичен
# GET https://storage.yandexcloud.net/rosmap2026/mail.json → 403/404

# auth не публичен
# GET …/rosmap2026/_auth/users.json → 403/404
```

### Ротация секретов

1. Сменить `JWT_SECRET` → все сессии и HMAC-подписи перестают сходиться; пользователи логинятся заново; JSON перезапишутся с новыми `.sig` при следующих sync.
2. Сменить S3 static keys + env функции.
3. Сменить `ADMIN_PASSWORD` (bootstrap); основной пароль админа — через кабинет; для admin включить TOTP.
4. При компрометации Maps-ключа — перевыпуск + обновление env `YANDEX_MAPS_API_KEY`.
5. Расписание: раз в квартал или сразу при инциденте — `npm audit` в `cloud/api` и корне проекта; ротация JWT/S3 по чеклисту выше.

### npm audit

```powershell
cd cloud/api; npm audit
cd ../..; npm audit
```

На момент v13: корневой фронт — 0 issues; `cloud/api` — nodemailer обновлён до **9.0.3** (закрыты advisory для ≤9.0.0).
### Bucket policy

Эталон: [`cloud/ops/bucket-deny-sensitive.json`](../cloud/ops/bucket-deny-sensitive.json)

```powershell
yc storage bucket update --name rosmap2026 `
  --policy-from-file cloud/ops/bucket-deny-sensitive.json
```

Private bucket: без публичного чтения; CORS только для trusted origins (staging PUT).

---

## 7. Действия API (auth)

| action | Auth | Назначение |
|--------|------|------------|
| `health` | нет | версия / живость (`version: 13`) |
| `publicConfig` | нет | Maps key + bucket URL (browser-safe) |
| `register` / `login` | нет | учётка → cookies + access JWT (+ optional TOTP) |
| `refresh` | refresh cookie | новая пара токенов |
| `logout` / `logoutAll` | cookie / access | выход с устройства / везде |
| `me` | access | session + PII + ротация cookies |
| `changePassword` | access | смена пароля + `tokenVersion++` |
| `totpSetup` / `totpConfirm` / `totpDisable` | access | 2FA |
| `getSecurityEvents` | access admin | журнал security events |
| `getMail` | access | проекция почты |
| `sync` / `commit` | access | merge + sanitize JSON |
| `presign` | access | upload URL |
| `patchSound` | access | plays / downloads / реакции |
| `translate` | access | Yandex Translate |
| `requestEmailVerification` / `confirmEmailVerification` | access | email-коды (SMTP) |
| `requestPasswordReset` / `confirmPasswordReset` | нет | сброс пароля |
| `adminDeleteUser` / `adminUnbindEmail` / `adminSendEmail` | access admin | staff ops |

---

## 8. История ключевых ужесточений

| Этап | Суть |
|------|------|
| Secure API | Запись только с JWT; scrypt; серверный merge |
| Mail split | Inbox вынесен из profiles; затем в private bucket |
| PII | Email/survey → `_auth/private_meta.json` |
| Maps key | Убран из HTML → `publicConfig` |
| Role re-resolve | Админ-права сверяются с облаком на каждый write |
| Comment/like forge | Сервер фиксирует `authorId` / списки реакций |
| XSS comments | Escape на рендере |
| CORS v9 | Whitelist доменов вместо `*` |
| SRI | Integrity на основные CDN-скрипты |
| **v13 sessions** | HttpOnly cookies, access 30м / refresh 14д, tokenVersion |
| **v13 2FA** | TOTP setup/confirm/disable + login challenge |
| **v13 lockout** | 8 fails → 15 мин; security_events |
| **v13 integrity** | HMAC на критичных JSON |
| **v13 frontend** | Self-host Tailwind, CSP без `unsafe-eval` |

---

## 9. Контакты по инцидентам

Подозрение на утечку / взлом:

1. Немедленно ротировать `JWT_SECRET` и S3-ключи; попросить staff сделать «Выйти на всех устройствах» / сменить пароль.
2. Проверить bucket policy и наличие `mail.json` / `_auth` в public.
3. Просмотреть `getSecurityEvents` (admin) / жалобы / аномальный sync.
4. Связь: чат поддержки в приложении; email — `support@polevka.art` (см. политику ПДн).
