# Полёвка

Публичный сайт: **React-клиент** (`apps/web`). Сборка `npm run build` → `apps/web/dist`, на GitHub Pages выкладывается в корень репозитория (`index.html` + `assets/`). Vanilla — архив в `archive/vanilla/` и `src/`.

## Возможности
- карта с маркерами звуков (Yandex 2.1, OSM fallback)
- UCS-фильтры, плеер, публикация WAV, профили, экспедиции, модерация
- облачная синхронизация через Yandex Object Storage + Secure API

## Безопасность и база данных

С версии Secure API запись в облако идёт **только с сессией** (HttpOnly cookies + короткий access JWT):

| Было | Стало |
|------|--------|
| Пароли в `localStorage` plaintext | scrypt-хеши в `_auth/users.json` |
| Админ-пароль в клиентском JS | `ADMIN_PASSWORD` в env Cloud Function |
| Ключ Яндекс.Карт в `index.html` | `YANDEX_MAPS_API_KEY` в env + `action=publicConfig` |
| Публичный `mail.json` | private bucket + Deny anonymous GetObject |
| Анонимный presign → overwrite JSON | `action=sync` + проверка прав на сервере |
| Роль `admin` из DevTools | роль сверяется с `_auth`/`profiles` на каждом запросе |
| Аудио/фото как data-URL / blob в JSON | файлы в `uploads/{login}/…`, в JSON только https |
| Всё в одном `profiles.json` | визитки + отдельный private `mail.json` + `_auth/private_meta.json` |
| JWT в `localStorage` на 14 дней | HttpOnly cookies, access 30м / refresh 14д, `tokenVersion` |
| Tailwind Play CDN (`unsafe-eval`) | self-host `src/tailwind.built.css`, CSP без `unsafe-eval` |

Полная инструкция деплоя: [`cloud/api/README.md`](cloud/api/README.md).  
Полный разбор безопасности: [`docs/security.md`](docs/security.md) (v13+).

### Быстрый чеклист деплоя
1. Создать статический ключ SA с `storage.editor` на бакет `rosmap2026`
2. Задать env функции: `JWT_SECRET`, `ADMIN_PASSWORD`, ключи S3, `BUCKET`
3. Задеплоить `cloud/api` (Node 18+, entrypoint `index.handler`)
4. Собрать фронт `npm run build` и выложить **только** `apps/web/dist` (error document = `index.html` или `404.html`)
5. Войти как `admin` с паролем из `ADMIN_PASSWORD`

Пока Secure API не задеплоен, вход/сохранение покажут ошибку настройки — это ожидаемо.

## Запуск фронтенда

```
npm install
npm run dev
```

http://localhost:5173 — ПК: карта + рейка; мобилка: Лента / Карта / Профиль. Исходники: `apps/web`, ядро `packages/core`, токены `packages/design`. Сборка продакшена: `npm run build` → `apps/web/dist`.

Vanilla — `archive/vanilla/` и `src/`, на домен не выкладывается.

Нативный каркас Expo: `apps/native/README.md` (ставится отдельно, не из корня).

