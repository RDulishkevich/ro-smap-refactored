# Stage 1 ops — production hardening checklist

## Bucket layout

| Bucket | Public read | Contents |
|--------|-------------|----------|
| `rosmap2026` | yes (catalog/media) | `map_data.json`, `profiles.json`, `feed.json`, `events.json`, `uploads/`, `backups/` — **не** `mail.json` |
| `rosmap2026-private` | **no** | `_auth/users.json`, `_auth/private_meta.json`, `mail.json`, `staging/{login}/…`, `_auth/backups/…` |

API env must include `PRIVATE_BUCKET=rosmap2026-private` and `YANDEX_MAPS_API_KEY` (browser Maps key, HTTP Referer lock; выдаётся только через `action=publicConfig`).

Sensitive objects must never live in the public bucket. Apply `bucket-deny-sensitive.json` so anonymous GetObject on `mail.json` is denied even if a stale object reappears.

Migrate / scrub mail once after API v7:

```powershell
node cloud/ops/migrate-mail-private.cjs
```

## CORS on private bucket (required for sync)

Browser uploads large JSON via **presigned PUT** into `staging/…`. Without CORS the page shows «Синхронизация с облаком не удалась».

```powershell
yc storage bucket update --name rosmap2026-private `
  --cors "allowed-methods=[method-put,method-get,method-head],allowed-origins=[*],allowed-headers=[*],max-age-seconds=3600"
```

Verify:

```powershell
# should return Access-Control-Allow-Origin
curl.exe -i -X OPTIONS "https://storage.yandexcloud.net/rosmap2026-private/staging/x" `
  -H "Origin: https://rdulishkevich.github.io" `
  -H "Access-Control-Request-Method: PUT"
```

## Backups

```powershell
pwsh cloud/ops/backup-json.ps1
```

Copies catalog JSON to local `cloud/backups/` and mirrors to:

`s3://rosmap2026/backups/YYYY-MM-dd_HHmm/`

Auth mirror (private):

`s3://rosmap2026-private/_auth/backups/YYYY-MM-dd_HHmm/users.json`

Schedule daily via Task Scheduler when ready.

### Windows Task Scheduler (daily 03:00)

1. Action: `Start a program`
2. Program: `powershell.exe`
3. Arguments:
   `-NoProfile -ExecutionPolicy Bypass -File "G:\Мой диплом\App\cloud\ops\backup-json.ps1"`
4. Start in: `G:\Мой диплом\App`
5. Trigger: Daily at 03:00

Needs `cloud/api/.env` with S3 keys for the cloud mirror; otherwise only local `cloud/backups/` is written.

## Admin password

In the app: **Личный кабинет → Сменить пароль**.

Do not paste the new password into chat. After you change it in-app, the bootstrap `ADMIN_PASSWORD` in function env is only a fallback for first admin bootstrap — rotate/remove when convenient.

## Smoke checklist

- [ ] API `health` → ok (`version: 7`)
- [ ] `publicConfig` returns Maps key length > 0 (key not in frontend source)
- [ ] `https://storage.yandexcloud.net/rosmap2026/mail.json` → 403/404
- [ ] Register new user
- [ ] Login (admin + normal user)
- [ ] Publish sound (audio lands in `uploads/…`, not data-URL in JSON)
- [ ] Pending/deleted sound disappears from map
- [ ] Message send + mark read sticks after refresh
- [ ] Support chat opens from Settings → Помощь
- [ ] Admin Support tab shows unread count
- [ ] Search empty state + filter pills work on mobile
- [ ] Hard refresh — data still there
- [ ] `https://storage.yandexcloud.net/rosmap2026/_auth/users.json` → 404/403
- [ ] Private auth not reachable without keys

## Stage 2 migration

```powershell
node cloud/ops/split-profiles-mail.mjs --dry-run
node cloud/ops/split-profiles-mail.mjs
```

Then redeploy API (`cloud/api`) and hard-refresh the site.
