# IMPLEMENTATION PLAN — AI Agent Website MVP (RU)

## 1) Цель
Сделать **рабочий MVP полного цикла** для заказов через Website с ядром на AI-агенте:
`Intake → Order Processing → Dispatch/Tracking → Review Request`.

## 2) Зафиксированный scope (решения)
- Канал MVP: **только Website**.
- LLM: **OpenAI**.
- Язык: **только русский**.
- Оплата: **без онлайн-платежей**.
- Доставка: **свои курьеры**.
- Архитектура MVP: **single-tenant, упрощённая**.
- Handoff: **полный ручной перехват оператором**.

## 3) Ответ на ключевой вопрос
**Да, теперь это план, по которому AI-агент может идти шаг за шагом**, т.к. ниже добавлены:
- машинно-исполняемый backlog (этапы, задачи, зависимости),
- API-контракты,
- чек-листы готовности,
- тест-гейты на каждый этап,
- формат работы агента (как брать задачи и когда останавливать этап).

---

## 4) Архитектура MVP

### 4.1 Компоненты
1. **Web Widget (чат на сайте)** — клиентский UI чата.
2. **Backend API** — бизнес-логика, статусы, маршрутизация.
3. **AI Orchestrator** — слой работы с OpenAI + tools.
4. **Admin/Operator Panel** — каталог, заказы, ручной handoff.
5. **Dispatcher/Courier Web** — назначение и обновление доставок.
6. **DB (PostgreSQL)** — хранение сущностей и истории статусов.
7. **Jobs/Queue (lightweight)** — отложенные задачи (review request 5–10 мин).

### 4.2 Доменные сущности
- `products`
- `customers`
- `conversations`
- `messages`
- `orders`
- `order_status_history`
- `delivery_jobs`
- `review_requests`


### 4.3 Frontend-контур (чтобы проект был полноценным)
**Приложения (MVP):**
1. `website-widget` — встраиваемый чат-виджет для клиента.
2. `admin-web` — админка/операторка/диспетчерская панель.
3. `courier-web` — мобильный web-интерфейс курьера.

**Ключевые экраны:**
- Widget: чат, состояние handoff, системные подсказки.
- Admin: логин, каталог товаров, список заказов, карточка заказа, лента сообщений, кнопка handoff.
- Dispatcher: очередь заказов на доставку, назначение курьера.
- Courier: мои доставки, смена статуса, загрузка proof photo.

**UI-компоненты MVP:**
- ChatWindow, MessageBubble, Composer, HandoffBanner.
- OrdersTable, OrderStatusBadge, OrderDetailsDrawer.
- CourierAssignmentModal, ProofPhotoUploader.

**Frontend-интеграции:**
- API client для backend endpoints.
- Realtime обновления (polling/WebSocket) для чатов и статусов.
- Базовая обработка ошибок и retry для критичных действий.

---

## 5) API-контракты (MVP)

### Chat
- `POST /api/chat/message`
  - вход: `conversation_id`, `text`, `customer_meta`
  - выход: `reply`, `agent_actions[]`, `handoff_state`
- `POST /api/chat/handoff/start`
- `POST /api/chat/handoff/stop`

### Orders
- `POST /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders/:id/status`

### Dispatch
- `POST /api/delivery/assign`
- `GET /api/delivery/jobs` (курьер, Bearer-токен)
- `GET /api/couriers` (admin)
- `POST /api/delivery/:id/status`
- `POST /api/delivery/:id/proof-photo`

### Review
- `POST /api/review/schedule`
- `POST /api/review/send`

---

## 6) Инструменты AI-агента (tool-calling)
Агенту доступны только проверяемые инструменты:
1. `find_product(query)`
2. `create_order(payload)`
3. `get_order_status(order_id)`
4. `start_handoff(conversation_id)`
5. `append_operator_note(order_id, text)`

### Guardrails
- Не выдумывать товары/цены: только из `find_product`.
- Перед `create_order` обязательно подтвердить: товар, количество, адрес, телефон.
- Если пользователь просит оператора → немедленный `start_handoff`.

---

## 7) Machine-executable roadmap для AI-агента

## Текущий статус реализации (2026-04-06)

