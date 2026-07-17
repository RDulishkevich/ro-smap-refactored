# Audio Map App (RO.SMap)

Веб-приложение — аудиокарта Ростовской области.

## Возможности
- карта с маркерами звуков
- поиск и фильтрация
- плеер, детали, кабинет, сообщения, экспедиции
- облачная синхронизация через Yandex Object Storage

## Безопасность и база данных

С версии Secure API запись в облако идёт **только с JWT**:

| Было | Стало |
|------|--------|
| Пароли в `localStorage` plaintext | scrypt-хеши в `_auth/users.json` |
| Админ-пароль в клиентском JS | `ADMIN_PASSWORD` в env Cloud Function |
| Анонимный presign → overwrite JSON | `action=sync` + проверка прав на сервере |
| Роль `admin` из DevTools | роль в JWT, сервер отбрасывает подделки |

Полная инструкция деплоя: [`cloud/api/README.md`](cloud/api/README.md).

### Быстрый чеклист деплоя
1. Создать статический ключ SA с `storage.editor` на бакет `rosmap2026`
2. Задать env функции: `JWT_SECRET`, `ADMIN_PASSWORD`, ключи S3, `BUCKET`
3. Задеплоить `cloud/api` (Node 18+, entrypoint `index.handler`)
4. Убедиться, что `YANDEX_FUNCTION_URL` в `src/core/state.js` указывает на эту функцию
5. Войти как `admin` с паролем из `ADMIN_PASSWORD`

Пока Secure API не задеплоен, вход/сохранение покажут ошибку настройки — это ожидаемо.

## Запуск фронтенда
Откройте `index.html` или статический сервер из корня репозитория.
