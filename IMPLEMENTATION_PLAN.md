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
