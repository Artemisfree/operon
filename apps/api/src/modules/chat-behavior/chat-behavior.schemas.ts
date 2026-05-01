import { z } from 'zod';

export const BEHAVIOR_STAGE_IDS = [
  'greeting',
  'intent',
  'product-search',
  'collect-data',
  'confirmation',
  'create-order',
  'status-check',
  'handoff',
  'fallback',
] as const;

export type BehaviorStageId = (typeof BEHAVIOR_STAGE_IDS)[number];

const behaviorStageIdSchema = z.enum(BEHAVIOR_STAGE_IDS);

const blockBaseSchema = z.object({
  id: z.string().trim().min(1).max(120),
  enabled: z.boolean(),
  order: z.number().int().min(0).max(10_000),
});

const personaBlockSchema = blockBaseSchema.extend({
  type: z.literal('PersonaBlock'),
  config: z.object({
    role: z.string().trim().min(1).max(200),
    goal: z.string().trim().min(1).max(500),
  }),
});

const toneBlockSchema = blockBaseSchema.extend({
  type: z.literal('ToneBlock'),
  config: z.object({
    tone: z.enum(['neutral', 'friendly', 'concise-business']),
    addressAs: z.enum(['ты', 'вы']),
    emojis: z.boolean(),
    responseLength: z.enum(['short', 'medium']),
  }),
});

const greetingBlockSchema = blockBaseSchema.extend({
  type: z.literal('GreetingBlock'),
  config: z.object({
    greetingText: z.string().trim().min(1).max(300),
    offerHelp: z.boolean(),
  }),
});

const productSearchBlockSchema = blockBaseSchema.extend({
  type: z.literal('ProductSearchBlock'),
  config: z.object({
    zeroResultsText: z.string().trim().min(1).max(300),
    multipleResultsText: z.string().trim().min(1).max(300),
    maxOptions: z.number().int().min(1).max(10),
  }),
});

const collectFieldBlockSchema = blockBaseSchema.extend({
  type: z.literal('CollectFieldBlock'),
  config: z.object({
    field: z.enum(['customerName', 'customerPhone', 'deliveryAddress', 'comment']),
    required: z.boolean(),
    questionStyle: z.enum(['short', 'detailed']),
  }),
});

const confirmationBlockSchema = blockBaseSchema.extend({
  type: z.literal('ConfirmationBlock'),
  config: z.object({
    requireExplicitConfirmation: z.boolean(),
    summaryFields: z
      .array(
        z.enum(['customerName', 'customerPhone', 'deliveryAddress', 'comment', 'items']),
      )
      .min(1)
      .max(5),
  }),
});

const createOrderBlockSchema = blockBaseSchema.extend({
  type: z.literal('CreateOrderBlock'),
  config: z.object({
    successTemplate: z.string().trim().min(1).max(300),
    includeOrderSummary: z.boolean(),
  }),
});

const statusCheckBlockSchema = blockBaseSchema.extend({
  type: z.literal('StatusCheckBlock'),
  config: z.object({
    allowStatusLookup: z.boolean(),
    successTemplate: z.string().trim().min(1).max(300),
  }),
});

const handoffBlockSchema = blockBaseSchema.extend({
  type: z.literal('HandoffBlock'),
  config: z.object({
    onExplicitRequest: z.boolean(),
    onComplaint: z.boolean(),
    onAmbiguity: z.boolean(),
    handoffMessage: z.string().trim().min(1).max(300),
  }),
});

const fallbackBlockSchema = blockBaseSchema.extend({
  type: z.literal('FallbackBlock'),
  config: z.object({
    fallbackText: z.string().trim().min(1).max(300),
    keepQuestionsShort: z.boolean(),
  }),
});

const forbiddenActionsBlockSchema = blockBaseSchema.extend({
  type: z.literal('ForbiddenActionsBlock'),
  config: z.object({
    forbidInventingProducts: z.boolean(),
    forbidInventingPrices: z.boolean(),
    forbidInventingStatuses: z.boolean(),
    russianOnly: z.boolean(),
  }),
});

const responseStyleBlockSchema = blockBaseSchema.extend({
  type: z.literal('ResponseStyleBlock'),
  config: z.object({
    bulletless: z.boolean(),
    askOneQuestionAtATime: z.boolean(),
    mentionOnlyKnownFacts: z.boolean(),
  }),
});

export const behaviorBlockSchema = z.discriminatedUnion('type', [
  personaBlockSchema,
  toneBlockSchema,
  greetingBlockSchema,
  productSearchBlockSchema,
  collectFieldBlockSchema,
  confirmationBlockSchema,
  createOrderBlockSchema,
  statusCheckBlockSchema,
  handoffBlockSchema,
  fallbackBlockSchema,
  forbiddenActionsBlockSchema,
  responseStyleBlockSchema,
]);

export const behaviorStageSchema = z.object({
  stageId: behaviorStageIdSchema,
  enabled: z.boolean(),
  blocks: z.array(behaviorBlockSchema),
});

export const behaviorDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  profileMeta: z.object({
    name: z.string().trim().min(1).max(120),
  }),
  stages: z.array(behaviorStageSchema).length(BEHAVIOR_STAGE_IDS.length),
});

export const createBehaviorProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).optional(),
  templateId: z.enum(['default', 'concise', 'handoff-first']).optional(),
});

export const updateBehaviorDraftSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  definition: behaviorDefinitionSchema,
});

export const previewBehaviorSchema = z.object({
  definition: behaviorDefinitionSchema,
});

export type BehaviorBlockDefinition = z.infer<typeof behaviorBlockSchema>;
export type BehaviorStageDefinition = z.infer<typeof behaviorStageSchema>;
export type BehaviorDefinition = z.infer<typeof behaviorDefinitionSchema>;
export type CreateBehaviorProfileInput = z.infer<typeof createBehaviorProfileSchema>;
export type UpdateBehaviorDraftInput = z.infer<typeof updateBehaviorDraftSchema>;
export type PreviewBehaviorInput = z.infer<typeof previewBehaviorSchema>;
