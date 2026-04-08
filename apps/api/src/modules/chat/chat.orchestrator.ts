import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { serializeValue } from '../../common/serialization.js';
import { PrismaService } from '../db/prisma.service.js';
import { LLM_CLIENT } from './chat.constants.js';
import {
  extractOrderContextFromText,
  extractProductQueryFromText,
  isExplicitConfirmation,
} from './chat.order-context.js';
import { ChatToolService } from './chat.tool-service.js';
import type {
  ChatLlmClient,
  ChatLlmMessage,
  ChatToolResult,
} from './chat.types.js';

@Injectable()
export class ChatOrchestratorService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChatToolService) private readonly chatToolService: ChatToolService,
    @Inject(LLM_CLIENT) private readonly llmClient: ChatLlmClient,
  ) {}

  async process(input: {
    conversationId: string;
    customerMeta?: Record<string, unknown>;
  }) {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: input.conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const messages: ChatLlmMessage[] = conversation.messages
      .filter((message) => message.role !== 'tool')
      .map((message) => ({
        role: this.mapRole(message.role),
        content: message.content,
      }));

    try {
      const deterministicResponse = await this.tryCreateOrderFromConfirmation(
        conversation,
        input.customerMeta,
      );

      if (deterministicResponse) {
        return deterministicResponse;
      }

      const initialResponse = await this.llmClient.respond({
        messages,
        conversationId: conversation.id,
        customerMeta: input.customerMeta,
      });

      const toolResults: ChatToolResult[] = [];
      const agentActions = [];

      for (const toolCall of initialResponse.toolCalls) {
        try {
          const toolArgs =
            toolCall.name === 'create_order'
              ? {
                  ...toolCall.arguments,
                  conversationId: conversation.id,
                }
              : toolCall.arguments;
          const result = await this.chatToolService.executeTool(
            toolCall.name,
            toolArgs,
          );

          const serializedResult = serializeValue(result);
          toolResults.push({
            toolCallId: toolCall.id,
            name: toolCall.name,
            success: true,
            result: serializedResult,
          });
          agentActions.push({
            type: 'tool_call',
            tool: toolCall.name,
            status: 'succeeded',
            result: serializedResult,
          });

          await this.prisma.aiActionLog.create({
            data: {
              conversationId: conversation.id,
              actionType: 'tool_call',
              toolName: toolCall.name,
              status: 'succeeded',
              model: initialResponse.model,
              input: toolCall.arguments as Prisma.InputJsonValue,
              output: serializedResult as Prisma.InputJsonValue,
            },
          });

          await this.prisma.message.create({
            data: {
              conversationId: conversation.id,
              role: 'tool',
              content: JSON.stringify({
                tool: toolCall.name,
                result: serializedResult,
              }),
            },
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown tool error';

          toolResults.push({
            toolCallId: toolCall.id,
            name: toolCall.name,
            success: false,
            error: errorMessage,
          });
          agentActions.push({
            type: 'tool_call',
            tool: toolCall.name,
            status: 'failed',
            error: errorMessage,
          });

          await this.prisma.aiActionLog.create({
            data: {
              conversationId: conversation.id,
              actionType: 'tool_call',
              toolName: toolCall.name,
              status: 'failed',
              model: initialResponse.model,
              input: toolCall.arguments as Prisma.InputJsonValue,
              error: errorMessage,
            },
          });
        }
      }

      const followupResponse = toolResults.length
        ? await this.llmClient.respond({
            messages,
            conversationId: conversation.id,
            customerMeta: input.customerMeta,
            toolResults,
          })
        : initialResponse;

      const refreshedConversation = await this.prisma.conversation.findUniqueOrThrow({
        where: { id: conversation.id },
      });

      return {
        reply:
          followupResponse.reply ||
          'Не удалось сформировать ответ. Попробуйте ещё раз.',
        agentActions,
        handoffState: refreshedConversation.handoffState,
      };
    } catch (error) {
      await this.prisma.aiActionLog.create({
        data: {
          conversationId: conversation.id,
          actionType: 'orchestrator_failure',
          status: 'failed',
          model: this.llmClient.getModel(),
          error:
            error instanceof Error
              ? error.message
              : 'Unknown orchestrator failure',
        },
      });

      throw new InternalServerErrorException(
        'AI orchestration failed. Please try again later.',
      );
    }
  }

  private mapRole(role: string): ChatLlmMessage['role'] {
    if (role === 'assistant' || role === 'system' || role === 'tool') {
      return role;
    }

    return 'user';
  }

  private async tryCreateOrderFromConfirmation(
    conversation: {
      id: string;
      handoffState: string;
      customerName: string | null;
      customerPhone: string | null;
      messages: Array<{
        role: string;
        content: string;
      }>;
    },
    customerMeta?: Record<string, unknown>,
  ) {
    const userMessages = conversation.messages.filter(
      (message) => message.role === 'user',
    );
    const lastUserMessage = userMessages.at(-1)?.content ?? '';

    if (!isExplicitConfirmation(lastUserMessage)) {
      return null;
    }

    const existingCreateOrderLog = await this.prisma.aiActionLog.findFirst({
      where: {
        conversationId: conversation.id,
        toolName: 'create_order',
        status: 'succeeded',
      },
    });

    if (existingCreateOrderLog) {
      return null;
    }

    const latestFindProductMessage = [...conversation.messages]
      .reverse()
      .find((message) => {
        if (message.role !== 'tool') {
          return false;
        }

        try {
          const parsed = JSON.parse(message.content) as {
            tool?: string;
            result?: Array<{ name?: string }>;
          };
          return parsed.tool === 'find_product';
        } catch {
          return false;
        }
      });

    let toolPayload: {
      result?: Array<{ name?: string }>;
    } | null = null;

    if (latestFindProductMessage) {
      try {
        toolPayload = JSON.parse(latestFindProductMessage.content) as {
          result?: Array<{ name?: string }>;
        };
      } catch {
        toolPayload = null;
      }
    }

    const aggregatedUserText = userMessages.map((message) => message.content).join('\n');
    const orderContext = extractOrderContextFromText(aggregatedUserText, {
      customerPhone:
        typeof customerMeta?.phone === 'string'
          ? customerMeta.phone
          : conversation.customerPhone,
    });
    const matchedProducts = toolPayload?.result ?? [];
    const singleMatch = matchedProducts[0];
    const productQuery =
      matchedProducts.length === 1 && singleMatch?.name
        ? singleMatch.name
        : extractProductQueryFromText(aggregatedUserText);

    if (
      !productQuery ||
      !orderContext.quantity ||
      !orderContext.customerPhone ||
      !orderContext.deliveryAddress
    ) {
      return null;
    }

    const result = await this.chatToolService.createOrder({
      customerName:
        (typeof customerMeta?.name === 'string'
          ? customerMeta.name
          : conversation.customerName) ?? 'Гость',
      customerPhone: orderContext.customerPhone,
      deliveryAddress: orderContext.deliveryAddress,
      confirmed: true,
      conversationId: conversation.id,
      items: [
        {
          productQuery,
          quantity: orderContext.quantity,
        },
      ],
    });

    const serializedResult = serializeValue(result);

    await this.prisma.aiActionLog.create({
      data: {
        conversationId: conversation.id,
        actionType: 'tool_call',
        toolName: 'create_order',
        status: 'succeeded',
        model: `${this.llmClient.getModel()}:deterministic-confirmation`,
        input: {
          productQuery,
          quantity: orderContext.quantity,
          customerPhone: orderContext.customerPhone,
          deliveryAddress: orderContext.deliveryAddress,
        } as Prisma.InputJsonValue,
        output: serializedResult as Prisma.InputJsonValue,
      },
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'tool',
        content: JSON.stringify({
          tool: 'create_order',
          result: serializedResult,
        }),
      },
    });

    return {
      reply: `Заказ оформлен, номер ${(serializedResult as { id?: string }).id ?? ''}.`,
      agentActions: [
        {
          type: 'tool_call',
          tool: 'create_order',
          status: 'succeeded',
          result: serializedResult,
        },
      ],
      handoffState: conversation.handoffState,
    };
  }
}
