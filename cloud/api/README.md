# RO.SMap Secure API (Yandex Cloud Functions)

Серверная точка входа для авторизации и записи в Object Storage.
Клиент больше не может анонимно перезаписывать `map_data.json` / `profiles.json` / `feed.json`.

## Что делает API

| action | Auth | Назначение |
|--------|------|------------|
| `health` | нет | проверка живости |
| `register` | нет | регистрация (пароль → scrypt) |
| `login` | нет | вход → JWT |
| `me` | JWT | проверка сессии / refresh |
| `changePassword` | JWT | смена пароля |
| `sync` | JWT | GET→merge→sanitize→PUT JSON |
| `presign` | JWT | presigned PUT только для `uploads/{login}/...` |

Хеши паролей хранятся в бакете в ключе `_auth/users.json` (сделайте объект **private**).

## Переменные окружения функции

```
BUCKET=rosmap2026
STORAGE_ENDPOINT=https://storage.yandexcloud.net
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
JWT_SECRET=<длинная случайная строка>
ADMIN_PASSWORD=<пароль админа, НЕ хранить в клиенте>
ALLOWED_ORIGIN=*
```

## Деплой (консоль или CLI)

1. Создайте статический ключ доступа сервисного аккаунта с ролями:
   - `storage.editor` на бакет `rosmap2026`
2. В бакете ограничьте публичную запись (публичное чтение JSON можно оставить).
3. Загрузите объект `_auth/users.json` как **private** (после первого логина админа файл создастся сам).
4. Упакуйте функцию:

```bash
cd cloud/api
npm install --omit=dev
zip -r ../rosmap-api.zip index.js package.json node_modules
```

5. В Yandex Cloud Functions создайте/обновите функцию (Node.js 18+):
   - entrypoint: `index.handler`
   - timeout: 10–30s
   - memory: 256–512 MB
   - добавьте env из списка выше
6. Подключите HTTPS-триггер (API Gateway или invoke URL).
7. В клиенте `src/core/state.js` укажите URL функции в `YANDEX_FUNCTION_URL`.

## Миграция пользователей

Старые аккаунты жили только в `localStorage`. При первом входе клиент:
1. пробует `login` в облаке;
2. если `no_user`, но пароль совпал локально — вызывает `register` и входит снова.

Админ: логин `admin` + `ADMIN_PASSWORD` из env функции.

## Важно

После деплоя **анонимный** `{ fileName, contentType }` больше не выдаёт upload URL.
Старый клиент без JWT писать в базу не сможет — это ожидаемо.
