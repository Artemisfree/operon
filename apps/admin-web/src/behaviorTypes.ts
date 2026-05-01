export const BEHAVIOR_STAGE_ORDER = [
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

export type BehaviorStageId = (typeof BEHAVIOR_STAGE_ORDER)[number];
export type BehaviorBlockType =
  | 'PersonaBlock'
  | 'ToneBlock'
  | 'GreetingBlock'
  | 'ProductSearchBlock'
  | 'CollectFieldBlock'
  | 'ConfirmationBlock'
  | 'CreateOrderBlock'
  | 'StatusCheckBlock'
  | 'HandoffBlock'
  | 'FallbackBlock'
  | 'ForbiddenActionsBlock'
  | 'ResponseStyleBlock';

export type BehaviorBlockDefinition = {
  id: string;
  type: BehaviorBlockType;
  enabled: boolean;
  order: number;
  config: Record<string, boolean | number | string | string[]>;
};

export type BehaviorStageDefinition = {
  stageId: BehaviorStageId;
  enabled: boolean;
  blocks: BehaviorBlockDefinition[];
};

export type BehaviorDefinition = {
  schemaVersion: 1;
  profileMeta: {
    name: string;
  };
  stages: BehaviorStageDefinition[];
};

export type BehaviorPreview = {
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

export type BehaviorProfileListItem = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isDefault: boolean;
  updatedAt: string;
  publishedVersion: null | {
    id: string;
    version: number;
    publishedAt: string | null;
  };
  draftVersion: null | {
    id: string;
    version: number;
  };
};

export type BehaviorProfileDetail = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isDefault: boolean;
  draft: {
    id: string;
    version: number;
    definition: BehaviorDefinition;
    compiledPrompt: string;
  };
  published: null | {
    id: string;
    version: number;
    definition: BehaviorDefinition;
    compiledPrompt: string;
    publishedAt: string | null;
  };
  preview: BehaviorPreview;
};

export type BehaviorVersionRecord = {
  id: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  createdBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
