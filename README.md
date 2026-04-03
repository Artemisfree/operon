# operon

Backend и Postgres в локальной разработке должны подниматься через Docker.

## Prerequisites

- Docker
- Docker Compose

## Quick Start

1. Скопировать env-шаблон:

```bash
cp .env.example .env
```

2. Поднять сервисы:

```bash
docker compose up --build -d
```

3. При старте `api` контейнер:
   - устанавливает зависимости,
   - генерирует Prisma Client,
   - применяет миграции,
   - запускает backend в watch-режиме.

4. Проверить, что backend отвечает:

```bash
curl http://localhost:3000/api/health
```

Ожидаемый ответ:

```json
{
  "status": "ok",
  "service": "operon-api",
  "database": "up"
}
```

5. При необходимости загрузить demo data:

```bash
docker compose exec api pnpm --filter @operon/api prisma:seed
```

6. Прогнать integration tests:

```bash
docker compose exec -T api pnpm --filter @operon/api test
```

## Local Dev

- API base URL: `http://localhost:3000/api`
- Healthcheck: `GET /api/health`
- Postgres host from Docker network: `postgres:5432`
- Postgres host from local machine: `localhost:5432`
- Widget dev URL: `http://localhost:3001`
- Admin dev URL: `http://localhost:3002`

## Frontend Apps

- [website-widget](/Users/artemnadtoceev/dev/operon/apps/website-widget) - клиентский чат-виджет
- [admin-web](/Users/artemnadtoceev/dev/operon/apps/admin-web) - операторская панель

Локальный запуск:

```bash
docker compose up -d
docker compose exec api pnpm --filter @operon/website-widget dev
docker compose exec api pnpm --filter @operon/admin-web dev
```

Если нужен явный backend URL для Vite:

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

## Environment

- `API_PORT` - внешний порт backend
- `POSTGRES_DB` - имя базы
- `POSTGRES_USER` - пользователь Postgres
- `POSTGRES_PASSWORD` - пароль Postgres
- `POSTGRES_PORT` - внешний порт Postgres
- `DATABASE_URL` - строка подключения Prisma/Nest к Postgres
- `JWT_SECRET` - секрет для admin-auth
- `AI_PROVIDER` - `openai` для реального LLM или `mock` для тестов/локальной отладки
- `OPENAI_API_KEY` - ключ OpenAI API
- `OPENAI_MODEL` - модель OpenAI для chat orchestration

## Migrations

- Prisma schema: [apps/api/prisma/schema.prisma](/Users/artemnadtoceev/dev/operon/apps/api/prisma/schema.prisma)
- Initial migration: [apps/api/prisma/migrations/20260402120000_init/migration.sql](/Users/artemnadtoceev/dev/operon/apps/api/prisma/migrations/20260402120000_init/migration.sql)

Применить миграции вручную внутри контейнера:

```bash
docker compose exec api pnpm --filter @operon/api prisma:migrate:deploy
```

Перегенерировать Prisma Client:

```bash
docker compose exec api pnpm --filter @operon/api prisma:generate
```

## Seed Data

Сид создаёт:

- admin user: `admin@operon.local`
- пароль: `admin12345`
- 5 демо-товаров

Файл сида: [seed.ts](/Users/artemnadtoceev/dev/operon/apps/api/prisma/seed.ts)

Повторный запуск:

```bash
docker compose exec api pnpm --filter @operon/api prisma:seed
```

## API Surface

### Public

- `GET /api/health`
- `POST /api/orders`
- `POST /api/chat/message`
- `GET /api/chat/conversations/:id/messages`

### Admin auth

- `POST /api/admin/auth/login`

### Admin conversations / operator panel

- `GET /api/admin/conversations`
- `GET /api/admin/conversations/:id`
- `POST /api/admin/conversations/:id/messages`
- `POST /api/admin/conversations/:id/handoff/start`
- `POST /api/admin/conversations/:id/handoff/stop`

### Admin products

- `POST /api/products`
- `GET /api/products`
- `GET /api/products/:id`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`

### Admin orders

- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders/:id/status`

Статусный workflow заказа:

- `pending -> confirmed | cancelled`
- `confirmed -> preparing | cancelled`
- `preparing -> ready_for_dispatch | cancelled`
- `ready_for_dispatch -> on_the_way | cancelled`
- `on_the_way -> delivered | cancelled`

