# Настройка почты Полёвки (`@polevka.art`)

Цель: адреса вида `noreply@polevka.art` / `support@polevka.art`, коды на **любые** ящики пользователей (Gmail и т.д.), серверы в РФ (152‑ФЗ).

Сайт остаётся на GitHub Pages; меняются только **почтовые** DNS (MX/SPF/DKIM), не A/AAAA/`www`.

---

## Текущий прод-путь

**Reg.ru Mail-1** → SMTP в Secure API.

| Что | Значение |
|-----|----------|
| Ящики | `noreply@polevka.art` (коды), `support@polevka.art` (люди) |
| SMTP | `mail.hosting.reg.ru:465` (или из панели Reg.ru) |
| Env | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` |
| Шаблоны | `cloud/api/mailTemplates.js` (подтверждение email + сброс пароля) |
| Скрипт env | `cloud/ops/set-regru-smtp.ps1` (пароль запрашивается локально; **не** коммитить) |

### Какие письма шлёт API

| Действие | Auth | Условие |
|----------|------|---------|
| `requestEmailVerification` | JWT | код на новый/неподтверждённый email; если уже verified — `alreadyVerified` без письма |
| `confirmEmailVerification` | JWT | хеш кода → `emailVerified` только на сервере |
| `requestPasswordReset` | нет | логин или email; письмо **только** если email **подтверждён**; ответ всегда нейтральный |
| `confirmPasswordReset` | нет | код + новый пароль |

Коды хранятся как хеш в private bucket (`_auth/email_codes/`, `_auth/password_resets/`), TTL короткий. Клиент не доверяет `emailVerified` при sync.

### Деплой функции (обязательно включать шаблоны)

```powershell
cd cloud/api
npm install --omit=dev
# zip: index.js + mailTemplates.js + package.json + node_modules
```

Скрипты `set-regru-smtp.ps1` / `set-unisender-smtp.ps1` уже кладут `mailTemplates.js` в архив.

### Проверка

1. Письмо на `support@polevka.art` доходит во веб-почту хостера.
2. Код из кабинета приходит на Gmail с From `noreply@polevka.art`.
3. «Забыли пароль?» на экране входа → код приходит (нужен verified email).
4. `health` → `version` ≥ 10; в логах нет `mail_send_failed`.

---

## DNS (кратко)

- MX Reg.ru (`mxs1` / `mxs2` или как в панели).
- SPF/DKIM для Reg.ru; A/AAAA/`www` не трогать (GitHub Pages).
- Старые TXT Unisender можно убрать, когда Unisender больше не используется.

---

## Почему не зарубежные ESP / не бесплатный Unisender

- Brevo и зарубежные ESP — риск для 152‑ФЗ при ПДн.
- Бесплатный Unisender Go не шлёт на Gmail → для прод-кодов нужен свой SMTP ящика в РФ.

---

## Вне объёма

Массовые рассылки, маркетинг-письма, дайджесты.
