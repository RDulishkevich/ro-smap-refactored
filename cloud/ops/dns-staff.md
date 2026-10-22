# Staff-панель Полёвки

## Как войти

1. Открой **https://www.polevka.art/staff/**
2. Введи **пароль админки** (не логин/пароль обычного аккаунта на сайте).
3. Готово — сессия только для панели (`aud: staff`).

Пароль на сервере: env `STAFF_PANEL_PASSWORD`. Если не задан — используется `ADMIN_PASSWORD` (тот же bootstrap, что для admin).

Задать отдельный пароль (на машине с `yc`, значение не светить в чат):

```powershell
# пример: перед deploy-api.ps1
$env:STAFF_PANEL_PASSWORD = "…"   # только локально
# или дописать ключ в envMap внутри deploy / yc version create --environment
```

## DNS staff.polevka.art (опционально)

Сейчас достаточно `/staff/` на www. Отдельный поддомен упирается в SSL GitHub Pages (сертификат на www).

Если всё же нужен CNAME: хост `staff` → `rdulishkevich.github.io` (уже может быть в DNS), но HTTPS без своего cert/Cloudflare не заведётся, пока custom domain в Pages — `www`.