### Phase A — Foundation
- Статус: **реализован**

### Phase B — AI Core
- Статус: **реализован в MVP-виде**

### Phase C — Website Chat + Handoff
- Статус: **backend + frontend MVP slice реализован**

### Phase D — Processing + Delivery
- Статус: **реализован в MVP-виде** (backend + admin-web + courier-web)

### Что уже сделано
- Поднят backend skeleton на `NestJS + TypeScript`.
- Локальная разработка переведена на `Docker Compose`.
- Поднят `PostgreSQL` как отдельный контейнер.
- Подключён `Prisma`.
- Добавлены миграции и initial schema.
- Созданы таблицы `admin_users`, `products`, `orders`, `order_items`, `order_status_history`.
- Реализован минимальный `admin-auth` с login endpoint и `Bearer` token guard.
- Реализован CRUD для `products`.
- Реализован API для `orders`.
- Реализован status workflow для заказа с проверкой допустимых переходов и записью в `order_status_history`.
- Добавлены seed-данные: 1 admin user и demo products.
- Добавлены integration tests для ключевых backend-потоков.
- README обновлён под фактический способ запуска через Docker.
- Добавлен `ChatModule` с endpoint `POST /api/chat/message`.
- Подключён AI orchestrator с поддержкой tool execution.
- Добавлен OpenAI integration layer.
- Добавлен `mock`-LLM режим для детерминированных integration tests.
- Реализованы инструменты AI-агента:
  - `find_product`
  - `create_order`
  - `get_order_status`
  - `start_handoff`
  - `append_operator_note`
- Добавлены таблицы `conversations`, `messages`, `ai_action_logs`.
- Подключён лог действий AI в `ai_action_logs`.
- Добавлен polling endpoint для website widget: `GET /api/chat/conversations/:id/messages`.
- Добавлены admin/operator endpoints для списка и карточки диалогов.
- Добавлен operator reply endpoint.
- Добавлен ручной handoff через admin endpoints.
- AI перестаёт отправлять автоответы во время handoff.
- После `handoff stop` управление корректно возвращается AI.
- Добавлен frontend app `website-widget`.
- Добавлен frontend app `admin-web`.
- `website-widget` умеет:
  - отправлять сообщения в backend;
  - опрашивать историю сообщений;
  - отображать handoff state;
  - показывать operator replies.
- `admin-web` умеет:
  - выполнять login оператора;
  - показывать список диалогов;
  - открывать карточку диалога;
  - включать и выключать handoff;
  - отправлять сообщения оператора.
- Миграция `20260406120000_phase_d_delivery`: таблицы `couriers`, `delivery_jobs`; заказ связан с доставкой (`deliveryJob`).
- API доставки: `POST /api/delivery/assign` (admin), `GET /api/delivery/jobs`, `POST /api/delivery/:id/status`, `POST /api/delivery/:id/proof-photo` (курьер по Bearer-токену); `GET /api/couriers` (admin).
- `CourierAuthGuard`: сопоставление Bearer-токена с `bcrypt`-хэшем в БД (перебор активных курьеров, MVP-масштаб).
- Seed: демо-курьер и токен `courier-dev-token` (см. `prisma/seed.ts`).
- Integration test: сценарий `assign → on_the_way → proof → delivered`.
- Тесты: unit (`delivery.schemas`, Zod), расширенные integration по доставке/курьерам (`test/delivery.integration.test.ts`); фронт — Vitest (`orderWorkflow`, нормализация API URL, auth-константы). `pnpm --filter @operon/api test:unit` без Postgres; полный `test` / `test:integration` — с БД (см. README).
- `admin-web`: раздел **«Заказы»** — список, карточка, смена статуса по workflow, **назначение курьера** для `ready_for_dispatch`.
- Frontend app **`courier-web`**: ввод токена, список доставок, загрузка фото подтверждения, кнопка «Доставлено».
- **CORS** (`apps/api/src/main.ts`): для dev разрешены origin `http://localhost:3001–3003` и `http://127.0.0.1:3001–3003`; для других URL — env **`CORS_ORIGINS`** (через запятую). Иначе браузер блокирует login с Vite на другом порту.
- **Postgres с хоста:** внешний порт **9432** (`POSTGRES_PORT` в `docker-compose`); для Prisma/CLI на машине — `DATABASE_URL` с `127.0.0.1:9432` (см. `.env.example`). У сервиса `api` в compose задан свой внутренний `DATABASE_URL` на `postgres:5432`, чтобы не путать с URL для хоста.
- **Mock-LLM** (`mock-llm.service.ts`): если из ответа пользователя не извлекается товар по regex, выполняется fallback `хочу <текст пользователя>`, чтобы короткий ответ («Капучино 300 мл») не зацикливал фразу «Уточните товар».
- **Скрипты тестов API:** `pnpm --filter @operon/api test:unit` — только Zod, без БД; `test:integration` — integration; полный `test` — всё вместе (см. README).

