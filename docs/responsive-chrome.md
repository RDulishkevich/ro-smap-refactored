# Архитектура интерфейса: ПК и мобильная версия

Канон: **React** в `apps/web`. Breakpoint: **desktop ≥ 768px**, **mobile < 768px** (`useIsDesktop`).

Связано: [`ux-ui-guide.md`](ux-ui-guide.md), [`DESIGN.md`](../DESIGN.md), `.cursor/rules/ux-ui.mdc`.

## Принцип

Один код, две раскладки. Экраны стека общие; точки входа разные.

| Слой | Desktop | Mobile |
|------|---------|--------|
| Навигация | Рейка 72px | 3 вкладки: Лента / Карта / Профиль |
| Аккаунт | Рейка (профиль, выход, настройки) | Вкладка Профиль |
| События | Иконка рейки → stack `events` | Иконка на карте → stack |
| Каталог / лента / экспедиции | Панель 380px | Подвкладки ленты |
| Карта | Весь холст справа от рейки | Вкладка Карта + FAB |

Не показывать телефон 390×844 на проде.

## Mobile

```
[ search / events on map ]
        MAP
   (FAB + record / add)
[  Лента  |  Карта  |  Профиль  ]
```

FAB только на карте (вырез 36px). Сообщения и колокол — в шапке ленты и в профиле.

## Desktop

```
[rail] [optional panel] [ MAP ]
 lib                    [events overlay]
 feed
 exp
 help / staff
 profile
```

## Legacy vanilla

`#app-rail` / `#mobile-bottom-nav` в корневом `index.html` ещё живы. Не развивать; паритет строится в `apps/web`.
