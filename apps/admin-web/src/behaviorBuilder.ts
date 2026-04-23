import { createBlock } from './behaviorBlocks';
import type {
  BehaviorBlockDefinition,
  BehaviorBlockType,
  BehaviorDefinition,
  BehaviorStageId,
} from './behaviorTypes';

function cloneDefinition(definition: BehaviorDefinition): BehaviorDefinition {
  return JSON.parse(JSON.stringify(definition)) as BehaviorDefinition;
}

export function addBlockToStage(
  definition: BehaviorDefinition,
  stageId: BehaviorStageId,
  type: BehaviorBlockType,
) {
  const next = cloneDefinition(definition);
  const stage = next.stages.find((entry) => entry.stageId === stageId);

  if (!stage) {
    return next;
  }

  const maxOrder = stage.blocks.reduce(
    (currentMax, block) => Math.max(currentMax, block.order),
    0,
  );
  stage.blocks.push(createBlock(type, maxOrder + 10));

  return next;
}

export function updateBlock(
  definition: BehaviorDefinition,
  blockId: string,
  updater: (block: BehaviorBlockDefinition) => BehaviorBlockDefinition,
) {
  const next = cloneDefinition(definition);

  for (const stage of next.stages) {
    const index = stage.blocks.findIndex((block) => block.id === blockId);
    if (index >= 0) {
      const currentBlock = stage.blocks[index];
      if (currentBlock) {
        stage.blocks[index] = updater(currentBlock);
      }
      break;
    }
  }

  return next;
}

export function removeBlock(definition: BehaviorDefinition, blockId: string) {
  const next = cloneDefinition(definition);

  for (const stage of next.stages) {
    stage.blocks = stage.blocks.filter((block) => block.id !== blockId);
  }

  return next;
}

export function moveBlock(
  definition: BehaviorDefinition,
  stageId: BehaviorStageId,
  blockId: string,
  direction: 'up' | 'down',
) {
  const next = cloneDefinition(definition);
  const stage = next.stages.find((entry) => entry.stageId === stageId);

  if (!stage) {
    return next;
  }

  const blocks = [...stage.blocks].sort((left, right) => left.order - right.order);
  const index = blocks.findIndex((block) => block.id === blockId);

  if (index < 0) {
    return next;
  }

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= blocks.length) {
    return next;
  }

  const current = blocks[index];
  const target = blocks[swapIndex];
  if (!current || !target) {
    return next;
  }

  const currentOrder = current.order;
  current.order = target.order;
  target.order = currentOrder;

  stage.blocks = blocks;
  return next;
}

export function toggleStage(
  definition: BehaviorDefinition,
  stageId: BehaviorStageId,
  enabled: boolean,
) {
  const next = cloneDefinition(definition);
  const stage = next.stages.find((entry) => entry.stageId === stageId);

  if (stage) {
    stage.enabled = enabled;
  }

  return next;
}

export function findBlock(
  definition: BehaviorDefinition,
  blockId: string | null,
): { stageId: BehaviorStageId; block: BehaviorBlockDefinition } | null {
  if (!blockId) {
    return null;
  }

  for (const stage of definition.stages) {
    const block = stage.blocks.find((entry) => entry.id === blockId);
    if (block) {
      return {
        stageId: stage.stageId,
        block,
      };
    }
  }

  return null;
}
