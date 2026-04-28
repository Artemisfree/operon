# IMPLEMENTATION PLAN — AI Behavior Builder

## 1) Цель
Сделать в `admin-web` отдельную вкладку-конструктор, в которой оператор или администратор может собирать поведение AI-агента из готовых блоков сценария заказа, видеть итоговый prompt, сохранять черновики, публиковать версии и безопасно менять поведение без правок кода.

Основная идея:
- не давать пользователю писать весь prompt вручную;
- собирать поведение из валидируемых блоков;
- компилировать блоки в итоговый `system prompt`;
- хранить поведение как версионируемую конфигурацию;
- применять новые версии только к новым диалогам.

---

## 2) Что есть сейчас

В текущей реализации:
- системный prompt захардкожен в [apps/api/src/modules/chat/chat.constants.ts](/Users/artemnadtoceev/dev/operon/apps/api/src/modules/chat/chat.constants.ts);
- prompt используется в [apps/api/src/modules/chat/llm/openai-llm.service.ts](/Users/artemnadtoceev/dev/operon/apps/api/src/modules/chat/llm/openai-llm.service.ts);
- orchestration и tool-calling реализованы в [apps/api/src/modules/chat/chat.orchestrator.ts](/Users/artemnadtoceev/dev/operon/apps/api/src/modules/chat/chat.orchestrator.ts);
- админка имеет вкладки `Диалоги`, `Заказы`, `Метрики` в [apps/admin-web/src/App.tsx](/Users/artemnadtoceev/dev/operon/apps/admin-web/src/App.tsx).

Ограничение текущей схемы:
- поведение AI нельзя менять из UI;
- prompt не версионируется;
- нет безопасного draft/publish процесса;
- нет визуального конструктора бизнес-логики ответа.

---

## 3) Продуктовое решение

Нужно добавить новую вкладку в `admin-web`:
- `Поведение AI`

Внутри вкладки должен быть визуальный builder, который позволяет:
- создавать профиль поведения;
- собирать flow из блоков по этапам заказа;
- настраивать параметры каждого блока;
- видеть preview итогового prompt;
- получать warnings и validation errors;
- сохранять draft;
- публиковать новую версию;
- просматривать историю версий и diff.

Важно:
- это не свободный редактор текста;
- это guided builder из типизированных блоков;
- итоговый prompt является производным артефактом, а не источником истины.

---

## 4) Принципы реализации

### 4.1 Источник истины
Источник истины:
- JSON-конфигурация поведения (`definition`)

Производный артефакт:
- скомпилированный `compiledPrompt`

### 4.2 Что остаётся в коде, а не в UI
Через конструктор не должны настраиваться:
- список tool definitions и их JSON schema;
- backend guardrails;
- deterministic-логика `tryCreateOrderFromConfirmation`;
- security/safety-ограничения;
- базовые ограничения по вызову `create_order` и `start_handoff`, если они критичны для корректности системы.

### 4.3 Правило применения версий
Для упрощения MVP:
- новая опубликованная версия применяется только к новым `Conversation`;
- уже существующие диалоги продолжают работать на своей закреплённой версии поведения.

---

## 5) UX-модель конструктора

Рекомендуемая структура экрана: 3 колонки.

### 5.1 Левая колонка — Profiles
Содержимое:
- список профилей поведения;
- поиск по профилям;
- кнопка `Создать профиль`;
- действие `Дублировать`;
- действие `Архивировать`;
- индикаторы `draft`, `published`, `default`.

Примеры профилей:
- `Основной`
- `Ночной`
- `Для дорогих заказов`
- `Тестовый`

### 5.2 Центральная колонка — Flow Builder
Содержимое:
- этапы поведения агента;
- внутри этапа список блоков;
- действия `Добавить блок`, `Вверх`, `Вниз`, `Включить`, `Выключить`, `Удалить`;
- выделение выбранного блока для настройки.

