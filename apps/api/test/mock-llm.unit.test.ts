import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { compileBehaviorPrompt } from '../src/modules/chat-behavior/chat-behavior.compiler.js';
import { createDefaultBehaviorDefinition } from '../src/modules/chat-behavior/chat-behavior.defaults.js';
import { MockLlmService } from '../src/modules/chat/llm/mock-llm.service.js';

describe('mock llm uses compiled behavior prompt', () => {
  const mock = new MockLlmService();

  it('uses greeting and fallback text from compiled prompt', async () => {
    const definition = createDefaultBehaviorDefinition('Тест');
    const greetingBlock = definition.stages
      .find((stage) => stage.stageId === 'greeting')
      ?.blocks.find((block) => block.type === 'GreetingBlock');
    const fallbackBlock = definition.stages
      .find((stage) => stage.stageId === 'fallback')
      ?.blocks.find((block) => block.type === 'FallbackBlock');

    if (!greetingBlock || !fallbackBlock) {
      throw new Error('Missing greeting or fallback block in default definition');
    }

    greetingBlock.config.greetingText = 'ТЕСТОВОЕ_ПРИВЕТСТВИЕ';
    fallbackBlock.config.fallbackText = 'ТЕСТОВЫЙ_FALLBACK';

    const prompt = compileBehaviorPrompt(definition).compiledPrompt;

    const response = await mock.respond({
      conversationId: 'conv-1',
      systemPrompt: prompt,
      messages: [{ role: 'user', content: 'Привет' }],
    });

    assert.match(response.reply, /ТЕСТОВОЕ_ПРИВЕТСТВИЕ/);
    assert.match(response.reply, /ТЕСТОВЫЙ_FALLBACK/);
  });

  it('uses handoff and success messages from compiled prompt', async () => {
    const definition = createDefaultBehaviorDefinition('Тест');
    const handoffBlock = definition.stages
      .find((stage) => stage.stageId === 'handoff')
      ?.blocks.find((block) => block.type === 'HandoffBlock');
    const createOrderBlock = definition.stages
      .find((stage) => stage.stageId === 'create-order')
      ?.blocks.find((block) => block.type === 'CreateOrderBlock');

    if (!handoffBlock || !createOrderBlock) {
      throw new Error('Missing handoff or create-order block in default definition');
    }

    handoffBlock.config.handoffMessage = 'ТЕСТОВЫЙ_HANDOFF';
    createOrderBlock.config.successTemplate = 'ТЕСТОВЫЙ_УСПЕХ {orderId}';

    const prompt = compileBehaviorPrompt(definition).compiledPrompt;

    const handoffResponse = await mock.respond({
      conversationId: 'conv-2',
      systemPrompt: prompt,
      messages: [{ role: 'user', content: 'Нужен оператор' }],
      toolResults: [{ name: 'start_handoff', success: true }],
    });

    assert.equal(handoffResponse.reply, 'ТЕСТОВЫЙ_HANDOFF');

    const successResponse = await mock.respond({
      conversationId: 'conv-3',
      systemPrompt: prompt,
      messages: [{ role: 'user', content: 'Подтверждаю заказ' }],
      toolResults: [
        {
          name: 'create_order',
          success: true,
          result: { id: 'order-123' },
        },
      ],
    });

    assert.equal(successResponse.reply, 'ТЕСТОВЫЙ_УСПЕХ order-123');
  });
});
