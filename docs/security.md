# Безопасность Полёвки (RO.SMap)

Документ описывает модель угроз, текущие меры защиты, границы доверия и операционные чеклисты.  
Актуально для Secure API **v10+** и клиентского кода после выноса секретов с фронта.

Связанные материалы:

- деплой API — [`cloud/api/README.md`](../cloud/api/README.md)
- ops / бакеты — [`cloud/ops/README.md`](../cloud/ops/README.md)
- политика ПДн — [`docs/privacy-policy.md`](privacy-policy.md)
- почта / верификация — [`docs/email-setup.md`](email-setup.md)

---

## 1. Модель доверия

| Зона | Доверие | Что хранит |
|------|---------|------------|
| Браузер (фронт) | **недоверенный** | UI, JWT в `localStorage`, публичные URL |
| Secure API (Yandex Cloud Function) | **доверенный** | проверка JWT, merge/sanitize, presign, Translate |
| `rosmap2026` (public) | публичное чтение | каталог звуков, визитки, лента, медиа |
| `rosmap2026-private` | только SA / API | `_auth/`, `mail.json`, `staging/`, PII |

**Правило:** всё, что приходит с клиента, считается поддельным, пока сервер не проверил JWT и не прогнал данные через sanitize.

---

## 2. Архитектура защиты (кратко)

```text
Browser
  │  POST { action, … } + X-Rosmap-Token (JWT)
  ▼
Cloud Function (Secure API)
  │  verify JWT → resolve role from _auth + profiles
  │  merge + sanitize → put JSON / presign
  ▼
Object Storage
  ├── rosmap2026          (public read: map/profiles/feed/events/uploads)
  └── rosmap2026-private  (_auth, mail.json, staging, private_meta)
```

Клиент **не** пишет JSON анонимно. Старый `{ fileName, contentType }` без JWT → `401`.

---

## 3. Что защищено

### 3.1 Аутентификация и пароли

- Регистрация / вход только через API (`register` / `login`).
- Пароли: **scrypt** + salt, сравнение через `timingSafeEqual`.
- Хеши в `_auth/users.json` (private bucket).
- Минимальная длина пароля: **8**.
- JWT (HS256, `JWT_SECRET` только в env функции), TTL 14 суток.
- Подпись JWT проверяется с `timingSafeEqual`.
- Сессия без JWT на клиенте не считается валидной.
- Legacy plaintext `rosmap_users_db` в `localStorage` удалён / очищается.

### 3.2 Авторизация и роли

- Роль **не** берётся слепо из JWT на запись.
- На `sync` / `commit` / `presign` / `patchSound` / `me` / … вызывается `resolveAuthUser`:
  - читает `_auth` + `profiles.json`;
  - учитывает `blocked`;
  - выдаёт актуальную роль (`admin` / `moderator` / `user`).
- **Admin:** роли, блокировки, purge аккаунта (`adminDeleteUser`), снятие email (`adminUnbindEmail`), полный merge events, опасные команды консоли.
- **Moderator (staff):** модерация звуков / жалоб / поддержки, полный merge map/feed/mail; без ролей, block и purge.
- Снятие staff-роли сразу лишает привилегий sanitize (не ждёт истечения старого JWT).
- Клиентский `role` в DevTools не даёт прав на сервере.

### 3.3 Личные сообщения (`mail.json`)

- Файл живёт только в **private** bucket.
- Публичный объект удалён; bucket policy запрещает анонимный `GetObject` на `mail.json` (SA исключён).
- Чтение: `action=getMail` (JWT).
- Ответ sync/commit: **проекция** — свой ящик + свои исходящие для UI чатов; полный снимок у staff (`admin` \| `moderator`).
- Sanitize: чужие сообщения нельзя править; можно только дописать свои исходящие получателю.

Миграция / проверка:

```powershell
node cloud/ops/migrate-mail-private.cjs
# Ожидание: https://storage.yandexcloud.net/rosmap2026/mail.json → 403/404
```

### 3.4 Профили и PII

- Публичный `profiles.json` — визитки **без** email / survey / consent.
- PII в `_auth/private_meta.json` (private).
- Отдаётся владельцу через `me` / `login` (и сохраняется при sync профиля).
- При `me` — разовая миграция PII из старого публичного профиля + scrub.

### 3.5 Карта звуков / лента / ивенты

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

### 3.6 Медиа и uploads

- Presign только для `uploads/{login}/…` и `staging/{login}/…`.
- `_auth/` и корневые JSON через presign недоступны (`use_sync`).
- Path traversal (`..`) режется.
- В JSON запрещены `data:` / `blob:` URL медиа — только `https` или относительные пути.
- Лимиты: изображение ≤ 30 MB, аудио ≤ 1 GB.

### 3.7 Секреты и фронт

| Секрет | Где |
|--------|-----|
| `JWT_SECRET`, `ADMIN_PASSWORD`, S3 keys, Translate | env Cloud Function |
| `YANDEX_MAPS_API_KEY` | env → `action=publicConfig` (не в git / не в HTML) |
| Ключи 2GIS / Google Maps | только user localStorage (опциональные провайдеры) |