Важно:
- на MVP не нужен drag-and-drop;
- порядок блоков можно менять кнопками `вверх/вниз`.

### 5.3 Правая колонка — Preview / Validation
Содержимое:
- итоговый preview prompt;
- validation warnings;
- compile errors;
- список активных правил;
- diff относительно опубликованной версии;
- служебная информация: длина prompt, версия, статус draft/published.

---

## 6) Flow-модель поведения

Не нужен произвольный canvas. Нужен guided flow по этапам заказа.

Рекомендуемые этапы:
1. `Приветствие`
2. `Определение запроса`
3. `Поиск товара`
4. `Сбор данных`
5. `Подтверждение`
6. `Создание заказа`
7. `Проверка статуса заказа`
8. `Передача оператору`
9. `Ошибки и fallback`

Каждый этап:
- имеет фиксированный `stageId`;
- содержит список блоков;
- может иметь `required` статус;
- может иметь правила минимальной конфигурации.

---

## 7) Блоки поведения

### 7.1 Общая модель блока
Каждый блок должен иметь:
- `id`
- `type`
- `enabled`
- `stageId`
- `config`
- `order`

Дополнительно на уровне каталога блоков:
- `title`
- `description`
- `category`
- `defaultConfig`
- `validate(config)`
- `compile(config)`

### 7.2 Базовые типы блоков для MVP
Минимальный набор:
- `PersonaBlock`
- `ToneBlock`
- `GreetingBlock`
- `ProductSearchBlock`
- `CollectFieldBlock`
- `ConfirmationBlock`
- `CreateOrderBlock`
- `StatusCheckBlock`
- `HandoffBlock`
- `FallbackBlock`
- `ForbiddenActionsBlock`
- `ResponseStyleBlock`

### 7.3 Примеры конфигурации блоков

#### PersonaBlock
Настройки:
- роль агента;
- контекст бизнеса;
- короткое описание задачи агента.

#### ToneBlock
Настройки:
- `neutral | friendly | concise-business`;
- общение на `ты | вы`;
- допустимы ли emoji;
- длина ответа `short | medium`.

#### GreetingBlock
Настройки:
- нужно ли приветствие в начале;
- краткое приветствие;
- надо ли сразу предлагать помощь с заказом.

#### ProductSearchBlock
Настройки:
- всегда использовать `find_product` для товаров;
- как отвечать при 0 совпадений;
- как отвечать при нескольких совпадениях;
- сколько вариантов показывать пользователю.

#### CollectFieldBlock
Настройки:
- поле: `customerName | customerPhone | deliveryAddress | comment`;
- обязательно ли поле;
- в какой форме запрашивать;
- можно ли объединять вопросы.

#### ConfirmationBlock
Настройки:
- требуется ли явное подтверждение перед `create_order`;
- шаблон summary перед подтверждением;
- какие поля перечислять в summary.

#### CreateOrderBlock
Настройки:
- вызывать ли `create_order` только после всех обязательных данных;
- текст ответа после успешного заказа;
- добавлять ли краткую сводку заказа.

#### HandoffBlock
Настройки:
- handoff при прямой просьбе клиента;
- handoff при недовольстве;
- handoff при неоднозначности;
- handoff при системной ошибке;
- текст перед переводом на оператора.

#### FallbackBlock
Настройки:
- как задавать уточняющий вопрос;
- насколько кратким должен быть fallback;
- что делать, если запрос не распознан.

#### ForbiddenActionsBlock
Настройки:
- не выдумывать товары;
- не выдумывать цены;
- не выдумывать статусы;
- не создавать заказ без обязательных данных;
- отвечать только на русском.

---

## 8) UI-компоненты для `admin-web`

Новый экран:
- [apps/admin-web/src/BehaviorView.tsx](/Users/artemnadtoceev/dev/operon/apps/admin-web/src/BehaviorView.tsx)

