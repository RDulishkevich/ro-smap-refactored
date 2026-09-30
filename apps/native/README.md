# Полёвка native (Expo)

Каркас под iOS/Android. Общая логика: `@polevka/core`. Токены: `@polevka/design`. Веб: `apps/web`.

Пока **не** ставим Expo в корневой `npm install` (тяжёлый tarball, Windows workspaces). Когда будете собирать сторы:

```bash
cd apps/native
npx create-expo-app . --template blank-typescript
# или: npx expo install expo expo-av expo-status-bar react-native
npx expo start
```

Карта: `react-native-maps` / MapLibre Native. Аудио: `expo-av`. Не встраивать Яндекс.Карты JS в WebView как «приложение».

IA та же: Лента / Карта / Профиль. `App.tsx` — заставка с токенами, не feature-complete.
