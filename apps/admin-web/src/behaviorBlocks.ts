import type {
  BehaviorBlockDefinition,
  BehaviorBlockType,
  BehaviorDefinition,
  BehaviorStageId,
} from './behaviorTypes';
import { BEHAVIOR_STAGE_ORDER } from './behaviorTypes';

export const STAGE_LABELS: Record<BehaviorStageId, string> = {
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

export const BLOCK_LABELS: Record<BehaviorBlockType, string> = {
  PersonaBlock: 'Роль агента',
  ToneBlock: 'Тон общения',
  GreetingBlock: 'Приветствие',
  ProductSearchBlock: 'Поиск товара',
  CollectFieldBlock: 'Сбор поля',
  ConfirmationBlock: 'Подтверждение заказа',
  CreateOrderBlock: 'Создание заказа',
  StatusCheckBlock: 'Проверка статуса',
  HandoffBlock: 'Передача оператору',
  FallbackBlock: 'Fallback-логика',
  ForbiddenActionsBlock: 'Запреты',
  ResponseStyleBlock: 'Стиль ответа',
};

export const STAGE_BLOCK_TYPES: Record<BehaviorStageId, BehaviorBlockType[]> = {
  greeting: ['GreetingBlock'],
  intent: ['PersonaBlock', 'ToneBlock', 'ResponseStyleBlock'],
  'product-search': ['ProductSearchBlock'],
  'collect-data': ['CollectFieldBlock'],
  confirmation: ['ConfirmationBlock'],
  'create-order': ['CreateOrderBlock'],
  'status-check': ['StatusCheckBlock'],
  handoff: ['HandoffBlock'],
  fallback: ['FallbackBlock', 'ForbiddenActionsBlock'],
};

export function createBlock(
  type: BehaviorBlockType,
  order: number,
  idSuffix = `${Date.now()}`,
): BehaviorBlockDefinition {
  const id = `${type}-${idSuffix}`;

  switch (type) {
    case 'PersonaBlock':
      return {
        id,
        type,
        enabled: true,
        order,
        config: {
          role: 'AI-агент оформления заказов',
          goal: 'Помочь клиенту быстро оформить заказ.',
        },
      };
    case 'ToneBlock':
      return {
        id,
        type,
        enabled: true,
        order,
        config: {
          tone: 'friendly',
          addressAs: 'вы',
          emojis: false,
          responseLength: 'short',
        },
      };
    case 'GreetingBlock':
      return {
        id,
        type,
        enabled: true,
        order,
        config: {
          greetingText: 'Поздоровайся и предложи помочь с заказом.',
          offerHelp: true,
        },
      };
    case 'ProductSearchBlock':
      return {
        id,
        type,
        enabled: true,
        order,
        config: {
          zeroResultsText: 'Сообщи, что товар не найден, и попроси уточнить название.',
          multipleResultsText: 'Покажи найденные варианты и попроси выбрать один.',
          maxOptions: 5,
        },
      };
    case 'CollectFieldBlock':
      return {
        id,
        type,
        enabled: true,
        order,
        config: {
          field: 'customerPhone',
          required: true,
          questionStyle: 'short',
        },
      };
    case 'ConfirmationBlock':
      return {
        id,
        type,
        enabled: true,
        order,
        config: {
          requireExplicitConfirmation: true,
          summaryFields: ['items', 'customerPhone', 'deliveryAddress'],
        },
      };
    case 'CreateOrderBlock':
      return {
        id,
        type,
        enabled: true,
        order,
        config: {
          successTemplate: 'Сообщи, что заказ оформлен, и при наличии укажи номер.',
          includeOrderSummary: true,
        },
      };
    case 'StatusCheckBlock':
      return {
        id,
        type,
        enabled: true,
        order,
        config: {
          allowStatusLookup: true,
          successTemplate: 'Сообщи статус заказа коротко и по делу.',
        },
      };
    case 'HandoffBlock':
      return {
        id,
        type,
        enabled: true,
        order,
        config: {
          onExplicitRequest: true,
          onComplaint: true,
          onAmbiguity: true,
          handoffMessage: 'Сообщи, что передаёшь диалог оператору.',
        },
      };
    case 'FallbackBlock':
      return {
        id,
        type,
        enabled: true,
        order,
        config: {
          fallbackText: 'Если данных не хватает, задай короткий уточняющий вопрос.',
          keepQuestionsShort: true,
        },
      };
    case 'ForbiddenActionsBlock':
      return {
        id,
        type,
        enabled: true,
        order,
        config: {
          forbidInventingProducts: true,
          forbidInventingPrices: true,
          forbidInventingStatuses: true,
          russianOnly: true,
        },
      };
    case 'ResponseStyleBlock':
      return {
        id,
        type,
        enabled: true,
        order,
        config: {
          bulletless: true,
          askOneQuestionAtATime: true,
          mentionOnlyKnownFacts: true,
        },
      };
  }
}

export function createEmptyBehaviorDefinition(name: string): BehaviorDefinition {
  return {
    schemaVersion: 1,
    profileMeta: { name },
    stages: BEHAVIOR_STAGE_ORDER.map((stageId) => ({
      stageId,
      enabled: true,
      blocks: [],
    })),
  };
}
