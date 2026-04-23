import { Injectable } from '@nestjs/common';

import {
  extractOrderContextFromText,
  extractProductQueryFromText,
  isExplicitConfirmation,
} from '../chat.order-context.js';
import type {
  ChatLlmClient,
  ChatLlmRequest,
  ChatLlmResponse,
  ChatToolCall,
} from '../chat.types.js';

type MockPromptBehavior = {
  greeting: string | null;
  fallback: string | null;
  handoffMessage: string | null;
  orderSuccess: string | null;
};

@Injectable()
export class MockLlmService implements ChatLlmClient {
  getModel() {
    return 'mock-llm';
  }

  async respond(input: ChatLlmRequest): Promise<ChatLlmResponse> {
    const promptBehavior = this.parsePromptBehavior(input.systemPrompt);

    if (input.toolResults?.length) {
      return this.respondWithToolResults(input, promptBehavior);
    }

    const lastUserMessage =
      [...input.messages].reverse().find((message) => message.role === 'user')
        ?.content ?? '';
    const shouldIncludeGreeting = !input.messages.some(
      (message) => message.role === 'assistant',
    );

    const lowerText = lastUserMessage.toLowerCase();

    if (
      lowerText.includes('оператор') ||
      lowerText.includes('человек') ||
      lowerText.includes('сотрудник')
    ) {
      return {
        reply: '',
        toolCalls: [
          {
            name: 'start_handoff',
            arguments: {
              conversationId: input.conversationId,
            },
          },
        ],
        model: this.getModel(),
      };
    }

    const orderData = this.extractOrderData(lastUserMessage, input.customerMeta);

    if (!orderData.productQuery) {
      return {
        reply: this.composeReply(
          shouldIncludeGreeting,
          promptBehavior,
          promptBehavior.fallback ?? 'Уточните, пожалуйста, какой товар вы хотите заказать.',
        ),
        toolCalls: [],
        model: this.getModel(),
      };
    }

    const missingFields = [];

    if (!orderData.quantity) {
      missingFields.push('количество');
    }

    if (!orderData.deliveryAddress) {
      missingFields.push('адрес доставки');
    }

    if (!orderData.customerPhone) {
      missingFields.push('телефон');
    }

    if (!orderData.confirmed) {
      missingFields.push('подтверждение заказа');
    }

    if (missingFields.length > 0) {
      return {
        reply: this.composeReply(
          shouldIncludeGreeting,
          promptBehavior,
          promptBehavior.fallback ??
            `Для оформления заказа мне нужны: ${missingFields.join(', ')}.`,
        ),
        toolCalls: [
          {
            name: 'find_product',
            arguments: {
              query: orderData.productQuery,
            },
          },
        ],
        model: this.getModel(),
      };
    }

    const toolCalls: ChatToolCall[] = [
      {
        name: 'find_product',
        arguments: {
          query: orderData.productQuery,
        },
      },
      {
        name: 'create_order',
        arguments: {
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          deliveryAddress: orderData.deliveryAddress,
          confirmed: true,
          items: [
            {
              productQuery: orderData.productQuery,
              quantity: orderData.quantity,
            },
          ],
        },
      },
    ];

    return {
      reply: '',
      toolCalls,
      model: this.getModel(),
    };
  }

  private respondWithToolResults(
    input: ChatLlmRequest,
    promptBehavior: MockPromptBehavior,
  ): ChatLlmResponse {
    const failedResult = input.toolResults?.find((result) => !result.success);

    if (failedResult) {
      return {
        reply:
          promptBehavior.fallback ??
          'Не удалось выполнить действие автоматически. Уточните данные заказа или попробуйте ещё раз.',
        toolCalls: [],
        model: this.getModel(),
      };
    }

    const handoffResult = input.toolResults?.find(
      (result) => result.name === 'start_handoff',
    );

    if (handoffResult) {
      return {
        reply:
          promptBehavior.handoffMessage ??
          'Передаю диалог оператору. Он подключится вручную.',
        toolCalls: [],
        model: this.getModel(),
      };
    }

    const orderResult = input.toolResults?.find(
      (result) => result.name === 'create_order',
    );

    if (orderResult) {
      const orderId = (orderResult.result as { id?: string } | undefined)?.id;
      const successTemplate =
        promptBehavior.orderSuccess ?? 'Заказ оформлен, номер {orderId}.';

      return {
        reply: this.formatOrderSuccessReply(successTemplate, orderId),
        toolCalls: [],
        model: this.getModel(),
      };
    }

    const statusResult = input.toolResults?.find(
      (result) => result.name === 'get_order_status',
    );

    if (statusResult) {
      const status = (statusResult.result as { status?: string } | undefined)
        ?.status;
      return {
        reply: `Текущий статус заказа: ${status ?? 'неизвестен'}.`,
        toolCalls: [],
        model: this.getModel(),
      };
    }

    const lastUserMessage =
      [...input.messages].reverse().find((message) => message.role === 'user')
        ?.content ?? '';
    const orderData = this.extractOrderData(lastUserMessage, input.customerMeta);
    const missingFields = [];

    if (orderData.productQuery) {
      if (!orderData.quantity) {
        missingFields.push('количество');
      }

      if (!orderData.deliveryAddress) {
        missingFields.push('адрес доставки');
      }

      if (!orderData.customerPhone) {
        missingFields.push('телефон');
      }

      if (!orderData.confirmed) {
        missingFields.push('подтверждение заказа');
      }
    }

    if (missingFields.length > 0) {
      return {
        reply:
          promptBehavior.fallback ??
          `Для оформления заказа мне нужны: ${missingFields.join(', ')}.`,
        toolCalls: [],
        model: this.getModel(),
      };
    }

    return {
      reply: 'Запрос обработан.',
      toolCalls: [],
      model: this.getModel(),
    };
  }

