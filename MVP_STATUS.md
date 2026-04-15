# MVP Status

Дата фиксации: `2026-04-15`

## Итоговый статус

`MVP Ready with Known Limitations`

## Основание для статуса

- основной продуктовый контур реализован: `Website Chat -> Order -> Handoff -> Delivery -> Review`
- backend покрывает chat, handoff, order workflow, delivery, review и admin metrics
- есть три frontend-приложения под MVP-поток: `website-widget`, `admin-web`, `courier-web`
- добавлен пошаговый smoke-runbook: [MVP_SMOKE_CHECKLIST.md](/Users/artemnadtoceev/dev/operon/MVP_SMOKE_CHECKLIST.md)
- зафиксирована матрица приёмки: [MVP_ACCEPTANCE_MATRIX.md](/Users/artemnadtoceev/dev/operon/MVP_ACCEPTANCE_MATRIX.md)

## Блокеры

- явных `P0` блокеров по коду не зафиксировано

## Неблокирующие ограничения

- realtime в чатах и статусах сделан через polling, не через WebSocket
- review request уходит в тот же чат; отдельный канал вроде SMS/email не реализован
- клиентский order reference пока остаётся UUID/его фрагментом, без короткого человекочитаемого номера
- финальный smoke sign-off нужно прогнать в полном локальном окружении; текущий sandbox не позволяет переподтянуть `pnpm` через `corepack` и не подтверждает Docker/network шаги

## Что обязательно проверить перед демо

1. Поднять проект по [README.md](/Users/artemnadtoceev/dev/operon/README.md).
2. Прогнать [MVP_SMOKE_CHECKLIST.md](/Users/artemnadtoceev/dev/operon/MVP_SMOKE_CHECKLIST.md) целиком.
3. Зафиксировать итог по каждому критерию в [MVP_ACCEPTANCE_MATRIX.md](/Users/artemnadtoceev/dev/operon/MVP_ACCEPTANCE_MATRIX.md).

## Post-MVP Backlog

- WebSocket/SSE вместо polling для chat и operator updates
- отдельный канал review request вне чата
- человекочитаемый номер заказа для клиента
- CRUD каталога в `admin-web`
- отдельный e2e automation layer для smoke вместо только ручного runbook
