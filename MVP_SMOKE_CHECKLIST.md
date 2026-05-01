# MVP Smoke Checklist

## Цель
Прогнать основной MVP-сценарий без SQL-правок:
`Website Chat -> Order -> Handoff -> Delivery -> Review`

## Preconditions

- подняты `postgres` и `api`: `docker compose up --build -d`
- загружены demo-данные: `docker compose exec api pnpm --filter @operon/api prisma:seed`
- backend healthcheck отвечает: `GET http://localhost:3000/api/health`
- для локального UI подняты:
  - widget: `http://localhost:3001`
  - admin: `http://localhost:3002`
  - courier: `http://localhost:3003`
- demo credentials:
  - admin: `admin@operon.local` / `admin12345`
  - courier token: `courier-dev-token`
- рекомендуемый dev-режим для smoke без внешней сети: `AI_PROVIDER=mock`
- для проверки real LLM отдельно нужен `AI_PROVIDER=openai` и валидный `OPENAI_API_KEY`

## Ожидаемые Артефакты

- скриншоты или короткая запись каждого UI-шага
- `conversation_id`, `order_id`, `delivery_job_id`
- итоговая пометка о статусе smoke: `pass` или `fail`

## Шаги

| Step | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| 1 | Открыть `website-widget` на `http://localhost:3001` | UI загружается без ошибок | экран widget |
| 2 | Отправить сообщение с товаром, телефоном, адресом и подтверждением заказа | AI отвечает, использует каталог, создаёт заказ | сообщение assistant, новый `conversation_id` |
| 3 | Обновить историю диалога polling-ом `GET /api/chat/conversations/:id/messages` | история содержит user/assistant сообщения, `handoff_state=ai` | ответ API |
| 4 | Открыть `admin-web`, войти под `admin@operon.local` | login проходит, видны диалоги | экран admin |
| 5 | Открыть нужный диалог | видна карточка чата и история сообщений | экран диалога |
| 6 | Нажать `Перехватить чат` | `handoff_state` меняется на `operator`, AI перестаёт отвечать | баннер widget, badge в admin |
| 7 | Отправить ответ оператора | сообщение появляется в admin и widget | сообщение `operator` |
| 8 | Нажать `Вернуть AI` | чат возвращается в режим `ai` | badge/баннер меняется обратно |
| 9 | Перейти в `Заказы` в `admin-web` | созданный заказ отображается в списке | карточка заказа |
| 10 | Довести заказ до `ready_for_dispatch` через кнопки workflow | история статусов фиксирует переходы | order history |
| 11 | Назначить демо-курьера | создаётся доставка, заказ уходит в `on_the_way` | блок доставки в admin |
| 12 | Открыть `courier-web`, ввести `courier-dev-token` | токен принимается, список доставок загружается | экран courier |
| 13 | Убедиться, что заказ виден в списке доставок | есть адрес, телефон, статус `В пути` | карточка доставки |
| 14 | Загрузить proof photo | у job появляется признак `Фото: прикреплено` | courier UI |
| 15 | Нажать `Доставлено` | заказ переходит в `delivered`, доставка закрывается | courier/admin UI |
| 16 | Дождаться `REVIEW_DELAY_MINUTES` или вызвать `POST /api/review/send` под admin JWT | создаётся и обрабатывается review request | ответ API + сообщение в чате |
| 17 | Открыть `Метрики` в `admin-web` | видны total orders, delivered %, handoff %, review sent | экран metrics |

## Быстрые API-проверки

### 1. Healthcheck

```bash
curl http://localhost:3000/api/health
```

### 2. Admin login

```bash
curl -X POST http://localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@operon.local",
    "password": "admin12345"
  }'
```

### 3. Chat order creation

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

### 4. Widget polling

```bash
curl http://localhost:3000/api/chat/conversations/<conversation_id>/messages
```

### 5. Review processing

```bash
curl -X POST http://localhost:3000/api/review/send \
  -H "Authorization: Bearer <admin_jwt>"
```

## Exit Criteria

- весь сценарий проходит без ручных SQL-правок
- на каждом шаге есть наблюдаемый артефакт в UI или API
- после `delivered` создаётся не более одного review request на заказ
- итоговые статусы видны и в `admin-web`, и в API