Рекомендуемое разбиение:
- `BehaviorView`
- `BehaviorProfilesPanel`
- `BehaviorFlowEditor`
- `BehaviorStageCard`
- `BehaviorBlockCard`
- `BehaviorBlockInspector`
- `BehaviorPromptPreview`
- `BehaviorValidationPanel`
- `BehaviorVersionToolbar`
- `BehaviorVersionHistoryModal`

Дополнительные файлы:
- [apps/admin-web/src/behaviorTypes.ts](/Users/artemnadtoceev/dev/operon/apps/admin-web/src/behaviorTypes.ts)
- [apps/admin-web/src/behaviorApi.ts](/Users/artemnadtoceev/dev/operon/apps/admin-web/src/behaviorApi.ts)
- [apps/admin-web/src/behaviorBlocks.ts](/Users/artemnadtoceev/dev/operon/apps/admin-web/src/behaviorBlocks.ts)

### 8.1 Изменения в App.tsx
В [apps/admin-web/src/App.tsx](/Users/artemnadtoceev/dev/operon/apps/admin-web/src/App.tsx):
- добавить новый view: `'behavior'`;
- добавить навигационную кнопку `Поведение AI`;
- обеспечить переходы между `chats`, `orders`, `metrics`, `behavior`.

### 8.2 Состояние на фронте
Нужны три слоя состояния.

#### Серверное состояние
- список профилей;
- текущий профиль;
- draft версии;
- published версии;
- preview prompt;
- validation response.

#### Локальное состояние редактора
- выбранный stage;
- выбранный block;
- unsaved changes;
- локальная draft-модель до сохранения;
- открытые модалки.

#### Derived state
- можно ли publish;
- есть ли compile errors;
- есть ли diff;
- есть ли несохранённые изменения.

На MVP достаточно:
- `useState`
- `useEffect`
- существующего подхода без отдельного state manager.

### 8.3 Сценарии пользователя
UI должен поддерживать:
1. создание профиля;
2. дублирование профиля;
3. редактирование draft;
4. preview prompt;
5. просмотр warnings/errors;
6. publish;
7. просмотр истории версий;
8. rollback через re-publish старой версии.

---

## 9) Backend-архитектура

Нужно добавить новый backend-модуль, например:
- `chat-behavior`

Рекомендуемая структура:
- `apps/api/src/modules/chat-behavior/chat-behavior.module.ts`
- `apps/api/src/modules/chat-behavior/chat-behavior.controller.ts`
- `apps/api/src/modules/chat-behavior/chat-behavior.service.ts`
- `apps/api/src/modules/chat-behavior/chat-behavior.schemas.ts`
- `apps/api/src/modules/chat-behavior/chat-behavior.compiler.ts`
- `apps/api/src/modules/chat-behavior/chat-behavior.catalog.ts`

### 9.1 Основные обязанности backend-слоя
- хранить профили и версии;
- валидировать `definition`;
- компилировать `definition` в `compiledPrompt`;
- возвращать preview;
- публиковать версии;
- определять активную опубликованную версию;
- отдавать версию поведения в runtime чата.

---

## 10) Хранение в БД

Рекомендуется добавить две основные сущности и связь с `Conversation`.

### 10.1 AgentBehaviorProfile
Поля:
- `id`
- `name`
- `code`
- `description`
- `isDefault`
- `publishedVersionId`
- `createdAt`
- `updatedAt`

Назначение:
- контейнер для логической сущности профиля поведения.

### 10.2 AgentBehaviorVersion
Поля:
- `id`
- `profileId`
- `version`
- `status` = `draft | published | archived`
- `definition` JSON
- `compiledPrompt` TEXT
- `createdBy`
- `publishedAt`
- `createdAt`
- `updatedAt`

Назначение:
- хранить конкретную версию конфигурации и prompt.

### 10.3 Изменения в Conversation
Добавить:
- `behaviorVersionId`

Назначение:
- фиксировать, по какой версии поведения шёл конкретный диалог;
- обеспечивать воспроизводимость;
- упростить аудит.

