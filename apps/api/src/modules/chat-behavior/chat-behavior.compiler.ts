import type {
  BehaviorBlockDefinition,
  BehaviorDefinition,
} from './chat-behavior.schemas.js';

const STAGE_LABELS: Record<string, string> = {
  greeting: 'Приветствие',
  intent: 'Определение запроса',
  'product-search': 'Поиск товара',
  'collect-data': 'Сбор данных',
  confirmation: 'Подтверждение',
  'create-order': 'Создание заказа',
  'status-check': 'Проверка статуса заказа',
  handoff: 'Передача оператору',
  fallback: 'Ошибки и fallback',
};

const FIELD_LABELS: Record<string, string> = {
  customerName: 'имя клиента',
  customerPhone: 'телефон',
  deliveryAddress: 'адрес доставки',
  comment: 'комментарий к заказу',
  items: 'состав заказа',
};

export type CompiledBehaviorPrompt = {
  compiledPrompt: string;
  errors: string[];
  warnings: string[];
  activeBlocks: Array<{
    id: string;
    type: string;
    stageId: string;
  }>;
  stats: {
    promptLength: number;
    activeBlockCount: number;
    enabledStageCount: number;
  };
};

function blockToPrompt(block: BehaviorBlockDefinition) {
  switch (block.type) {
    case 'PersonaBlock':
      return `Роль: ${block.config.role}. Цель: ${block.config.goal}.`;
    case 'ToneBlock':
      return `Тон: ${block.config.tone}. Обращение к клиенту: на ${block.config.addressAs}. Emoji: ${block.config.emojis ? 'можно' : 'не использовать'}. Ответы: ${block.config.responseLength === 'short' ? 'короткие' : 'средней длины'}.`;
    case 'GreetingBlock':
      return `${block.config.greetingText}${block.config.offerHelp ? ' Сразу предложи помочь с оформлением заказа.' : ''}`;
    case 'ProductSearchBlock':
      return `Для поиска товаров используй только find_product. Если товаров не найдено: ${block.config.zeroResultsText}. Если найдено несколько вариантов: ${block.config.multipleResultsText}. Показывай не больше ${block.config.maxOptions} вариантов.`;
    case 'CollectFieldBlock':
      return `Собирай поле «${FIELD_LABELS[block.config.field]}». Поле ${block.config.required ? 'обязательное' : 'необязательное'}. Формулировка вопроса: ${block.config.questionStyle === 'short' ? 'короткая' : 'подробная'}.`;
    case 'ConfirmationBlock':
      return `Перед create_order обязательно ${block.config.requireExplicitConfirmation ? 'получай явное подтверждение клиента' : 'подтверждай заказ'}. В summary перечисляй: ${block.config.summaryFields.map((field) => FIELD_LABELS[field]).join(', ')}.`;
    case 'CreateOrderBlock':
      return `Вызывай create_order только после сбора обязательных данных. После успешного создания заказа: ${block.config.successTemplate}.${block.config.includeOrderSummary ? ' В ответе кратко повторяй состав заказа.' : ''}`;
    case 'StatusCheckBlock':
      return `${block.config.allowStatusLookup ? 'Разрешено отвечать по статусу заказа через get_order_status.' : 'Не выполняй проверку статуса заказа.'} Шаблон ответа: ${block.config.successTemplate}.`;
    case 'HandoffBlock':
      return `Используй start_handoff, если ${[
        block.config.onExplicitRequest ? 'клиент прямо просит оператора' : null,
        block.config.onComplaint ? 'клиент недоволен' : null,
        block.config.onAmbiguity ? 'ситуация неоднозначная и нужно вмешательство человека' : null,
      ]
        .filter(Boolean)
        .join(', ')}. Перед handoff сообщай: ${block.config.handoffMessage}.`;
    case 'FallbackBlock':
      return `Если данных недостаточно, используй fallback: ${block.config.fallbackText}. ${block.config.keepQuestionsShort ? 'Задавай один короткий вопрос за раз.' : 'Можешь задавать развёрнутые уточнения.'}`;
    case 'ForbiddenActionsBlock':
      return [
        block.config.forbidInventingProducts ? 'Не выдумывай товары.' : null,
        block.config.forbidInventingPrices ? 'Не выдумывай цены.' : null,
        block.config.forbidInventingStatuses ? 'Не выдумывай статусы.' : null,
        block.config.russianOnly ? 'Работай только на русском языке.' : null,
      ]
        .filter(Boolean)
        .join(' ');
    case 'ResponseStyleBlock':
      return `${block.config.bulletless ? 'Не используй маркированные списки без необходимости.' : ''} ${block.config.askOneQuestionAtATime ? 'Если не хватает данных, задавай один вопрос за раз.' : ''} ${block.config.mentionOnlyKnownFacts ? 'Упоминай только подтверждённые факты.' : ''}`.trim();
  }
}

