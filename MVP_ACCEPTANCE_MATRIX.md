# MVP Acceptance Matrix

Статусы:
- `done` — реализовано и подтверждается кодом/тестами/инструкцией
- `partial` — реализовано, но нужен повторный полный smoke в живом окружении
- `blocked` — не реализовано или есть блокирующая зависимость

| Критерий | Способ проверки | Статус | Подтверждение |
| --- | --- | --- | --- |
| 1. Клиент оформляет заказ через website chat | `POST /api/chat/message`, ручной smoke в widget | `done` | [chat-admin controller](/Users/artemnadtoceev/dev/operon/apps/api/src/modules/chat/chat-admin.controller.ts), [widget app](/Users/artemnadtoceev/dev/operon/apps/website-widget/src/App.tsx), [API integration tests](/Users/artemnadtoceev/dev/operon/apps/api/test/app.integration.test.ts) |
| 2. AI использует tools и не выдумывает каталог | tool-calling + guardrails на backend, smoke в `AI_PROVIDER=openai` | `done` | [chat tool service](/Users/artemnadtoceev/dev/operon/apps/api/src/modules/chat/chat.tool-service.ts), [OpenAI runtime](/Users/artemnadtoceev/dev/operon/apps/api/src/modules/chat/llm/openai-llm.service.ts), [README.md](/Users/artemnadtoceev/dev/operon/README.md) |
| 3. Оператор перехватывает чат одной кнопкой | `POST /api/admin/conversations/:id/handoff/start`, ручной smoke в `admin-web` | `done` | [chat admin controller](/Users/artemnadtoceev/dev/operon/apps/api/src/modules/chat/chat-admin.controller.ts), [admin app](/Users/artemnadtoceev/dev/operon/apps/admin-web/src/App.tsx), [API integration tests](/Users/artemnadtoceev/dev/operon/apps/api/test/app.integration.test.ts) |
| 4. Диспетчер назначает курьера | `POST /api/delivery/assign`, ручной smoke в `OrdersView` | `done` | [delivery controller](/Users/artemnadtoceev/dev/operon/apps/api/src/modules/delivery/delivery.controller.ts), [delivery service](/Users/artemnadtoceev/dev/operon/apps/api/src/modules/delivery/delivery.service.ts), [orders view](/Users/artemnadtoceev/dev/operon/apps/admin-web/src/OrdersView.tsx) |
| 5. Курьер закрывает доставку | `POST /api/delivery/:id/status`, proof photo и `delivered` в `courier-web` | `done` | [delivery service](/Users/artemnadtoceev/dev/operon/apps/api/src/modules/delivery/delivery.service.ts), [courier app](/Users/artemnadtoceev/dev/operon/apps/courier-web/src/App.tsx), [delivery integration tests](/Users/artemnadtoceev/dev/operon/apps/api/test/delivery.integration.test.ts) |
| 6. Через 5–10 минут после `delivered` создаётся или отправляется review request | `POST /api/review/schedule`, cron `EVERY_MINUTE`, `POST /api/review/send` | `done` | [review service](/Users/artemnadtoceev/dev/operon/apps/api/src/modules/review/review.service.ts), [metrics view](/Users/artemnadtoceev/dev/operon/apps/admin-web/src/MetricsView.tsx), [review integration tests](/Users/artemnadtoceev/dev/operon/apps/api/test/review.integration.test.ts) |
| 7. Сквозной сценарий проходит стабильно | полный ручной smoke по [MVP_SMOKE_CHECKLIST.md](/Users/artemnadtoceev/dev/operon/MVP_SMOKE_CHECKLIST.md) | `partial` | кодовые части и отдельные integration tests есть, но полный прогон из текущего sandbox не подтверждён из-за ограничений на Docker/network |

## Partial / Blocked Notes

- `partial` по критерию 7 не означает продуктовый блокер в коде. Это означает, что финальный sign-off должен быть сделан повторным прогоном smoke в живом локальном окружении по чеклисту.
- Текущий sandbox не дал повторно подтянуть `pnpm` через `corepack`, потому что доступ к `registry.npmjs.org` недоступен. Поэтому таблица разделяет реализованный функционал и заново неповторённую операционную проверку.
