# DNS для staff.polevka.art (опционально)

Сейчас админка живёт на **https://www.polevka.art/staff/** — отдельный поддомен не обязателен.

Чтобы включить `https://staff.polevka.art/`:

1. В DNS домена `polevka.art` (Reg.ru / где A/CNAME для www):
   - тип **CNAME**
   - хост: `staff`
   - значение: `rdulishkevich.github.io`
   - TTL: 3600 или Auto
2. GitHub → repo → Settings → Pages → Custom domain → добавить `staff.polevka.art` (рядом с www).
3. Дождаться зелёного DNS check + HTTPS.
4. Проверка: `Resolve-DnsName staff.polevka.art -Type CNAME` → `rdulishkevich.github.io`.

Не трогать A/AAAA apex и CNAME `www` — только новая запись `staff`.
