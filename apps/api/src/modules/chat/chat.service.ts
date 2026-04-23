import { Inject, Injectable } from '@nestjs/common';
import { MessageRole } from '@prisma/client';

import { serializeValue } from '../../common/serialization.js';
import { ChatBehaviorService } from '../chat-behavior/chat-behavior.service.js';
import { PrismaService } from '../db/prisma.service.js';
import type {
  ChatMessageInput,
  MessagesQueryInput,
  OperatorMessageInput,
} from './chat.schemas.js';
import { ChatOrchestratorService } from './chat.orchestrator.js';
import { ChatToolService } from './chat.tool-service.js';

@Injectable()
export class ChatService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChatBehaviorService)
    private readonly chatBehaviorService: ChatBehaviorService,
    @Inject(ChatOrchestratorService)
    private readonly orchestrator: ChatOrchestratorService,
    @Inject(ChatToolService) private readonly chatToolService: ChatToolService,
  ) {}

  async handleMessage(input: ChatMessageInput) {
    const conversation = input.conversation_id
      ? await this.prisma.conversation.update({
          where: { id: input.conversation_id },
          data: {
            ...(input.customer_meta?.name
              ? { customerName: input.customer_meta.name }
              : {}),
            ...(input.customer_meta?.phone
              ? { customerPhone: input.customer_meta.phone }
              : {}),
          },
        })
      : await this.prisma.conversation.create({
          data: {
            customerName: input.customer_meta?.name,
            customerPhone: input.customer_meta?.phone,
            behaviorVersionId:
              await this.chatBehaviorService.getDefaultPublishedBehaviorVersionId(),
          },
        });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: input.text,
      },
    });

    if (conversation.handoffState === 'operator') {
      return {
        conversation_id: conversation.id,
        reply: '',
        agent_actions: [],
        handoff_state: 'operator',
      };
    }

    const response = await this.orchestrator.process({
      conversationId: conversation.id,
      customerMeta: input.customer_meta,
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: response.reply,
      },
    });

    return {
      conversation_id: conversation.id,
      reply: response.reply,
      agent_actions: response.agentActions,
      handoff_state: response.handoffState,
    };
  }

  async startHandoff(conversationId: string) {
    const conversation = await this.chatToolService.startHandoff(conversationId);

    return {
      conversation_id: conversationId,
      handoff_state: 'operator',
      conversation: serializeValue(conversation),
    };
  }

  async stopHandoff(conversationId: string) {
    const conversation = await this.chatToolService.stopHandoff(conversationId);

    return {
      conversation_id: conversationId,
      handoff_state: 'ai',
      conversation: serializeValue(conversation),
    };
  }

  async getMessages(conversationId: string, query?: MessagesQueryInput) {
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(query?.since
          ? {
              createdAt: {
                gt: new Date(query.since),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
    });

    return {
      conversation_id: conversationId,
      handoff_state: conversation.handoffState,
      messages: serializeValue(messages),
    };
  }

  async listConversations() {
    const conversations = await this.prisma.conversation.findMany({
      include: {
        messages: {
          where: {
            role: {
              not: MessageRole.tool,
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      customerName: conversation.customerName,
      customerPhone: conversation.customerPhone,
      handoffState: conversation.handoffState,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      lastMessage: conversation.messages[0]
        ? serializeValue(conversation.messages[0])
        : null,
    }));
  }

  async getConversationDetails(conversationId: string) {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        messages: {
          where: {
            role: {
              not: MessageRole.tool,
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return serializeValue(conversation);
  }

  async postOperatorMessage(
    conversationId: string,
    input: OperatorMessageInput,
    adminEmail: string,
  ) {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
    });

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'operator',
        content: input.text,
        metadata: {
          operatorEmail: adminEmail,
          handoffState: conversation.handoffState,
        },
      },
    });

    return {
      conversation_id: conversationId,
      message: serializeValue(message),
    };
  }
}
