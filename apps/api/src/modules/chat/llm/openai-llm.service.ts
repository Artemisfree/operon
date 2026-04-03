import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import {
  AI_SYSTEM_PROMPT,
  CHAT_TOOL_DEFINITIONS,
} from '../chat.constants.js';
import type {
  ChatLlmClient,
  ChatLlmRequest,
  ChatLlmResponse,
} from '../chat.types.js';

@Injectable()
export class OpenAiLlmService implements ChatLlmClient {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  getModel() {
    return this.configService.get<string>('ai.openaiModel') ?? 'gpt-4.1-mini';
  }

  async respond(input: ChatLlmRequest): Promise<ChatLlmResponse> {
    const apiKey = this.configService.get<string>('ai.openaiApiKey') ?? '';
    const baseURL =
      this.configService.get<string>('ai.openaiBaseUrl') ??
      'https://api.openai.com/v1';
    const timeoutSeconds =
      this.configService.get<number>('ai.openaiTimeoutSeconds') ?? 45;

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is required when AI_PROVIDER=openai',
      );
    }

    const client = new OpenAI({
      apiKey,
      baseURL,
      timeout: timeoutSeconds * 1000,
    });

    if (input.toolResults?.length) {
      const completion = await client.chat.completions.create({
        model: this.getModel(),
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content:
              `${AI_SYSTEM_PROMPT}\nСформируй итоговый ответ пользователю на основе результатов tool execution.`,
          },
          ...input.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          {
            role: 'system',
            content: `Результаты инструментов: ${JSON.stringify(
              input.toolResults,
            )}`,
          },
        ],
      });

      return {
        reply: completion.choices[0]?.message?.content ?? '',
        toolCalls: [],
        model: this.getModel(),
      };
    }

    const completion = await client.chat.completions.create({
      model: this.getModel(),
      temperature: 0.1,
      tool_choice: 'auto',
      tools: CHAT_TOOL_DEFINITIONS as unknown as OpenAI.Chat.Completions.ChatCompletionTool[],
      messages: [
        {
          role: 'system',
          content: AI_SYSTEM_PROMPT,
        },
        ...input.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    });

    const message = completion.choices[0]?.message;

    return {
      reply: message?.content ?? '',
      toolCalls:
        message?.tool_calls?.map((toolCall) => ({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments),
        })) ?? [],
      model: this.getModel(),
    };
  }
}