### 10.4 Опционально в AiActionLog
Желательно добавить:
- `behaviorVersionId`

Назначение:
- видеть, по какой версии поведения был выполнен конкретный tool-call или orchestrator action.

---

## 11) Prisma-модель

Ниже ориентир по структуре. Названия можно скорректировать под принятый стиль схемы.

```prisma
enum AgentBehaviorVersionStatus {
  draft
  published
  archived

  @@map("agent_behavior_version_status")
}

model AgentBehaviorProfile {
  id                 String                 @id @default(uuid()) @db.Uuid
  name               String
  code               String                 @unique
  description        String?
  isDefault          Boolean                @default(false) @map("is_default")
  publishedVersionId String?                @unique @map("published_version_id") @db.Uuid
  createdAt          DateTime               @default(now()) @map("created_at")
  updatedAt          DateTime               @updatedAt @map("updated_at")
  versions           AgentBehaviorVersion[]
  publishedVersion   AgentBehaviorVersion?  @relation("PublishedBehaviorVersion", fields: [publishedVersionId], references: [id], onDelete: SetNull)

  @@map("agent_behavior_profiles")
}

model AgentBehaviorVersion {
  id            String                      @id @default(uuid()) @db.Uuid
  profileId     String                      @map("profile_id") @db.Uuid
  version       Int
  status        AgentBehaviorVersionStatus  @default(draft)
  definition    Json
  compiledPrompt String                     @map("compiled_prompt")
  createdBy     String?                     @map("created_by")
  publishedAt   DateTime?                   @map("published_at")
  createdAt     DateTime                    @default(now()) @map("created_at")
  updatedAt     DateTime                    @updatedAt @map("updated_at")
  profile       AgentBehaviorProfile        @relation(fields: [profileId], references: [id], onDelete: Cascade)
  publishedByOf AgentBehaviorProfile?       @relation("PublishedBehaviorVersion")
  conversations Conversation[]

  @@unique([profileId, version])
  @@index([profileId, status])
  @@map("agent_behavior_versions")
}
```

Дополнительно:
- обновить `Conversation` и при необходимости `AiActionLog`.

---

## 12) Формат `definition`

Нужно хранить в JSON не текст prompt, а структуру builder-а.

Пример:

```json
{
  "schemaVersion": 1,
  "profileMeta": {
    "name": "Основной"
  },
  "stages": [
    {
      "stageId": "greeting",
      "enabled": true,
      "blocks": [
        {
          "id": "block-greeting-1",
          "type": "GreetingBlock",
          "enabled": true,
          "order": 10,
          "config": {
            "greetingText": "Поздоровайся и коротко предложи помочь с заказом."
          }
        }
      ]
    },
    {
      "stageId": "collect-data",
      "enabled": true,
      "blocks": [
        {
          "id": "block-phone-1",
          "type": "CollectFieldBlock",
          "enabled": true,
          "order": 10,
          "config": {
            "field": "customerPhone",
            "required": true,
            "questionStyle": "short"
          }
        }
      ]
    }
  ]
}
```

Требования к формату:
- версия схемы;
- стабильные `stageId` и `type`;
- сериализуемость в JSON;
- совместимость с backend validation;
- возможность миграции схемы в будущем.

---

## 13) Каталог блоков

Каталог блоков должен храниться в коде.

Причина:
- UI и backend должны использовать один и тот же набор допустимых блоков;
- блоки должны быть типизированы;
- валидаторы и compile-функции должны быть предсказуемыми;
- нельзя позволять UI создавать неизвестные типы блоков.

Рекомендуемая организация:
- `apps/api/src/modules/chat-behavior/blocks/*`
- `apps/admin-web/src/behaviorBlocks.ts`

Если получится, вынести общие типы в shared package. Если нет, на MVP можно поддерживать синхронно два typed-слоя, но backend должен быть окончательным источником валидации.

Каждый блок должен определять:
- UI metadata;
- default config;
- validator;
- compiler fragment.

