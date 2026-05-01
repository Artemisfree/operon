import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { compileBehaviorPrompt } from '../src/modules/chat-behavior/chat-behavior.compiler.js';
import { createDefaultBehaviorDefinition } from '../src/modules/chat-behavior/chat-behavior.defaults.js';

describe('chat behavior compiler', () => {
  it('compiles the default definition without validation errors', () => {
    const definition = createDefaultBehaviorDefinition('Основной');
    const result = compileBehaviorPrompt(definition);

    assert.equal(result.errors.length, 0);
    assert.ok(result.compiledPrompt.includes('Передача оператору'));
    assert.ok(result.activeBlocks.length >= 1);
  });

  it('reports missing required create_order prerequisites', () => {
    const definition = createDefaultBehaviorDefinition('Сломанный');
    const collectStage = definition.stages.find((stage) => stage.stageId === 'collect-data');
    const confirmationStage = definition.stages.find(
      (stage) => stage.stageId === 'confirmation',
    );

    if (!collectStage || !confirmationStage) {
      throw new Error('Default definition is malformed');
    }

    collectStage.blocks = collectStage.blocks.filter(
      (block) =>
        block.type !== 'CollectFieldBlock' ||
        !['customerPhone', 'deliveryAddress'].includes(String(block.config.field)),
    );
    confirmationStage.blocks = [];

    const result = compileBehaviorPrompt(definition);

    assert.ok(
      result.errors.some((message) => message.includes('телефон')),
      'expected phone validation error',
    );
    assert.ok(
      result.errors.some((message) => message.includes('адрес доставки')),
      'expected address validation error',
    );
    assert.ok(
      result.errors.some((message) => message.includes('ConfirmationBlock')),
      'expected confirmation validation error',
    );
  });
});
