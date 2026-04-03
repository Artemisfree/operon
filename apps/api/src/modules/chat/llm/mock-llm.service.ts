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

@Injectable()
export class MockLlmService implements ChatLlmClient {
  getModel() {
    return 'mock-llm';
  }

  async respond(input: ChatLlmRequest): Promise<ChatLlmResponse> {
    if (input.toolResults?.length) {
      return this.respondWithToolResults(input);
    }

    const lastUserMessage =
      [...input.messages].reverse().find((message) => message.role === 'user')
        ?.content ?? '';

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
        reply: 'Уточните, пожалуйста, какой товар вы хотите заказать.',
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
        reply: `Для оформления заказа мне нужны: ${missingFields.join(', ')}.`,
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

  private respondWithToolResults(input: ChatLlmRequest): ChatLlmResponse {
    const failedResult = input.toolResults?.find((result) => !result.success);

    if (failedResult) {
      return {
        reply:
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
        reply: 'Передаю диалог оператору. Он подключится вручную.',
        toolCalls: [],
        model: this.getModel(),
      };
    }

    const orderResult = input.toolResults?.find(
      (result) => result.name === 'create_order',
    );

    if (orderResult) {
      const orderId = (orderResult.result as { id?: string } | undefined)?.id;

      return {
        reply: `Заказ оформлен${orderId ? `, номер ${orderId}` : ''}.`,
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
        reply: `Для оформления заказа мне нужны: ${missingFields.join(', ')}.`,
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

  private extractOrderData(
    text: string,
    customerMeta?: Record<string, unknown>,
  ) {
    const quantityMatch = text.match(/(?:заказать|нужно|хочу)\s+(\d+)/i);
    const phoneMatch = text.match(/(?:телефон|номер)\s*[:\-]?\s*(\+?[0-9()\-\s]{10,})/i);
    const addressMatch = text.match(/адрес\s*[:\-]?\s*([^.\n]+)/i);
    return {
      customerName:
        typeof customerMeta?.name === 'string' ? customerMeta.name : 'Гость',
      ...extractOrderContextFromText(text, {
        customerPhone:
          typeof customerMeta?.phone === 'string' ? customerMeta.phone : '',
      }),
      productQuery: extractProductQueryFromText(text),
      confirmed: isExplicitConfirmation(text),
    };
  }
}