---

## 14) Компиляция в итоговый prompt

Нужен отдельный сервис:
- `BehaviorPromptBuilderService`

Он должен собирать prompt из нескольких слоёв.

### 14.1 Слои prompt
1. `Base immutable policy`
2. `Behavior profile`
3. `Runtime context`
4. `Tool-result suffix`, если это follow-up после tool execution

### 14.2 Base immutable policy
Здесь хранятся системные правила, которые нельзя отключить через UI:
- работа только на русском;
- не выдумывать товары, цены, статусы;
- ограничения на вызовы tools;
- safety/guardrails;
- системные ограничения runtime.

### 14.3 Behavior profile
Сюда попадает скомпилированный результат блоков:
- persona;
- стиль;
- пошаговое поведение;
- handoff logic;
- fallback logic;
- правила подтверждения;
- правила использования tools.

### 14.4 Runtime context
Сюда попадают:
- данные клиента;
- сведения о conversation;
- контекст текущего режима выполнения.

### 14.5 Follow-up suffix
Если LLM вызывается после tool execution:
- нужно добавлять отдельную секцию, аналогично текущему поведению `OpenAiLlmService`.

### 14.6 Формат итогового prompt
Рекомендуемый формат: человекочитаемый текст с секциями.

Пример:

```txt
Роль агента
...

Стиль общения
...

Сценарий оформления заказа
1. ...
2. ...

Использование инструментов
...

Когда переводить на оператора
...

Чего нельзя делать
...
```

---

## 15) Изменения в runtime чата

Текущий код использует константу `AI_SYSTEM_PROMPT`. Нужно перейти на runtime-выбор prompt по версии поведения.

### 15.1 Что изменить
Вместо прямого использования `AI_SYSTEM_PROMPT`:
- находить активную версию поведения;
- получать `compiledPrompt`;
- использовать его в LLM request;
- закреплять `behaviorVersionId` за новым conversation.

### 15.2 Где менять
Основные точки:
- [apps/api/src/modules/chat/llm/openai-llm.service.ts](/Users/artemnadtoceev/dev/operon/apps/api/src/modules/chat/llm/openai-llm.service.ts)
- [apps/api/src/modules/chat/chat.service.ts](/Users/artemnadtoceev/dev/operon/apps/api/src/modules/chat/chat.service.ts)
- [apps/api/src/modules/chat/chat.orchestrator.ts](/Users/artemnadtoceev/dev/operon/apps/api/src/modules/chat/chat.orchestrator.ts)

### 15.3 Рекомендуемая схема работы
При создании нового `Conversation`:
- определить default published behavior version;
- сохранить `behaviorVersionId` в conversation.

При каждом LLM вызове:
- получить `behaviorVersionId` из conversation;
- загрузить `compiledPrompt`;
- использовать prompt в запросе к LLM.

---

## 16) API-контракты для конструктора

Нужен admin-only API.

### 16.1 Список endpoints
- `GET /api/admin/ai-behaviors`
- `GET /api/admin/ai-behaviors/:id`
- `POST /api/admin/ai-behaviors`
- `POST /api/admin/ai-behaviors/:id/draft`
- `POST /api/admin/ai-behaviors/:id/preview`
- `POST /api/admin/ai-behaviors/:id/publish`
- `GET /api/admin/ai-behaviors/:id/versions`

### 16.2 Что должен возвращать preview
`preview` должен возвращать:
- `compiledPrompt`
- `errors[]`
- `warnings[]`
- `activeBlocks[]`
- `stats`

Пример `stats`:
- длина prompt;
- количество активных блоков;
- количество обязательных этапов без конфигурации;
- наличие handoff-логики.

### 16.3 Что должен делать publish
`publish` должен:
- валидировать draft;
- компилировать prompt;
- создавать published version;
- помечать предыдущую published version как архивную или оставлять published-history по принятой модели;
- обновлять `publishedVersionId` у профиля.