  private parsePromptBehavior(systemPrompt: string): MockPromptBehavior {
    const lines = systemPrompt
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const greetingLineIndex = lines.findIndex((line) => line === 'Приветствие');
    const greeting =
      greetingLineIndex >= 0
        ? lines[greetingLineIndex + 1]
            ?.replace(/\s+Сразу предложи помочь с оформлением заказа\.$/, '')
            .trim() ?? null
        : null;

    const fallbackLine = lines.find((line) =>
      line.startsWith('Если данных недостаточно, используй fallback: ') ||
      line.startsWith('Если данных не хватает, используй fallback: '),
    );
    const handoffLine = lines.find((line) => line.includes('Перед handoff сообщай: '));
    const successLine = lines.find((line) =>
      line.startsWith('Вызывай create_order только после сбора обязательных данных.'),
    );

    return {
      greeting,
      fallback:
        fallbackLine
          ?.replace('Если данных недостаточно, используй fallback: ', '')
          .replace('Если данных не хватает, используй fallback: ', '')
          .replace(/\. Задавай один короткий вопрос за раз\.$/, '')
          .replace(/\. Можешь задавать развёрнутые уточнения\.$/, '')
          .trim() ?? null,
      handoffMessage:
        handoffLine
          ?.split('Перед handoff сообщай: ')[1]
          ?.replace(/\.$/, '')
          .trim() ?? null,
      orderSuccess:
        successLine
          ?.split('После успешного создания заказа: ')[1]
          ?.replace(/\. В ответе кратко повторяй состав заказа\.$/, '')
          .replace(/\.$/, '')
          .trim() ?? null,
    };
  }

  private composeReply(
    shouldIncludeGreeting: boolean,
    promptBehavior: MockPromptBehavior,
    fallbackText: string,
  ) {
    if (shouldIncludeGreeting && promptBehavior.greeting) {
      return `${promptBehavior.greeting} ${fallbackText}`.trim();
    }

    return fallbackText;
  }

  private formatOrderSuccessReply(template: string, orderId?: string) {
    const withOrderId = template
      .replace('{orderId}', orderId ?? '')
      .replace('{order_id}', orderId ?? '');

    if (withOrderId !== template) {
      return withOrderId.trim();
    }

    if (orderId) {
      return `${template.replace(/\.$/, '')}: ${orderId}.`;
    }

    return template;
  }

  private extractOrderData(
    text: string,
    customerMeta?: Record<string, unknown>,
  ) {
    const quantityMatch = text.match(/(?:заказать|нужно|хочу)\s+(\d+)/i);
    const phoneMatch = text.match(/(?:телефон|номер)\s*[:\-]?\s*(\+?[0-9()\-\s]{10,})/i);
    const addressMatch = text.match(/адрес\s*[:\-]?\s*([^.\n]+)/i);
    let productQuery = extractProductQueryFromText(text);
    // Ответ только названием товара («Капучино 300 мл») без «хочу заказать» не ловится regex — подставляем префикс.
    if (!productQuery && text.trim()) {
      productQuery = extractProductQueryFromText(`хочу ${text.trim()}`);
    }
    return {
      customerName:
        typeof customerMeta?.name === 'string' ? customerMeta.name : 'Гость',
      ...extractOrderContextFromText(text, {
        customerPhone:
          typeof customerMeta?.phone === 'string' ? customerMeta.phone : '',
      }),
      productQuery,
      confirmed: isExplicitConfirmation(text),
    };
  }
}
