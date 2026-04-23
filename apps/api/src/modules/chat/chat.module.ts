import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ChatBehaviorModule } from '../chat-behavior/chat-behavior.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { ProductsModule } from '../products/products.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ChatAdminController } from './chat-admin.controller.js';
import { ChatController } from './chat.controller.js';
import { LLM_CLIENT } from './chat.constants.js';
import { ChatOrchestratorService } from './chat.orchestrator.js';
import { ChatService } from './chat.service.js';
import { ChatToolService } from './chat.tool-service.js';
import { MockLlmService } from './llm/mock-llm.service.js';
import { OpenAiLlmService } from './llm/openai-llm.service.js';

@Module({
  imports: [AuthModule, ProductsModule, OrdersModule, ChatBehaviorModule],
  controllers: [ChatController, ChatAdminController],
  providers: [
    ChatService,
    ChatToolService,
    ChatOrchestratorService,
    MockLlmService,
    OpenAiLlmService,
    {
      provide: LLM_CLIENT,
      inject: [ConfigService, MockLlmService, OpenAiLlmService],
      useFactory: (
        configService: ConfigService,
        mockLlmService: MockLlmService,
        openAiLlmService: OpenAiLlmService,
      ) => {
        const provider = configService.get<string>('ai.provider') ?? 'openai';
        return provider === 'mock' ? mockLlmService : openAiLlmService;
      },
    },
  ],
})
export class ChatModule {}