---

## 17) UX-правила и поведение UI

### 17.1 Toolbar сверху страницы
Нужен toolbar:
- `Черновик`
- `Опубликовано: vN`
- `Сохранить`
- `Предпросмотр`
- `Опубликовать`

### 17.2 Inspector блока
По клику на блок справа должен открываться inspector:
- форма настроек;
- описание блока;
- поля конфигурации;
- inline validation.

### 17.3 Validation panel
В правой панели нужно показывать:
- ошибки, блокирующие publish;
- предупреждения, не блокирующие publish;
- краткие подсказки по недостающим этапам.

Примеры ошибок:
- включён `CreateOrderBlock`, но нет обязательного `customerPhone`;
- включён `CreateOrderBlock`, но отсутствует `ConfirmationBlock`;
- отсутствует обязательный этап `Передача оператору`.

Примеры warning:
- слишком длинный prompt;
- конфликт tone/persona;
- несколько блоков задают противоречивое правило fallback.

### 17.4 Version history
Нужен modal или drawer:
- список версий;
- кто создал;
- когда опубликовал;
- статус;
- diff по блокам;
- diff по prompt.

---

## 18) Минимальный визуальный состав страниц

### 18.1 Profiles panel
Элементы:
- список карточек профилей;
- кнопка `Создать`;
- кнопка `Дублировать`;
- индикаторы статуса.

### 18.2 Flow editor
Элементы:
- stage cards;
- block cards;
- кнопки reorder;
- кнопка `Добавить блок`;
- empty-state для пустого этапа.

### 18.3 Block card
Элементы:
- название;
- описание;
- toggle enabled;
- кнопки `Настроить`, `Удалить`, `Вверх`, `Вниз`.

### 18.4 Prompt preview
Элементы:
- моноширинный preview;
- счетчик длины;
- секции prompt;
- кнопка обновить preview.

### 18.5 Validation panel
Элементы:
- список errors;
- список warnings;
- summary статуса.

---

## 19) Дизайн и стиль в рамках текущего проекта

Так как `admin-web` уже существует, нужно сохранить существующий визуальный язык:
- existing shell;
- sidebar / main layout;
- текущие button/input стили;
- существующие отступы и карточки.

Не нужно:
- внедрять новый дизайн-системный слой;
- строить сложный canvas;
- добавлять тяжёлые drag-and-drop библиотеки в MVP.

Нужно:
- сделать понятный редактор;
- сохранить визуальную совместимость с текущей админкой;
- добавить читаемый preview и валидаторы.

---

## 20) Порядок реализации

### Этап 1 — Backend foundation
Сделать:
- Prisma schema;
- migration;
- сущности профиля и версии;
- связь `Conversation -> behaviorVersionId`.

### Этап 2 — Compiler and validation
Сделать:
- каталог блоков;
- схемы `definition`;
- compile pipeline;
- preview response;
- validation rules.

### Этап 3 — Admin API
Сделать:
- CRUD профилей;
- draft save;
- preview endpoint;
- publish endpoint;
- versions list.

### Этап 4 — Runtime integration
Сделать:
- выбор active published version;
- сохранение `behaviorVersionId` в conversation;
- подстановка `compiledPrompt` вместо текущего hardcoded prompt.

### Этап 5 — UI shell
Сделать:
- новый `view` в `admin-web`;
- навигацию;
- `BehaviorView`;
- список профилей;
- загрузку текущего draft.

### Этап 6 — Flow editor UI
Сделать:
- список stages;
- block cards;
- inspector;
- reorder через кнопки;
- add/remove block.

### Этап 7 — Preview and validation UI
Сделать:
- prompt preview;
- errors/warnings;
- publish toolbar;
- unsaved-changes state.

### Этап 8 — Version history
Сделать:
- список версий;
- diff;
- re-publish старой версии.