### Соответствие презентации (operon - deck.pdf)
- Совпадает: intake с AI + **ручной перехват оператором**, БД заказов/статусов, **доставка и proof**, **review после доставки** (review — Phase E в плане).
- Узкий MVP в коде: канал **только Website** (в deck — также WhatsApp/Telegram); уведомления курьерам в мессенджерах **не** делались — вместо этого **`courier-web`** и те же API.

### Что подтверждено
- Контейнеры `api` и `postgres` поднимаются через Docker.
- Миграция `20260402120000_init` применяется успешно.
- Миграция `20260403090000_phase_b_ai_core` применяется успешно.
- Миграция `20260406120000_phase_d_delivery` применяется успешно.
- Integration tests проходят зелёными:
  - создание заказа;
  - смена статуса заказа;
  - запрет невалидного перехода статуса;
  - защита admin endpoints;
  - создание и чтение products под admin-auth.
  - создание заказа через `POST /api/chat/message`;
  - regression: AI не создаёт заказ без обязательных полей.
- Real OpenAI runtime подключён через `.env` и smoke-проверен:
  - `AI_PROVIDER=openai` стартует корректно;
  - `POST /api/chat/message` доходит до реального OpenAI API;
  - tool-calling c `find_product` работает;
  - guardrail на обязательное подтверждение соблюдается;
  - двухшаговый сценарий `message -> confirmation -> create_order` проходит успешно;
  - создан и подтверждён реальный order `080153b2-a772-4199-b6af-67840f76fb4e`.
- Integration tests Phase C проходят зелёными:
  - polling-style получение истории сообщений;
  - список диалогов для operator/admin;
  - operator handoff;
  - operator manual reply;
  - возврат чата AI после `handoff stop`.
- Frontend verification проходит:
  - `website-widget` unit test;
  - `admin-web` unit test;
  - typecheck обоих frontend apps;
  - production build обоих frontend apps.
- После добавления `courier-web`: typecheck и production build для трёх frontend apps (widget, admin, courier).

### Что ещё остаётся
- Добавить unit tests для моделей/валидации.
- При желании вынести Prisma config из `package.json`, чтобы убрать deprecation warning Prisma 7.
- При желании можно ещё дополнительно дотюнить prompt, но критичный gap multi-turn подтверждения уже закрыт backend-логикой.
- Для полного закрытия Phase C по исходному roadmap всё ещё нет realtime через WebSocket, пока используется polling.
- Следующий этап по roadmap: **`Phase E — Review + Stabilization`** (планировщик review request, метрики, hardening).
- **Продуктовые хвосты (не блокируют Phase E, но в бэклоге):** человекочитаемый номер заказа для клиента (вместо UUID в тексте бота); при необходимости — CRUD каталога в UI admin-web (API уже есть).

### 7.1 Handoff для следующей сессии
- **Сделано по ветке MVP:** Phase A–D в объёме выше; сиды: admin `admin@operon.local`, товары, курьер + `courier-dev-token`.
- **Дев-порты:** API `3000`, widget `3001`, admin `3002`, courier `3003` (Vite `dev`, не прод).
- **Запуск:** `docker compose up -d` (Postgres + api); при необходимости `docker compose exec api pnpm --filter @operon/api prisma:seed`; фронты локально `pnpm --filter @operon/<app> dev` или внутри контейнера api (см. README).
- **LLM:** `AI_PROVIDER=openai` + ключ — реальный OpenAI; `mock` — без сети, детерминированный сценарий.
- **Следующий шаг кода:** Phase E (review + jobs queue + метрики по плану), таблица `review_requests` в схеме пока не реализована.