В исходниках фронта **нет** write-секретов.  
URL функции и бакета публичны по природе SPA.

Ключ Maps после `publicConfig` виден в Network — нормально для JS Maps API. Защита: **HTTP Referer** в кабинете Яндекса (`polevka.art`, `localhost`, `127.0.0.1`).

### 3.8 CORS и заголовки API

- Whitelist Origin (не `*`):
  - `https://polevka.art`
  - `https://www.polevka.art`
  - `https://rdulishkevich.github.io`
  - `http://localhost` / `http://127.0.0.1` (любой порт)
- Чужой Origin получает «чужой» ACAO (`https://polevka.art`) → браузер блокирует (обход инъекции `*` на стороне YC).
- Дополнительно: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Vary: Origin`.

Env: `ALLOWED_ORIGIN=comma,separated,list` (см. `cloud/api/.env.example`).

### 3.9 Клиент: CSP и SRI

- Content-Security-Policy в `index.html` (`frame-ancestors 'none'`, ограниченный `object-src` и т.д.).
- SRI (`integrity` + `crossorigin`) на:
  - Font Awesome 6.5.1
  - Omnitone 1.3.0
  - React / ReactDOM 18.3.1
- Tailwind Play CDN **без** SRI (не версионируется) — для усиления позже self-host CSS.

### 3.10 Антиспам и rate limit

- Клиент: `spamGuardCheck` на комментарии, сообщения, реакции, публикацию.
- API: лимиты по IP и по login (register / login / sync / presign / patchSound / translate / getMail).

### 3.11 Ошибки API

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

## 5. Что всё ещё не «бронежилет»

Безопасность — процесс. Остаточный риск:

| Риск | Комментарий |
|------|-------------|
| XSS + украденный JWT | JWT в `localStorage`; при XSS злоумышленник действует от имени пользователя |
| Слабый пароль пользователя | Есть min 8, нет 2FA |
| Ключ Maps в Network | Ограничивать HTTP Referer |
| CDN Tailwind без SRI | Self-host / сборка CSS |
| Зависимости npm у API | Регулярный `npm audit` / обновления |
| Человеческий фактор | Утечка env, слабый admin-пароль, ошибочная bucket policy |

Формулировка «нас точно не взломают» некорректна. Корректно: критичные сливы и клиентское повышение привилегий закрыты на production-уровне.

---

## 6. Операционный чеклист

### После каждого деплоя API

```powershell
# health
Invoke-RestMethod -Method POST -Uri $env:YANDEX_FUNCTION_URL `
  -ContentType "application/json" -Body '{"action":"health"}'
# ожидание: ok + version >= 10

# CORS (свой Origin)
# Origin: https://polevka.art → ACAO = https://polevka.art

# CORS (чужой Origin)
# Origin: https://evil.example → ACAO = https://polevka.art (браузер блокирует)

# mail не публичен
# GET https://storage.yandexcloud.net/rosmap2026/mail.json → 403/404

# auth не публичен
# GET …/rosmap2026/_auth/users.json → 403/404
```

### Ротация секретов

1. Сменить `JWT_SECRET` → все сессии инвалидируются (пользователи логинятся заново).
2. Сменить S3 static keys + env функции.
3. Сменить `ADMIN_PASSWORD` (bootstrap); основной пароль админа — через «Сменить пароль» в кабинете.
4. При компрометации Maps-ключа — перевыпуск в кабинете Яндекса + обновление env `YANDEX_MAPS_API_KEY`.

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
| `health` | нет | версия / живость |
| `publicConfig` | нет | Maps key + bucket URL (browser-safe) |
| `register` / `login` | нет | учётка → JWT |
| `me` | JWT | refresh + PII |
| `changePassword` | JWT | смена пароля |
| `getMail` | JWT | проекция почты |
| `sync` / `commit` | JWT | merge + sanitize JSON |
| `presign` | JWT | upload URL |
| `patchSound` | JWT | plays / downloads / реакции |
| `translate` | JWT | Yandex Translate |
| `requestEmailVerification` / `confirmEmailVerification` | JWT | email-коды (SMTP); `emailVerified` только сервером |
| `requestPasswordReset` / `confirmPasswordReset` | нет | сброс пароля (нужен verified email; ответ без утечки существования) |
| `adminDeleteUser` / `adminUnbindEmail` | JWT admin | purge аккаунта / снятие email |

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

---

## 9. Контакты по инцидентам

Подозрение на утечку / взлом:

1. Немедленно ротировать `JWT_SECRET` и S3-ключи.
2. Проверить bucket policy и наличие `mail.json` / `_auth` в public.
3. Просмотреть админ-логи / жалобы / аномальный sync.
4. Связь: чат поддержки в приложении; планируемый email — `support@polevka.art` (см. политику ПДн).