### Этап 9 — Seed and rollout
Сделать:
- seed default profile;
- миграцию текущего `AI_SYSTEM_PROMPT` в baseline profile;
- проверку, что поведение без UI-правок остаётся совместимым с текущим MVP.

---

## 21) Технические компромиссы для MVP

Чтобы не перегрузить первую реализацию, на MVP допускаются ограничения:
- без drag-and-drop;
- без ветвящегося визуального flow;
- без условной логики вида `if/else` в UI;
- без A/B routing по профилям;
- без live token estimate;
- без одновременного редактирования несколькими админами.

Для MVP достаточно:
- линейный flow;
- блоки по этапам;
- preview;
- validation;
- draft/publish;
- version history.

---

## 22) Валидация и бизнес-правила

Нужно ввести backend validation rules.

Обязательные проверки:
- нельзя публиковать профиль без обязательных этапов;
- нельзя публиковать включённый `CreateOrderBlock`, если не собираются `customerPhone` и `deliveryAddress`;
- нельзя публиковать `CreateOrderBlock` без `ConfirmationBlock`, если проект требует explicit confirmation;
- должен существовать хотя бы один `HandoffBlock` или встроенная immutable handoff policy;
- нельзя иметь неизвестный тип блока;
- нельзя иметь невалидный `config`.

Желательные warning rules:
- prompt слишком длинный;
- stage включён, но пустой;
- несколько блоков задают дублирующее правило;
- стиль общения противоречив.

---

## 23) Тестирование

### 23.1 Backend tests
Нужны тесты на:
- валидацию `definition`;
- компиляцию prompt;
- publish flow;
- выбор активной версии поведения;
- закрепление версии за conversation;
- использование правильного prompt в runtime.

### 23.2 Frontend tests
Нужны тесты на:
- загрузку списка профилей;
- редактирование блока;
- reorder блока;
- preview response rendering;
- показ validation errors;
- disabled state кнопки publish при ошибках.

### 23.3 Integration tests
Нужны сквозные проверки:
- create profile -> save draft -> preview -> publish;
- новая conversation использует published version;
- существующая conversation не ломается после publish новой версии.

---

## 24) Критерии готовности

Фича считается реализованной, если:
- в `admin-web` есть вкладка `Поведение AI`;
- можно создать профиль поведения;
- можно собрать поведение из блоков;
- можно сохранить draft;
- можно увидеть итоговый prompt;
- можно получить validation errors и warnings;
- можно опубликовать версию;
- новая версия применяется к новым диалогам;
- у conversation сохраняется ссылка на `behaviorVersionId`;
- базовый профиль повторяет текущее поведение AI без регрессии по основному сценарию заказа.

---

## 25) Что не делать в первой итерации

Не включать в первую итерацию:
- визуальный canvas со стрелками;
- произвольные пользовательские JS-условия;
- редактор сырых tool definitions;
- промпт-редактор как основной интерфейс;
- сложные multi-profile routing rules;
- массовое переключение старых conversations на новую версию.

---

## 26) Рекомендуемые следующие шаги

1. Утвердить data model `AgentBehaviorProfile` / `AgentBehaviorVersion`.
2. Утвердить список stage ids и block types для MVP.
3. Сделать Prisma migration.
4. Реализовать backend compiler и validation.
5. Подключить runtime к published behavior version.
6. После этого реализовать UI вкладки в `admin-web`.

---

## 27) Краткое решение по архитектуре

Финальная рекомендуемая схема:
- блоки и их правила хранятся в коде;
- собранная конфигурация хранится в БД в JSON;
- итоговый prompt компилируется на backend;
- версии публикуются через draft/publish;
- conversation фиксирует версию поведения;
- UI работает как builder, а не как raw prompt editor.

Это даёт:
- контролируемую сложность;
- безопасность изменения поведения;
- воспроизводимость диалогов;
- возможность дальнейшего расширения без слома текущего MVP.

Что еще сделать:
1) Подключение к реальному клиенту(Флор дубай), поправить промпты
2) фильтры в диалогах
3) 