## Phase A — Foundation (Week 1)
### Задачи
- A1. Поднять backend + БД + миграции.
- A2. Создать базовые таблицы домена.
- A3. Поднять admin-auth (минимальный логин).

### DoD
- Миграции применяются с нуля.
- CRUD для `products` и `orders` доступен из API.

### Тест-гейт
- unit: модели/валидации;
- integration: создание заказа, смена статуса.

## Phase B — AI Core (Week 1–2)
### Задачи
- B1. Интегрировать OpenAI.
- B2. Реализовать orchestrator + tools.
- B3. Подключить лог действий AI.

### DoD
- Агент создаёт заказ через tool-calling.
- Ошибки tools корректно обрабатываются (fallback ответ).

### Тест-гейт
- integration: `POST /api/chat/message` → заказ создан;
- regression: агент не создаёт заказ без обязательных полей.

## Phase C — Website Chat + Handoff (Week 2)
### Задачи
- C1. Виджет чата на сайте.
- C2. Реалтайм обмен сообщениями (polling/WebSocket).
- C3. Кнопка ручного перехвата в операторской панели.

### DoD
- Оператор может перехватить и вернуть чат AI.
- При handoff AI прекращает автоответы.

### Тест-гейт
- e2e: клиент пишет → AI отвечает;
- e2e: operator handoff → отвечает только оператор.

## Phase D — Processing + Delivery (Week 3)
### Задачи
- D1. Экран заказов и workflow статусов.
- D2. Назначение курьера.
- D3. Курьерский web-интерфейс + proof-photo.

### DoD
- Статусы проходят цепочку без «дыр».
- У delivery есть ответственный курьер и таймштампы.

### Тест-гейт
- integration: `assign → on_the_way → delivered`.
- e2e: фото-подтверждение сохраняется.

## Phase E — Review + Stabilization (Week 4)
### Задачи
- E1. Планировщик review request (через 5–10 минут).
- E2. Базовые метрики в админке.
- E3. Bugfix + hardening.

### DoD
- После `delivered` автоматически появляется задача review.
- Метрики: orders total, delivered %, handoff %.

### Тест-гейт
- integration: delay job отрабатывает один раз (idempotency).
- smoke: полный сценарий от чата до review.

---

## 8) Протокол работы AI-агента (как выполнять план)
Для каждого Phase агент делает строго:
1. Берёт первую незавершённую задачу.
2. Делает минимальные изменения для задачи.
3. Запускает тест-гейт фазы.
4. Если тесты зелёные — помечает задачу выполненной.
5. Если красные — фиксит до зелёного.
6. Переходит к следующей задаче.

**Stop rule:** если блокер > 2 попыток, агент пишет список блокеров и предлагает 2 пути обхода.

---

## 9) Что НЕ входит в MVP
- Telegram/WhatsApp.
- Онлайн-платежи.
- Multi-tenant production-grade.
- Advanced RBAC/enterprise compliance.
- Многоагентная оркестрация.

## 10) Критерии приёмки MVP
1. Клиент оформляет заказ через website-чат.
2. AI использует tools и не выдумывает каталог.
3. Оператор перехватывает чат одной кнопкой.
4. Диспетчер назначает курьера, курьер закрывает доставку.
5. Через 5–10 минут после `delivered` создаётся/отправляется review request.
6. Сквозной e2e-сценарий проходит стабильно.


## 11) Frontend Definition of Done (обязательно для полноценного MVP)
1. Клиентский chat-widget встраивается на сайт одной строкой скрипта и открывает рабочий чат.
2. Оператор в admin-web видит диалог, перехватывает чат и возвращает управление AI.
3. В admin-web доступны CRUD каталога и базовый order management.
4. Диспетчер назначает курьера из UI без ручных SQL/скриптов.
5. Курьер в courier-web обновляет статусы и загружает фото-подтверждение.
6. Все ключевые фронтенд-потоки имеют e2e smoke (chat, handoff, dispatch, delivery close).
