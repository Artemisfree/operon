import { hash } from 'bcryptjs';
import {
  HandoffState,
  MessageRole,
  OrderStatus,
  Prisma,
  PrismaClient,
  ReviewRequestStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_COURIERS = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    displayName: 'Демо-курьер',
    phone: '+79990001122',
    token: 'courier-dev-token',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    displayName: 'Курьер Анна',
    phone: '+79990001123',
    token: 'courier-anna-token',
  },
] as const;

const DEMO_PRODUCTS = [
  {
    name: 'Капучино 300 мл',
    description: 'Классический капучино на молоке',
    price: new Prisma.Decimal('220.00'),
  },
  {
    name: 'Латте 400 мл',
    description: 'Мягкий кофе с увеличенной порцией молока',
    price: new Prisma.Decimal('260.00'),
  },
  {
    name: 'Раф 300 мл',
    description: 'Сливочный кофе',
    price: new Prisma.Decimal('250.00'),
  },
  {
    name: 'Сэндвич с индейкой',
    description: 'Горячий сэндвич с индейкой и сыром',
    price: new Prisma.Decimal('340.00'),
  },
  {
    name: 'Чизкейк',
    description: 'Порционный десерт',
    price: new Prisma.Decimal('290.00'),
  },
  {
    name: 'Апельсиновый фреш',
    description: 'Свежевыжатый сок 300 мл',
    price: new Prisma.Decimal('310.00'),
  },
] as const;

const DEMO_CONVERSATION_IDS = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005',
] as const;

const DEMO_ORDER_IDS = [
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000006',
  '20000000-0000-4000-8000-000000000007',
] as const;

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function upsertAdminUser() {
  const passwordHash = await hash('admin12345', 10);

  await prisma.adminUser.upsert({
    where: { email: 'admin@operon.local' },
    update: {
      passwordHash,
      role: 'admin',
    },
    create: {
      email: 'admin@operon.local',
      passwordHash,
      role: 'admin',
    },
  });
}

async function upsertCouriers() {
  for (const courier of DEMO_COURIERS) {
    const tokenHash = await hash(courier.token, 10);

    await prisma.courier.upsert({
      where: { id: courier.id },
      update: {
        displayName: courier.displayName,
        phone: courier.phone,
        isActive: true,
        apiTokenHash: tokenHash,
      },
      create: {
        id: courier.id,
        displayName: courier.displayName,
        phone: courier.phone,
        isActive: true,
        apiTokenHash: tokenHash,
      },
    });
  }
}

async function upsertProducts() {
  for (const product of DEMO_PRODUCTS) {
    await prisma.product.upsert({
      where: { name: product.name },
      update: {
        description: product.description,
        price: product.price,
        currency: 'RUB',
        isActive: true,
      },
      create: {
        ...product,
        currency: 'RUB',
        isActive: true,
      },
    });
  }
}

async function resetDemoDomainData() {
  await prisma.reviewRequest.deleteMany({
    where: { orderId: { in: [...DEMO_ORDER_IDS] } },
  });

  await prisma.deliveryJob.deleteMany({
    where: { orderId: { in: [...DEMO_ORDER_IDS] } },
  });

  await prisma.orderStatusHistory.deleteMany({
    where: { orderId: { in: [...DEMO_ORDER_IDS] } },
  });

  await prisma.orderItem.deleteMany({
    where: { orderId: { in: [...DEMO_ORDER_IDS] } },
  });

  await prisma.order.deleteMany({
    where: { id: { in: [...DEMO_ORDER_IDS] } },
  });

  await prisma.aiActionLog.deleteMany({
    where: { conversationId: { in: [...DEMO_CONVERSATION_IDS] } },
  });

  await prisma.message.deleteMany({
    where: { conversationId: { in: [...DEMO_CONVERSATION_IDS] } },
  });

  await prisma.conversation.deleteMany({
    where: { id: { in: [...DEMO_CONVERSATION_IDS] } },
  });
}

