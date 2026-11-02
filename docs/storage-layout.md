# Object Storage layout (Полёвка)

Целевая раскладка бакетов и opaque ID. Миграция — dual-read без даунтайма.

Связано: [`docs/security.md`](security.md), skill `polevka-storage-ids`, Secure API `cloud/api`.

## Бакеты

| Бакет | Доступ | Назначение |
|-------|--------|------------|
| `BUCKET` (public) | чтение публичное | каталог-кэш, медиа |
| `PRIVATE_BUCKET` | только API | auth, mail, PII, staging, HMAC `.sig` |

## Ключи (цель)

### Private

| Ключ | Содержимое |
|------|------------|
| `auth/users/{userId}.json` | credentials, oauth subjects, tokenVersion (login не в пути) |
| `auth/login-index/{login}.json` | `{ userId }` |
| `auth/email-index/{sha256(email)}.json` | `{ userId }` |
| `_auth/users.json` | **legacy** монолит (dual-read до cutover) |
| `_auth/private_meta.json` | **legacy** PII по login |
| `meta/{userId}.json` | PII (email flags) |
| `_mail/boxes/{login\|userId}.json` | почта (dual-read) |
| `staging/{login}/…` | крупные sync JSON |

### Public

| Ключ | Содержимое |
|------|------------|
| `map_data.json` / `catalog/sounds.json` | кэш каталога (+ YDB SoT) |
| `profiles.json`, `feed.json`, `events.json` | кэш |
| `media/sounds/{soundId}/…` | audio / photos звука |
| `media/avatars/{userId}/…` | аватары |
| `uploads/{login}/…` | **legacy** медиа (ещё пишутся до cutover media/) |

## Opaque ID

| Префикс | Сущность |
|---------|----------|
| `usr_` | пользователь |
| `snd_` | звук |
| `exp_` | экспедиция / session |
| `evt_` | ивент |
| `pst_` | пост ленты |

Генерация: ULID-подобные `prefix + base32(time+random)` в `cloud/api/ids.js` / `@polevka/core`.

Логин — human-handle, **не** ключ файла и не единственный идентификатор в JWT навсегда (в токене пока `login`, рядом пишется `uid` когда есть).

## Правила

1. PII и credentials никогда не класть рядом с публичными wav.
2. Presign: только whitelist префиксов (`media/`, `uploads/`, `staging/`).
3. Новые объекты — opaque ID; legacy paths читаются, пока migrate-скрипт не перенесёт.
4. Один verified email → один `userId`; один login → один `userId`.
5. Backfill: `ensureUserId` на login/OAuth; ops helper `cloud/ops/migrate-user-ids.cjs`.

## Staff host

- UI: `apps/web/staff.html` → `StaffApp` (сборка: `dist/staff/index.html` → Pages `/staff/`).
- **Сейчас:** https://www.polevka.art/staff/ (без отдельного DNS).
- **Опционально:** DNS CNAME `staff` → `rdulishkevich.github.io`, затем в GitHub Pages → Custom domain добавить `staff.polevka.art` (CORS уже готов).
- Вход: `staffLogin` → JWT `aud: staff`. Обычный user JWT на admin-actions отклоняется.