## AI Core

`Phase B` добавляет:

- OpenAI integration layer через `AI_PROVIDER=openai`
- mock LLM для integration tests и локального детерминированного прогона
- `POST /api/chat/message` с AI orchestrator
- tool execution для:
  - `find_product`
  - `create_order`
  - `get_order_status`
  - `start_handoff`
- `append_operator_note`
- лог AI-действий в `ai_action_logs`
- хранение `conversations` и `messages`

`Phase C` backend slice добавляет:

- polling endpoint для widget: `GET /api/chat/conversations/:id/messages`
- список и карточку диалогов для operator/admin
- ручной handoff через admin endpoints
- operator reply endpoint
- отключение AI-ответов во время handoff
- возврат управления AI после handoff stop

`Phase C` frontend slice добавляет:

- `website-widget` на React/Vite с:
  - composer
  - polling истории сообщений
  - баннером handoff state
  - отображением operator messages
- `admin-web` на React/Vite с:
  - login form
  - списком диалогов
  - карточкой диалога
  - ручным handoff
  - ручным ответом оператора

Для реального OpenAI-режима нужно заполнить `OPENAI_API_KEY` в `.env`.

Для локальной отладки без внешнего LLM можно использовать:

```env
AI_PROVIDER=mock
```

Параметры OpenAI runtime:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`
- `OPENAI_TIMEOUT_SECONDS`

Статус smoke-проверки real OpenAI mode на `2026-04-03`:

- `api` успешно стартует с `AI_PROVIDER=openai`
- реальный запрос в `POST /api/chat/message` проходит
- OpenAI вызывает `find_product` через tool-calling
- guardrail на подтверждение заказа соблюдается
- двухшаговый сценарий `message -> confirmation -> create_order` проходит
- backend использует deterministic confirmation path, чтобы после явного подтверждения не зависеть от лишнего повторного вопроса со стороны модели

## First Run Check

Минимальный сценарий проверки после запуска:

1. Проверить `health`.
2. Выполнить `prisma:seed`.
3. Сделать login через `POST /api/admin/auth/login`.
4. Создать product через admin endpoint.
5. Создать order через `POST /api/orders`.
6. Перевести order в `confirmed` через `POST /api/orders/:id/status`.
7. Проверить chat flow через `POST /api/chat/message`.
8. Проверить handoff flow через admin conversation endpoints.

Пример login:

```bash
curl -X POST http://localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@operon.local",
    "password": "admin12345"
  }'
```

Пример chat message:

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Хочу заказать 2 Капучино 300 мл. Телефон: +79990000000. Адрес: Москва, Тверская 1. Подтверждаю заказ.",
    "customer_meta": {
      "name": "Иван"
    }
  }'
```

Пример polling запроса для widget:

```bash
curl http://localhost:3000/api/chat/conversations/<conversation_id>/messages
```

## Tests

Integration tests находятся в [app.integration.test.ts](/Users/artemnadtoceev/dev/operon/apps/api/test/app.integration.test.ts).

Покрыто тестами:

- создание заказа через `orders` API
- смена статуса заказа
- запрет невалидного перехода статуса
- защита admin endpoints
- CRUD `products`
- создание заказа через `POST /api/chat/message`
- regression: AI не создаёт заказ без обязательных полей
- двухшаговое подтверждение заказа в чате
- polling-style получение истории сообщений
- operator handoff: AI перестаёт отвечать, оператор может ответить вручную, затем чат возвращается AI
- frontend utility tests:
  - `website-widget`: нормализация API base URL
  - `admin-web`: стабильный storage key для auth token

Дополнительно проверено:

- `website-widget` typecheck проходит
- `admin-web` typecheck проходит
- `website-widget` production build проходит
- `admin-web` production build проходит

Запуск внутри контейнера:

```bash
docker compose exec api pnpm --filter @operon/api test
```

## Docker Operations

Посмотреть статус контейнеров:

```bash
docker compose ps
```

Посмотреть логи API:

```bash
docker compose logs api --tail=200
```

Остановить сервисы:

```bash
docker compose down
```

Пересобрать и поднять заново:

```bash
docker compose down
docker compose up --build -d
```