async function seedDemoShowcase() {
  const products = await prisma.product.findMany({
    where: {
      name: {
        in: DEMO_PRODUCTS.map((product) => product.name),
      },
    },
  });

  const productByName = new Map(products.map((product) => [product.name, product]));

  const cappuccino = productByName.get('Капучино 300 мл');
  const latte = productByName.get('Латте 400 мл');
  const raf = productByName.get('Раф 300 мл');
  const sandwich = productByName.get('Сэндвич с индейкой');
  const cheesecake = productByName.get('Чизкейк');
  const juice = productByName.get('Апельсиновый фреш');

  if (!cappuccino || !latte || !raf || !sandwich || !cheesecake || !juice) {
    throw new Error('Demo products were not created correctly');
  }

  const demoCourier = DEMO_COURIERS[0];
  const annaCourier = DEMO_COURIERS[1];

  const conversationFresh = await prisma.conversation.create({
    data: {
      id: DEMO_CONVERSATION_IDS[0],
      customerName: 'Иван',
      customerPhone: '+79990000001',
      handoffState: HandoffState.ai,
      messages: {
        create: [
          {
            role: MessageRole.user,
            content: 'Здравствуйте, хочу кофе с собой, что у вас есть?',
            createdAt: hoursAgo(6),
          },
          {
            role: MessageRole.assistant,
            content:
              'Здравствуйте! Могу помочь оформить заказ. У нас есть капучино, латте, раф, сэндвичи, чизкейк и апельсиновый фреш.',
            createdAt: hoursAgo(6),
          },
        ],
      },
    },
  });

  const conversationHandoff = await prisma.conversation.create({
    data: {
      id: DEMO_CONVERSATION_IDS[1],
      customerName: 'Мария',
      customerPhone: '+79990000002',
      handoffState: HandoffState.operator,
      messages: {
        create: [
          {
            role: MessageRole.user,
            content: 'Мне нужен заказ в офис, но у меня вопрос по времени доставки.',
            createdAt: hoursAgo(5),
          },
          {
            role: MessageRole.assistant,
            content: 'Передаю диалог оператору, чтобы уточнить детали вручную.',
            createdAt: hoursAgo(5),
          },
          {
            role: MessageRole.operator,
            content:
              'Здравствуйте! Оператор на связи. Можем доставить к 16:30, если подтвердите заказ в течение 10 минут.',
            createdAt: hoursAgo(5),
            metadata: {
              operatorEmail: 'admin@operon.local',
              handoffState: 'operator',
            },
          },
        ],
      },
    },
  });

  const conversationPreparing = await prisma.conversation.create({
    data: {
      id: DEMO_CONVERSATION_IDS[2],
      customerName: 'Олег',
      customerPhone: '+79990000003',
      handoffState: HandoffState.ai,
      messages: {
        create: [
          {
            role: MessageRole.user,
            content:
              'Хочу 2 капучино и чизкейк. Телефон +79990000003, адрес: Москва, Лесная 12. Подтверждаю заказ.',
            createdAt: hoursAgo(4),
          },
          {
            role: MessageRole.tool,
            content: JSON.stringify({
              tool: 'find_product',
              result: [
                { name: cappuccino.name, price: 220 },
                { name: cheesecake.name, price: 290 },
              ],
            }),
            createdAt: hoursAgo(4),
          },
          {
            role: MessageRole.assistant,
            content:
              'Отлично, заказ подтверждён: 2 капучино и чизкейк. Передаю в обработку.',
            createdAt: hoursAgo(4),
          },
        ],
      },
    },
  });

  const conversationOnTheWay = await prisma.conversation.create({
    data: {
      id: DEMO_CONVERSATION_IDS[3],
      customerName: 'Анна',
      customerPhone: '+79990000004',
      handoffState: HandoffState.ai,
      messages: {
        create: [
          {
            role: MessageRole.user,
            content:
              'Нужен раф и сэндвич. Адрес: Москва, Белорусская 7, телефон +79990000004. Подтверждаю.',
            createdAt: hoursAgo(3),
          },
          {
            role: MessageRole.assistant,
            content:
              'Заказ принят. Как только курьер будет назначен, статус обновится.',
            createdAt: hoursAgo(3),
          },
        ],
      },
    },
  });

  const conversationDelivered = await prisma.conversation.create({
    data: {
      id: DEMO_CONVERSATION_IDS[4],
      customerName: 'Елена',
      customerPhone: '+79990000005',
      handoffState: HandoffState.ai,
      messages: {
        create: [
          {
            role: MessageRole.user,
            content:
              'Закажу латте и апельсиновый фреш. Телефон +79990000005, адрес: Москва, Покровка 18.',
            createdAt: hoursAgo(2),
          },
          {
            role: MessageRole.assistant,
            content: 'Заказ оформлен и скоро будет доставлен.',
            createdAt: hoursAgo(2),
          },
          {
            role: MessageRole.assistant,
            content:
              'Спасибо за заказ! Пожалуйста, оцените доставку и сервис — напишите, всё ли понравилось.',
            createdAt: minutesAgo(45),
          },
        ],
      },
    },
  });

  const orderPreparing = await prisma.order.create({
    data: {
      id: DEMO_ORDER_IDS[0],
      customerName: 'Олег',
      customerPhone: '+79990000003',
      deliveryAddress: 'Москва, Лесная 12',
      comment: 'Позвонить за 5 минут до приезда',
      status: OrderStatus.preparing,
      totalAmount: new Prisma.Decimal('730.00'),
      conversationId: conversationPreparing.id,
      items: {
        create: [
          {
            productId: cappuccino.id,
            quantity: 2,
            unitPrice: cappuccino.price,
          },
          {
            productId: cheesecake.id,
            quantity: 1,
            unitPrice: cheesecake.price,
          },
        ],
      },
      statusHistory: {
        create: [
          {
            status: OrderStatus.pending,
            note: 'Создан через AI-чат',
            changedBy: 'ai',
            createdAt: hoursAgo(4),
          },
          {
            status: OrderStatus.confirmed,
            note: 'Клиент подтвердил состав и адрес',
            changedBy: 'ai',
            createdAt: hoursAgo(4),
          },
          {
            status: OrderStatus.preparing,
            note: 'Передан в приготовление',
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(3.5),
          },
        ],
      },
    },
  });

  const orderReady = await prisma.order.create({
    data: {
      id: DEMO_ORDER_IDS[1],
      customerName: 'Мария',
      customerPhone: '+79990000002',
      deliveryAddress: 'Москва, Пресненская набережная 10',
      comment: 'Доставка на ресепшен, спросить Марию',
      status: OrderStatus.ready_for_dispatch,
      totalAmount: new Prisma.Decimal('810.00'),
      conversationId: conversationHandoff.id,
      items: {
        create: [
          {
            productId: latte.id,
            quantity: 2,
            unitPrice: latte.price,
          },
          {
            productId: sandwich.id,
            quantity: 1,
            unitPrice: sandwich.price,
          },
          {
            productId: juice.id,
            quantity: 1,
            unitPrice: juice.price,
          },
        ],
      },
      statusHistory: {
        create: [
          {
            status: OrderStatus.pending,
            note: 'Создан оператором после handoff',
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(5),
          },
          {
            status: OrderStatus.confirmed,
            note: 'Подтверждён оператором',
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(4.8),
          },
          {
            status: OrderStatus.preparing,
            note: 'Передан на кухню',
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(4.5),
          },
          {
            status: OrderStatus.ready_for_dispatch,
            note: 'Готов к выдаче курьеру',
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(4.2),
          },
        ],
      },
    },
  });

  const orderOnTheWay = await prisma.order.create({
    data: {
      id: DEMO_ORDER_IDS[2],
      customerName: 'Анна',
      customerPhone: '+79990000004',
      deliveryAddress: 'Москва, Белорусская 7',
      comment: 'Оставить у охраны, если клиент не отвечает',
      status: OrderStatus.on_the_way,
      totalAmount: new Prisma.Decimal('590.00'),
      conversationId: conversationOnTheWay.id,
      items: {
        create: [
          {
            productId: raf.id,
            quantity: 1,
            unitPrice: raf.price,
          },
          {
            productId: sandwich.id,
            quantity: 1,
            unitPrice: sandwich.price,
          },
        ],
      },
      statusHistory: {
        create: [
          {
            status: OrderStatus.pending,
            note: 'Создан через чат',
            changedBy: 'ai',
            createdAt: hoursAgo(3),
          },
          {
            status: OrderStatus.confirmed,
            note: 'Подтверждён клиентом',
            changedBy: 'ai',
            createdAt: hoursAgo(3),
          },
          {
            status: OrderStatus.preparing,
            note: 'Готовится',
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(2.7),
          },
          {
            status: OrderStatus.ready_for_dispatch,
            note: 'Ожидает назначения курьера',
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(2.5),
          },
          {
            status: OrderStatus.on_the_way,
            note: `Courier assigned (${demoCourier.displayName})`,
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(2.2),
          },
        ],
      },
      deliveryJob: {
        create: {
          courierId: demoCourier.id,
          assignedAt: hoursAgo(2.2),
        },
      },
    },
  });

  const orderDelivered = await prisma.order.create({
    data: {
      id: DEMO_ORDER_IDS[3],
      customerName: 'Елена',
      customerPhone: '+79990000005',
      deliveryAddress: 'Москва, Покровка 18',
      comment: 'Позвонить в домофон, код 45',
      status: OrderStatus.delivered,
      totalAmount: new Prisma.Decimal('570.00'),
      conversationId: conversationDelivered.id,
      items: {
        create: [
          {
            productId: latte.id,
            quantity: 1,
            unitPrice: latte.price,
          },
          {
            productId: juice.id,
            quantity: 1,
            unitPrice: juice.price,
          },
        ],
      },
      statusHistory: {
        create: [
          {
            status: OrderStatus.pending,
            note: 'Создан через чат',
            changedBy: 'ai',
            createdAt: hoursAgo(2),
          },
          {
            status: OrderStatus.confirmed,
            note: 'Подтверждён клиентом',
            changedBy: 'ai',
            createdAt: hoursAgo(1.9),
          },
          {
            status: OrderStatus.preparing,
            note: 'Передан в приготовление',
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(1.7),
          },
          {
            status: OrderStatus.ready_for_dispatch,
            note: 'Готов к доставке',
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(1.5),
          },
          {
            status: OrderStatus.on_the_way,
            note: `Courier assigned (${annaCourier.displayName})`,
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(1.3),
          },
          {
            status: OrderStatus.delivered,
            note: 'Marked delivered by courier',
            changedBy: `courier:${annaCourier.id}`,
            createdAt: hoursAgo(1),
          },
        ],
      },
      deliveryJob: {
        create: {
          courierId: annaCourier.id,
          assignedAt: hoursAgo(1.3),
          deliveredAt: hoursAgo(1),
          proofPhotoData: 'demo-proof-photo-base64',
        },
      },
      reviewRequest: {
        create: {
          conversationId: conversationDelivered.id,
          status: ReviewRequestStatus.sent,
          scheduledAt: minutesAgo(55),
          sentAt: minutesAgo(45),
        },
      },
    },
  });

  const orderRushDelivery = await prisma.order.create({
    data: {
      id: DEMO_ORDER_IDS[4],
      customerName: 'Павел',
      customerPhone: '+79990000006',
      deliveryAddress: 'Москва, Цветной бульвар 21, подъезд 2',
      comment: 'Срочно к переговорной, клиент ждёт гостей',
      status: OrderStatus.on_the_way,
      totalAmount: new Prisma.Decimal('1470.00'),
      createdAt: minutesAgo(58),
      items: {
        create: [
          {
            productId: cappuccino.id,
            quantity: 3,
            unitPrice: cappuccino.price,
          },
          {
            productId: sandwich.id,
            quantity: 2,
            unitPrice: sandwich.price,
          },
          {
            productId: cheesecake.id,
            quantity: 1,
            unitPrice: cheesecake.price,
          },
        ],
      },
      statusHistory: {
        create: [
          {
            status: OrderStatus.pending,
            note: 'Создан оператором для офисной доставки',
            changedBy: 'admin@operon.local',
            createdAt: minutesAgo(58),
          },
          {
            status: OrderStatus.confirmed,
            note: 'Состав и срочность подтверждены',
            changedBy: 'admin@operon.local',
            createdAt: minutesAgo(55),
          },
          {
            status: OrderStatus.preparing,
            note: 'Кухня взяла заказ в работу',
            changedBy: 'admin@operon.local',
            createdAt: minutesAgo(50),
          },
          {
            status: OrderStatus.ready_for_dispatch,
            note: 'Упакован в два пакета',
            changedBy: 'admin@operon.local',
            createdAt: minutesAgo(34),
          },
          {
            status: OrderStatus.on_the_way,
            note: `Courier assigned (${demoCourier.displayName})`,
            changedBy: 'admin@operon.local',
            createdAt: minutesAgo(31),
          },
        ],
      },
      deliveryJob: {
        create: {
          courierId: demoCourier.id,
          assignedAt: minutesAgo(31),
        },
      },
    },
  });

  const orderDemoDelivered = await prisma.order.create({
    data: {
      id: DEMO_ORDER_IDS[5],
      customerName: 'Светлана',
      customerPhone: '+79990000007',
      deliveryAddress: 'Москва, Остоженка 4',
      comment: 'Передать лично, сдача не нужна',
      status: OrderStatus.delivered,
      totalAmount: new Prisma.Decimal('880.00'),
      createdAt: hoursAgo(6),
      items: {
        create: [
          {
            productId: raf.id,
            quantity: 2,
            unitPrice: raf.price,
          },
          {
            productId: juice.id,
            quantity: 1,
            unitPrice: juice.price,
          },
          {
            productId: cheesecake.id,
            quantity: 1,
            unitPrice: cheesecake.price,
          },
        ],
      },
      statusHistory: {
        create: [
          {
            status: OrderStatus.pending,
            note: 'Создан через AI-чат',
            changedBy: 'ai',
            createdAt: hoursAgo(6),
          },
          {
            status: OrderStatus.confirmed,
            note: 'Клиент подтвердил заказ',
            changedBy: 'ai',
            createdAt: hoursAgo(5.9),
          },
          {
            status: OrderStatus.preparing,
            note: 'Готовится',
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(5.6),
          },
          {
            status: OrderStatus.ready_for_dispatch,
            note: 'Готов к передаче',
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(5.2),
          },
          {
            status: OrderStatus.on_the_way,
            note: `Courier assigned (${demoCourier.displayName})`,
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(5),
          },
          {
            status: OrderStatus.delivered,
            note: 'Marked delivered by courier',
            changedBy: `courier:${demoCourier.id}`,
            createdAt: hoursAgo(4.6),
          },
        ],
      },
      deliveryJob: {
        create: {
          courierId: demoCourier.id,
          assignedAt: hoursAgo(5),
          deliveredAt: hoursAgo(4.6),
          proofPhotoData: 'demo-proof-photo-base64',
        },
      },
    },
  });

  const orderDemoCancelled = await prisma.order.create({
    data: {
      id: DEMO_ORDER_IDS[6],
      customerName: 'Дмитрий',
      customerPhone: '+79990000008',
      deliveryAddress: 'Москва, Новый Арбат 15',
      comment: 'Клиент отменил после выезда курьера',
      status: OrderStatus.cancelled,
      totalAmount: new Prisma.Decimal('560.00'),
      createdAt: hoursAgo(7),
      items: {
        create: [
          {
            productId: latte.id,
            quantity: 1,
            unitPrice: latte.price,
          },
          {
            productId: cheesecake.id,
            quantity: 1,
            unitPrice: cheesecake.price,
          },
        ],
      },
      statusHistory: {
        create: [
          {
            status: OrderStatus.pending,
            note: 'Создан через чат',
            changedBy: 'ai',
            createdAt: hoursAgo(7),
          },
          {
            status: OrderStatus.confirmed,
            note: 'Клиент подтвердил заказ',
            changedBy: 'ai',
            createdAt: hoursAgo(6.9),
          },
          {
            status: OrderStatus.preparing,
            note: 'Передан в приготовление',
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(6.7),
          },
          {
            status: OrderStatus.ready_for_dispatch,
            note: 'Готов к доставке',
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(6.3),
          },
          {
            status: OrderStatus.on_the_way,
            note: `Courier assigned (${demoCourier.displayName})`,
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(6.1),
          },
          {
            status: OrderStatus.cancelled,
            note: 'Клиент отменил доставку по телефону',
            changedBy: 'admin@operon.local',
            createdAt: hoursAgo(5.8),
          },
        ],
      },
      deliveryJob: {
        create: {
          courierId: demoCourier.id,
          assignedAt: hoursAgo(6.1),
        },
      },
    },
  });

  await prisma.aiActionLog.createMany({
    data: [
      {
        id: '30000000-0000-4000-8000-000000000001',
        conversationId: conversationPreparing.id,
        actionType: 'find_product',
        toolName: 'find_product',
        status: 'succeeded',
        model: 'mock-llm',
        input: { query: 'капучино чизкейк' },
        output: { products: [cappuccino.name, cheesecake.name] },
        createdAt: hoursAgo(4),
      },
      {
        id: '30000000-0000-4000-8000-000000000002',
        conversationId: conversationPreparing.id,
        actionType: 'create_order',
        toolName: 'create_order',
        status: 'succeeded',
        model: 'mock-llm',
        input: { conversationId: conversationPreparing.id },
        output: { orderId: orderPreparing.id },
        createdAt: hoursAgo(4),
      },
      {
        id: '30000000-0000-4000-8000-000000000003',
        conversationId: conversationHandoff.id,
        actionType: 'start_handoff',
        toolName: 'start_handoff',
        status: 'succeeded',
        model: 'mock-llm',
        input: { conversationId: conversationHandoff.id },
        output: { handoffState: 'operator' },
        createdAt: hoursAgo(5),
      },
      {
        id: '30000000-0000-4000-8000-000000000004',
        conversationId: conversationOnTheWay.id,
        actionType: 'create_order',
        toolName: 'create_order',
        status: 'succeeded',
        model: 'mock-llm',
        input: { conversationId: conversationOnTheWay.id },
        output: { orderId: orderOnTheWay.id },
        createdAt: hoursAgo(3),
      },
      {
        id: '30000000-0000-4000-8000-000000000005',
        conversationId: conversationDelivered.id,
        actionType: 'create_order',
        toolName: 'create_order',
        status: 'succeeded',
        model: 'mock-llm',
        input: { conversationId: conversationDelivered.id },
        output: { orderId: orderDelivered.id },
        createdAt: hoursAgo(2),
      },
      {
        id: '30000000-0000-4000-8000-000000000006',
        conversationId: conversationFresh.id,
        actionType: 'find_product',
        toolName: 'find_product',
        status: 'succeeded',
        model: 'mock-llm',
        input: { query: 'что есть' },
        output: { count: DEMO_PRODUCTS.length },
        createdAt: hoursAgo(6),
      },
    ],
  });

  await prisma.conversation.update({
    where: { id: conversationFresh.id },
    data: { updatedAt: hoursAgo(6) },
  });
  await prisma.conversation.update({
    where: { id: conversationHandoff.id },
    data: { updatedAt: hoursAgo(5) },
  });
  await prisma.conversation.update({
    where: { id: conversationPreparing.id },
    data: { updatedAt: hoursAgo(3.5) },
  });
  await prisma.conversation.update({
    where: { id: conversationOnTheWay.id },
    data: { updatedAt: hoursAgo(2.2) },
  });
  await prisma.conversation.update({
    where: { id: conversationDelivered.id },
    data: { updatedAt: minutesAgo(45) },
  });

  await prisma.order.update({
    where: { id: orderPreparing.id },
    data: { updatedAt: hoursAgo(3.5) },
  });
  await prisma.order.update({
    where: { id: orderReady.id },
    data: { updatedAt: hoursAgo(4.2) },
  });
  await prisma.order.update({
    where: { id: orderOnTheWay.id },
    data: { updatedAt: hoursAgo(2.2) },
  });
  await prisma.order.update({
    where: { id: orderDelivered.id },
    data: { updatedAt: minutesAgo(45) },
  });
}

async function main() {
  await upsertCouriers();
  await upsertAdminUser();
  await upsertProducts();
  await resetDemoDomainData();
  await seedDemoShowcase();
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
