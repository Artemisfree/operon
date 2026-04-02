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

## Environment

- `API_PORT` - внешний порт backend
- `POSTGRES_DB` - имя базы
- `POSTGRES_USER` - пользователь Postgres
- `POSTGRES_PASSWORD` - пароль Postgres
- `POSTGRES_PORT` - внешний порт Postgres
- `DATABASE_URL` - строка подключения Prisma/Nest к Postgres
- `JWT_SECRET` - секрет для admin-auth

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

### Admin auth

- `POST /api/admin/auth/login`

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

## First Run Check

Минимальный сценарий проверки после запуска:

1. Проверить `health`.
2. Выполнить `prisma:seed`.
3. Сделать login через `POST /api/admin/auth/login`.
4. Создать product через admin endpoint.
5. Создать order через `POST /api/orders`.
6. Перевести order в `confirmed` через `POST /api/orders/:id/status`.

Пример login:

```bash
curl -X POST http://localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@operon.local",
    "password": "admin12345"
  }'
```

## Tests

Integration tests находятся в [app.integration.test.ts](/Users/artemnadtoceev/dev/operon/apps/api/test/app.integration.test.ts).

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
