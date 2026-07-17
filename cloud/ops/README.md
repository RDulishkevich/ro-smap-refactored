# Stage 1 ops — production hardening checklist

## Bucket layout

| Bucket | Public read | Contents |
|--------|-------------|----------|
| `rosmap2026` | yes (catalog/media) | `map_data.json`, `profiles.json`, `feed.json`, `uploads/`, `backups/` |
| `rosmap2026-private` | **no** | `_auth/users.json`, `staging/{login}/…`, `_auth/backups/…` |

API env must include `PRIVATE_BUCKET=rosmap2026-private`.

Sensitive objects must never live in the public bucket.

## Backups

```powershell
pwsh cloud/ops/backup-json.ps1
```

Copies catalog JSON to local `cloud/backups/` and mirrors to:

`s3://rosmap2026/backups/YYYY-MM-dd_HHmm/`

Auth mirror (private):

`s3://rosmap2026-private/_auth/backups/YYYY-MM-dd_HHmm/users.json`

Schedule daily via Task Scheduler when ready.

## Admin password

In the app: **Личный кабинет → Сменить пароль**.

Do not paste the new password into chat. After you change it in-app, the bootstrap `ADMIN_PASSWORD` in function env is only a fallback for first admin bootstrap — rotate/remove when convenient.

## Smoke checklist

- [ ] API `health` → ok
- [ ] Register new user
- [ ] Login (admin + normal user)
- [ ] Publish / edit sound
- [ ] Message send
- [ ] Hard refresh — data still there
- [ ] `https://storage.yandexcloud.net/rosmap2026/_auth/users.json` → 404/403
- [ ] Private auth not reachable without keys