export function validateBehaviorDefinition(definition: BehaviorDefinition) {
  const errors: string[] = [];
  const warnings: string[] = [];

  const enabledBlocks = definition.stages.flatMap((stage) =>
    stage.enabled ? stage.blocks.filter((block) => block.enabled) : [],
  );

  const hasEnabledHandoff = enabledBlocks.some((block) => block.type === 'HandoffBlock');
  if (!hasEnabledHandoff) {
    errors.push('Нужен хотя бы один включённый блок передачи на оператора.');
  }

  const hasCreateOrder = enabledBlocks.some((block) => block.type === 'CreateOrderBlock');
  const collectFields = new Set(
    enabledBlocks
      .filter((block): block is Extract<BehaviorBlockDefinition, { type: 'CollectFieldBlock' }> => block.type === 'CollectFieldBlock')
      .filter((block) => block.config.required)
      .map((block) => block.config.field),
  );

  if (hasCreateOrder) {
    if (!collectFields.has('customerPhone')) {
      errors.push('Для create_order нужно обязательное поле «телефон».');
    }
    if (!collectFields.has('deliveryAddress')) {
      errors.push('Для create_order нужно обязательное поле «адрес доставки».');
    }

    const confirmationBlock = enabledBlocks.find(
      (block): block is Extract<BehaviorBlockDefinition, { type: 'ConfirmationBlock' }> =>
        block.type === 'ConfirmationBlock',
    );

    if (!confirmationBlock?.config.requireExplicitConfirmation) {
      errors.push('Для create_order требуется включённый ConfirmationBlock с явным подтверждением.');
    }
  }

  for (const stage of definition.stages) {
    if (stage.enabled && stage.blocks.filter((block) => block.enabled).length === 0) {
      warnings.push(`Этап «${STAGE_LABELS[stage.stageId] ?? stage.stageId}» включён, но не содержит активных блоков.`);
    }
  }

  return { errors, warnings };
}

export function compileBehaviorPrompt(definition: BehaviorDefinition): CompiledBehaviorPrompt {
  const { errors, warnings } = validateBehaviorDefinition(definition);
  const activeBlocks = definition.stages.flatMap((stage) =>
    stage.enabled
      ? stage.blocks
          .filter((block) => block.enabled)
          .sort((left, right) => left.order - right.order)
          .map((block) => ({
            id: block.id,
            type: block.type,
            stageId: stage.stageId,
          }))
      : [],
  );

  const sections = [
    'Базовые правила',
    'Работай как AI-агент оформления заказов. Не нарушай backend guardrails. Используй инструменты только по назначению.',
  ];

  for (const stage of definition.stages) {
    if (!stage.enabled) {
      continue;
    }

    const stagePromptLines = stage.blocks
      .filter((block) => block.enabled)
      .sort((left, right) => left.order - right.order)
      .map((block) => blockToPrompt(block))
      .filter(Boolean);

    if (stagePromptLines.length > 0) {
      sections.push(`${STAGE_LABELS[stage.stageId] ?? stage.stageId}\n${stagePromptLines.join('\n')}`);
    }
  }

  const compiledPrompt = sections.join('\n\n').trim();

  if (compiledPrompt.length > 5000) {
    warnings.push('Prompt получился длинным. Стоит сократить блоки или тексты шаблонов.');
  }

  return {
    compiledPrompt,
    errors,
    warnings,
    activeBlocks,
    stats: {
      promptLength: compiledPrompt.length,
      activeBlockCount: activeBlocks.length,
      enabledStageCount: definition.stages.filter((stage) => stage.enabled).length,
    },
  };
}
