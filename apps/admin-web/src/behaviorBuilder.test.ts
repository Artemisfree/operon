import { describe, expect, it } from 'vitest';

import {
  addBlockToStage,
  findBlock,
  moveBlock,
  removeBlock,
  toggleStage,
  updateBlock,
} from './behaviorBuilder';
import { createEmptyBehaviorDefinition } from './behaviorBlocks';

describe('behaviorBuilder', () => {
  it('adds a block to the selected stage', () => {
    const definition = createEmptyBehaviorDefinition('Тест');
    const next = addBlockToStage(definition, 'handoff', 'HandoffBlock');

    expect(next.stages.find((stage) => stage.stageId === 'handoff')?.blocks).toHaveLength(1);
    expect(
      next.stages.find((stage) => stage.stageId === 'handoff')?.blocks[0]?.type,
    ).toBe('HandoffBlock');
  });

  it('updates and removes a block', () => {
    const definition = addBlockToStage(
      createEmptyBehaviorDefinition('Тест'),
      'intent',
      'PersonaBlock',
    );
    const blockId = definition.stages.find((stage) => stage.stageId === 'intent')?.blocks[0]
      ?.id as string;

    const updated = updateBlock(definition, blockId, (block) => ({
      ...block,
      config: {
        ...block.config,
        role: 'Новый агент',
      },
    }));

    expect(findBlock(updated, blockId)?.block.config.role).toBe('Новый агент');

    const removed = removeBlock(updated, blockId);
    expect(findBlock(removed, blockId)).toBeNull();
  });

  it('moves blocks inside a stage and toggles a stage', () => {
    let definition = createEmptyBehaviorDefinition('Тест');
    definition = addBlockToStage(definition, 'fallback', 'FallbackBlock');
    definition = addBlockToStage(definition, 'fallback', 'ForbiddenActionsBlock');

    const fallbackStage = definition.stages.find((stage) => stage.stageId === 'fallback');
    const secondId = fallbackStage?.blocks
      .slice()
      .sort((left, right) => left.order - right.order)[1]?.id as string;

    const moved = moveBlock(definition, 'fallback', secondId, 'up');
    const orderedTypes = moved.stages
      .find((stage) => stage.stageId === 'fallback')
      ?.blocks.slice()
      .sort((left, right) => left.order - right.order)
      .map((block) => block.type);

    expect(orderedTypes).toEqual(['ForbiddenActionsBlock', 'FallbackBlock']);

    const toggled = toggleStage(moved, 'fallback', false);
    expect(toggled.stages.find((stage) => stage.stageId === 'fallback')?.enabled).toBe(
      false,
    );
  });
});
