# Настройка почты Полёвки (`@polevka.art`)

Цель: адреса вида `noreply@polevka.art` / `support@polevka.art`, коды подтверждения на **любые** ящики пользователей (Gmail и т.д.), серверы в РФ (152‑ФЗ).

Сайт остаётся на GitHub Pages; меняются только **почтовые** DNS (MX/SPF/DKIM), не A/AAAA/`www`.

---

## Рекомендуемое решение (без Unisender и без Яндекс 360)

**Почта для домена у российского хостера** → обычный SMTP в Secure API.

| Что | Куда |
|-----|------|
| Ящики | `noreply@polevka.art` (коды), `support@polevka.art` (люди) |
| Где купить | **Reg.ru «Почта» Mail-1** (~от 109 ₽/мес) **или** самый дешёвый хостинг **Beget** / **Timeweb** (почта на домене часто **включена** в тариф) |
| Отправка кодов | SMTP хостера → env Cloud Function (`SMTP_*`, `MAIL_FROM`) |
| Unisender Go | Для прод-кодов **не нужен** (бесплатный не шлёт на Gmail; платный вы не берёте) |

Домен `polevka.art` уже на Reg.ru — логично взять **их же Mail-1**: один кабинет, проще DNS.

### Шаги (Reg.ru Почта)

1. Заказать [Почта для домена / Mail-1](https://www.reg.ru/hosting/mail) на `polevka.art`.
2. Создать ящики: `noreply`, `support` (пароли сохранить).
3. В DNS Reg.ru выставить **MX / SPF / DKIM**, как покажет раздел почты (часто мастер сам).
   - **A/AAAA и CNAME `www` не трогать** (сайт GitHub Pages).
   - SPF: одна запись `v=spf1 …`; если остался `include:spf.unisender.ru` — можно убрать, когда Unisender больше не шлёте.
   - NS для `support.polevka.art` (трекинг Unisender) **не мешают** ящику `support@polevka.art` — это разные вещи (поддомен vs локальная часть).
4. SMTP из справки Reg.ru (типично `smtp.reg.ru` или mail-хост из панели; порт 465/587; логин = полный адрес ящика).
5. Env функции:

```
SMTP_HOST=<из панели Reg.ru>
SMTP_PORT=465
SMTP_USER=noreply@polevka.art
SMTP_PASS=<пароль ящика noreply>
MAIL_FROM=Полёвка <noreply@polevka.art>
```

6. Деплой новой version Secure API → проверка: кабинет → «Отправить код» на Gmail.

### Альтернатива: Beget / Timeweb

Минимальный тариф хостинга → раздел «Почта» → ящики на `polevka.art` → в DNS Reg.ru прописать **их** MX/SPF/DKIM. Сайт по-прежнему с GitHub (A-записи не менять на Beget, только почтовые).

---

## Почему не Unisender Go бесплатно

Бесплатный тариф шлёт **только на `@polevka.art`**. Подключение через Yandex Cloud Marketplace это не снимает. Платный Unisender вы не берёте → для кодов на Gmail нужен **свой SMTP ящика** (см. выше).

DNS Unisender (SPF/DKIM/validate), которые уже добавлены, можно позже упростить под почту Reg.ru/Beget, чтобы не плодить лишние TXT.

---

## Пока почта не куплена

SMTP в API пустой → toast «отправка писем пока не настроена». Чат поддержки в приложении работает. Константа `SUPPORT_PUBLIC_EMAIL` уже `support@polevka.art`.

---

## Проверка

1. Письмо на `support@polevka.art` доходит во веб-почту хостера.
2. Код из кабинета приходит на личный Gmail с From `noreply@polevka.art`.
3. `health` API ок; в логах функции нет `mail_send_failed`.

---

## Вне объёма

Массовые рассылки, сброс пароля по email — после рабочего SMTP.
