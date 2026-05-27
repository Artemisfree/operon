export const LLM_CLIENT = 'LLM_CLIENT';

export const CHAT_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'find_product',
      description: 'Finds products in the catalog by search query.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Product name or search query in Russian.',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_order',
      description:
        'Creates an order after product, quantity, address, phone, delivery slot when available, and confirmation are collected.',
      parameters: {
        type: 'object',
        properties: {
          customerName: { type: 'string' },
          customerPhone: { type: 'string' },
          deliveryAddress: { type: 'string' },
          comment: { type: 'string' },
          deliveryDate: {
            type: 'string',
            description: 'ISO datetime for delivery date if the storefront requires slots.',
          },
          deliverySlotStart: {
            type: 'string',
            description: 'ISO datetime for selected delivery slot start.',
          },
          deliverySlotEnd: {
            type: 'string',
            description: 'ISO datetime for selected delivery slot end.',
          },
          confirmed: { type: 'boolean' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productQuery: { type: 'string' },
                variantQuery: {
                  type: 'string',
                  description: 'Product variant name or size, when the catalog has variants.',
                },
                quantity: { type: 'integer' },
              },
              required: ['productQuery', 'quantity'],
              additionalProperties: false,
            },
          },
        },
        required: [
          'customerPhone',
          'deliveryAddress',
          'confirmed',
          'items',
        ],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_delivery_slots',
      description:
        'Returns available delivery slots for the connected storefront when the user asks about delivery time or a delivery slot is needed.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'integer',
            description: 'How many days to check, from today.',
          },
        },
        required: ['days'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_order_status',
      description: 'Returns the current status of an order.',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
        },
        required: ['orderId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_handoff',
      description: 'Transfers the conversation to a human operator.',
      parameters: {
        type: 'object',
        properties: {
          conversationId: { type: 'string' },
        },
        required: ['conversationId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'append_operator_note',
      description: 'Adds an internal note to an order for the operator.',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['orderId', 'text'],
        additionalProperties: false,
      },
    },
  },
] as const;

export const AI_SYSTEM_PROMPT = `
Ты AI-агент оформления заказов на русском языке.
Работай только на русском.
Никогда не выдумывай товары, цены или статусы.
Для поиска товаров используй только find_product.
Перед create_order обязательно получи и проверь:
- товар
- количество
- адрес доставки
- телефон
- если клиент выбирает дату/время доставки, используй list_delivery_slots и не выдумывай слоты
- явное подтверждение клиента
Если пользователь просит человека, оператора или ручной перехват, немедленно используй start_handoff.
Если обязательных полей не хватает, задай короткий уточняющий вопрос и не вызывай create_order.
`.trim();
