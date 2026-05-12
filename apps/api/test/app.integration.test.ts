import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { closeApp, createTestApp, resetDatabase } from './helpers.js';

const prisma = new PrismaClient();

describe('API integration', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  before(async () => {
    app = await createTestApp();
    await resetDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  after(async () => {
    await closeApp(app);
    await prisma.$disconnect();
  });

  it('creates an order and records initial status history', async () => {
    const product = await prisma.product.create({
      data: {
        name: 'Тестовый товар',
        price: 199.99,
        currency: 'RUB',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .send({
        customerName: 'Иван',
        customerPhone: '+79990000000',
        deliveryAddress: 'Москва, Тестовая улица, 1',
        items: [{ productId: product.id, quantity: 2 }],
      })
      .expect(201);

    assert.equal(response.body.status, 'pending');
    assert.equal(response.body.totalAmount, 399.98);
    assert.ok(Array.isArray(response.body.statusHistory));
    assert.equal(response.body.statusHistory.length, 1);
    assert.equal(response.body.statusHistory[0].status, 'pending');
  });

  it('updates order status through allowed workflow', async () => {
    const passwordHash = await hash('admin12345', 10);
    const admin = await prisma.adminUser.create({
      data: {
        email: 'admin@test.local',
        passwordHash,
      },
    });

    const product = await prisma.product.create({
      data: {
        name: 'Workflow product',
        price: 150,
        currency: 'RUB',
      },
    });

    const order = await prisma.order.create({
      data: {
        customerName: 'Пётр',
        customerPhone: '+79991112233',
        deliveryAddress: 'Санкт-Петербург, Лиговский, 10',
        totalAmount: 150,
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPrice: 150,
          },
        },
        statusHistory: {
          create: {
            status: 'pending',
            note: 'Order created',
          },
        },
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({
        email: admin.email,
        password: 'admin12345',
      })
      .expect(201);

    const token = loginResponse.body.accessToken;

    const statusResponse = await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'confirmed',
        note: 'Confirmed by operator',
      })
      .expect(201);

    assert.equal(statusResponse.body.status, 'confirmed');
    assert.equal(statusResponse.body.statusHistory.at(-1)?.status, 'confirmed');
  });

  it('rejects invalid status transitions', async () => {
    const passwordHash = await hash('admin12345', 10);
    const admin = await prisma.adminUser.create({
      data: {
        email: 'admin2@test.local',
        passwordHash,
      },
    });

    const product = await prisma.product.create({
      data: {
        name: 'Invalid transition product',
        price: 150,
        currency: 'RUB',
      },
    });

    const order = await prisma.order.create({
      data: {
        customerName: 'Ольга',
        customerPhone: '+79994445566',
        deliveryAddress: 'Казань, Кремлёвская, 5',
        totalAmount: 150,
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPrice: 150,
          },
        },
        statusHistory: {
          create: {
            status: 'pending',
            note: 'Order created',
          },
        },
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({
        email: admin.email,
        password: 'admin12345',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .send({
        status: 'delivered',
      })
      .expect(400);
  });

  it('protects product CRUD behind admin auth', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/products')
      .expect(401);

    assert.equal(response.body.message, 'Missing Authorization header');
  });

  it('allows an admin to create and read products', async () => {
    const passwordHash = await hash('admin12345', 10);
    await prisma.adminUser.create({
      data: {
        email: 'admin-products@test.local',
        passwordHash,
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({
        email: 'admin-products@test.local',
        password: 'admin12345',
      })
      .expect(201);

    const token = loginResponse.body.accessToken;

    const createResponse = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Круассан',
        description: 'Свежая выпечка',
        price: 180,
        currency: 'rub',
      })
      .expect(201);

    assert.equal(createResponse.body.name, 'Круассан');
    assert.equal(createResponse.body.currency, 'RUB');

    const listResponse = await request(app.getHttpServer())
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.equal(listResponse.body.length, 1);
    assert.equal(listResponse.body[0].name, 'Круассан');
  });

  it('manages AI behavior drafts, preview, publish, and conversation binding', async () => {
    const passwordHash = await hash('admin12345', 10);
    await prisma.adminUser.create({
      data: {
        email: 'behavior-admin@test.local',
        passwordHash,
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({
        email: 'behavior-admin@test.local',
        password: 'admin12345',
      })
      .expect(201);

    const token = loginResponse.body.accessToken as string;

    const listResponse = await request(app.getHttpServer())
      .get('/api/admin/ai-behaviors')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.equal(listResponse.body.length, 1);
    const defaultProfileId = listResponse.body[0].id as string;

    const profileResponse = await request(app.getHttpServer())
      .get(`/api/admin/ai-behaviors/${defaultProfileId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const nextDefinition = structuredClone(profileResponse.body.draft.definition) as {
      profileMeta: { name: string };
      stages: Array<{
        stageId: string;
        blocks: Array<{
          type: string;
          config: Record<string, unknown>;
        }>;
      }>;
    };

    nextDefinition.profileMeta.name = 'Основной обновлённый';
    const greetingStage = nextDefinition.stages.find(
      (stage) => stage.stageId === 'greeting',
    );
    const greetingBlock = greetingStage?.blocks.find(
      (block) => block.type === 'GreetingBlock',
    );
    const fallbackStage = nextDefinition.stages.find(
      (stage) => stage.stageId === 'fallback',
    );
    const fallbackBlock = fallbackStage?.blocks.find(
      (block) => block.type === 'FallbackBlock',
    );
    const handoffStage = nextDefinition.stages.find(
      (stage) => stage.stageId === 'handoff',
    );
    const handoffBlock = handoffStage?.blocks.find(
      (block) => block.type === 'HandoffBlock',
    );
    const createOrderStage = nextDefinition.stages.find(
      (stage) => stage.stageId === 'create-order',
    );
    const createOrderBlock = createOrderStage?.blocks.find(
      (block) => block.type === 'CreateOrderBlock',
    );
    if (!greetingBlock) {
      throw new Error('GreetingBlock missing in default definition');
    }
    if (!fallbackBlock || !handoffBlock || !createOrderBlock) {
      throw new Error('Expected behavior blocks missing in default definition');
    }
    greetingBlock.config.greetingText =
      'Поздоровайся и скажи, что работаешь по обновлённому профилю.';
    fallbackBlock.config.fallbackText =
      'ТЕСТОВЫЙ_FALLBACK: задай только один следующий параметр заказа.';
    handoffBlock.config.handoffMessage = 'ТЕСТОВЫЙ_HANDOFF: подключаю оператора.';
    createOrderBlock.config.successTemplate = 'ТЕСТОВЫЙ_УСПЕХ {orderId}';

    const previewResponse = await request(app.getHttpServer())
      .post(`/api/admin/ai-behaviors/${defaultProfileId}/preview`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        definition: nextDefinition,
      })
      .expect(201);

    assert.equal(previewResponse.body.errors.length, 0);
    assert.match(previewResponse.body.compiledPrompt, /обновлённому профилю/i);

    const saveDraftResponse = await request(app.getHttpServer())
      .post(`/api/admin/ai-behaviors/${defaultProfileId}/draft`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Основной обновлённый',
        description: 'Тестовый draft',
        definition: nextDefinition,
      })
      .expect(201);

    assert.equal(saveDraftResponse.body.name, 'Основной обновлённый');
    assert.equal(saveDraftResponse.body.preview.errors.length, 0);

    const publishedBefore = await prisma.agentBehaviorVersion.findFirstOrThrow({
      where: {
        profileId: defaultProfileId,
        status: 'published',
      },
    });

    const publishResponse = await request(app.getHttpServer())
      .post(`/api/admin/ai-behaviors/${defaultProfileId}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    assert.equal(publishResponse.body.published.version, 2);
    assert.equal(publishResponse.body.draft.version, 3);
    assert.match(publishResponse.body.published.compiledPrompt, /обновлённому профилю/i);

    const publishedAfter = await prisma.agentBehaviorVersion.findFirstOrThrow({
      where: {
        profileId: defaultProfileId,
        status: 'published',
      },
    });

    assert.notEqual(publishedBefore.id, publishedAfter.id);

    await prisma.product.create({
      data: {
        name: 'Американо',
        description: 'Кофе',
        price: 190,
        currency: 'RUB',
      },
    });

    const fallbackChatResponse = await request(app.getHttpServer())
      .post('/api/chat/message')
      .send({
        text: 'Привет',
      })
      .expect(201);

    assert.match(fallbackChatResponse.body.reply, /обновлённому профилю/i);
    assert.match(fallbackChatResponse.body.reply, /ТЕСТОВЫЙ_FALLBACK/i);

    const handoffChatResponse = await request(app.getHttpServer())
      .post('/api/chat/message')
      .send({
        text: 'Позовите оператора, пожалуйста',
      })
      .expect(201);

    assert.equal(handoffChatResponse.body.handoff_state, 'operator');
    assert.match(handoffChatResponse.body.reply, /ТЕСТОВЫЙ_HANDOFF/i);

    const chatResponse = await request(app.getHttpServer())
      .post('/api/chat/message')
      .send({
        text: 'Хочу заказать 1 Американо. Телефон: +79990001122. Адрес: Москва, Садовая 7. Подтверждаю заказ.',
      })
      .expect(201);

    assert.match(chatResponse.body.reply, /ТЕСТОВЫЙ_УСПЕХ/i);

    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: chatResponse.body.conversation_id as string },
    });

    assert.equal(conversation.behaviorVersionId, publishedAfter.id);
  });

  it('creates an order through chat tool-calling', async () => {
    await prisma.product.create({
      data: {
        name: 'Капучино 300 мл',
        description: 'Классический капучино',
        price: 220,
        currency: 'RUB',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/chat/message')
      .send({
        text: 'Хочу заказать 2 Капучино 300 мл. Телефон: +79990000000. Адрес: Москва, Тверская 1. Подтверждаю заказ.',
        customer_meta: {
          name: 'Иван',
        },
      })
      .expect(201);

    assert.equal(response.body.handoff_state, 'ai');
    assert.match(response.body.reply, /Заказ оформлен/i);
    assert.ok(response.body.agent_actions.length >= 1);
    assert.ok(
      response.body.agent_actions.some(
        (action: { tool?: string }) => action.tool === 'create_order',
      ),
    );

    const orders = await prisma.order.findMany();
    assert.equal(orders.length, 1);
    assert.equal(orders[0].customerName, 'Иван');

    const actionLogs = await prisma.aiActionLog.findMany({
      orderBy: { createdAt: 'asc' },
    });
    assert.ok(actionLogs.length >= 1);
    assert.equal(actionLogs.at(-1)?.toolName, 'create_order');
  });

  it('returns the tool validation error when deterministic chat order creation fails', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/chat/message')
      .send({
        text: 'Хочу заказать 1 Несуществующий напиток. Телефон: +79990000000. Адрес: Москва, Тверская 1. Подтверждаю заказ.',
      })
      .expect(404);

    assert.equal(response.body.statusCode, 404);
    assert.match(response.body.message, /No product found/i);

    const orders = await prisma.order.findMany();
    assert.equal(orders.length, 0);
  });

  it('does not create an order from chat without required fields', async () => {
    await prisma.product.create({
      data: {
        name: 'Латте 400 мл',
        description: 'Мягкий латте',
        price: 260,
        currency: 'RUB',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/chat/message')
      .send({
        text: 'Хочу заказать 1 Латте 400 мл.',
      })
      .expect(201);

    assert.match(response.body.reply, /нужны/i);
    assert.equal(response.body.handoff_state, 'ai');

    const orders = await prisma.order.findMany();
    assert.equal(orders.length, 0);

    const createOrderLogs = await prisma.aiActionLog.findMany({
      where: { toolName: 'create_order' },
    });
    assert.equal(createOrderLogs.length, 0);
  });

  it('creates an order after a second explicit confirmation message', async () => {
    await prisma.product.create({
      data: {
        name: 'Флэт уайт',
        description: 'Кофе с молоком',
        price: 240,
        currency: 'RUB',
      },
    });

    const firstResponse = await request(app.getHttpServer())
      .post('/api/chat/message')
      .send({
        text: 'Хочу заказать 2 Флэт уайт. Телефон: +79995554433. Адрес: Москва, Петровка 10.',
        customer_meta: {
          name: 'Мария',
        },
      })
      .expect(201);

    assert.match(firstResponse.body.reply, /нужны|подтверж/i);

    const secondResponse = await request(app.getHttpServer())
      .post('/api/chat/message')
      .send({
        conversation_id: firstResponse.body.conversation_id,
        text: 'Да, подтверждаю заказ.',
      })
      .expect(201);

    assert.match(secondResponse.body.reply, /Заказ оформлен/i);
    assert.equal(secondResponse.body.agent_actions.length, 1);
    assert.equal(secondResponse.body.agent_actions[0].tool, 'create_order');

    const orders = await prisma.order.findMany();
    assert.equal(orders.length, 1);
    assert.equal(orders[0].customerName, 'Мария');
    assert.equal(orders[0].customerPhone, '+79995554433');
  });

  it('supports polling and operator handoff flow', async () => {
    await prisma.product.create({
      data: {
        name: 'Раф 300 мл',
        description: 'Сливочный кофе',
        price: 250,
        currency: 'RUB',
      },
    });

    const passwordHash = await hash('admin12345', 10);
    await prisma.adminUser.create({
      data: {
        email: 'operator@test.local',
        passwordHash,
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({
        email: 'operator@test.local',
        password: 'admin12345',
      })
      .expect(201);

    const token = loginResponse.body.accessToken;

    const firstResponse = await request(app.getHttpServer())
      .post('/api/chat/message')
      .send({
        text: 'Хочу заказать 1 Раф 300 мл. Телефон: +79997776655. Адрес: Москва, Арбат 5.',
        customer_meta: {
          name: 'Елена',
        },
      })
      .expect(201);

    const conversationId = firstResponse.body.conversation_id;

    const messagesResponse = await request(app.getHttpServer())
      .get(`/api/chat/conversations/${conversationId}/messages`)
      .expect(200);

    assert.ok(messagesResponse.body.messages.length >= 2);
    assert.equal(messagesResponse.body.messages[0].role, 'user');
    assert.ok(
      messagesResponse.body.messages.some(
        (message: { role?: string }) => message.role === 'assistant',
      ),
    );

    const conversationsResponse = await request(app.getHttpServer())
      .get('/api/admin/conversations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.equal(conversationsResponse.body.length, 1);
    assert.equal(conversationsResponse.body[0].id, conversationId);

    await request(app.getHttpServer())
      .post(`/api/admin/conversations/${conversationId}/handoff/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const duringHandoffResponse = await request(app.getHttpServer())
      .post('/api/chat/message')
      .send({
        conversation_id: conversationId,
        text: 'Вы ещё на связи?',
      })
      .expect(201);

    assert.equal(duringHandoffResponse.body.handoff_state, 'operator');
    assert.equal(duringHandoffResponse.body.reply, '');

    await request(app.getHttpServer())
      .post(`/api/admin/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        text: 'Да, оператор на связи.',
      })
      .expect(201);

    const detailsResponse = await request(app.getHttpServer())
      .get(`/api/admin/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.equal(detailsResponse.body.handoffState, 'operator');
    assert.equal(detailsResponse.body.messages.at(-1).role, 'operator');
    assert.equal(detailsResponse.body.messages.at(-1).content, 'Да, оператор на связи.');

    await request(app.getHttpServer())
      .post(`/api/admin/conversations/${conversationId}/handoff/stop`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const afterReturnResponse = await request(app.getHttpServer())
      .post('/api/chat/message')
      .send({
        conversation_id: conversationId,
        text: 'Да, подтверждаю заказ.',
      })
      .expect(201);

    assert.equal(afterReturnResponse.body.handoff_state, 'ai');
    assert.match(afterReturnResponse.body.reply, /Заказ оформлен/i);
  });

  it('assigns a courier and completes the delivery workflow', async () => {
    const passwordHash = await hash('admin12345', 10);
    const admin = await prisma.adminUser.create({
      data: {
        email: 'dispatch@test.local',
        passwordHash,
      },
    });

    const courierToken = 'courier-integration-token';
    const courierTokenHash = await hash(courierToken, 10);
    const courier = await prisma.courier.create({
      data: {
        displayName: 'Курьер тест',
        apiTokenHash: courierTokenHash,
      },
    });

    const product = await prisma.product.create({
      data: {
        name: 'Delivery test product',
        price: 100,
        currency: 'RUB',
      },
    });

    const order = await prisma.order.create({
      data: {
        customerName: 'Клиент',
        customerPhone: '+79990000000',
        deliveryAddress: 'Москва, Тестовая 1',
        totalAmount: 100,
        status: 'ready_for_dispatch',
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPrice: 100,
          },
        },
        statusHistory: {
          create: {
            status: 'ready_for_dispatch',
            note: 'Ready for dispatch',
          },
        },
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({
        email: admin.email,
        password: 'admin12345',
      })
      .expect(201);

    const adminToken = loginResponse.body.accessToken;

    const assignResponse = await request(app.getHttpServer())
      .post('/api/delivery/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderId: order.id,
        courierId: courier.id,
      })
      .expect(201);

    assert.equal(assignResponse.body.deliveryJob.order.status, 'on_the_way');

    const jobsResponse = await request(app.getHttpServer())
      .get('/api/delivery/jobs')
      .set('Authorization', `Bearer ${courierToken}`)
      .expect(200);

    assert.equal(jobsResponse.body.length, 1);
    assert.equal(jobsResponse.body[0].order.status, 'on_the_way');

    const jobId = jobsResponse.body[0].id as string;

    await request(app.getHttpServer())
      .post(`/api/delivery/${jobId}/proof-photo`)
      .set('Authorization', `Bearer ${courierToken}`)
      .send({
        imageBase64: 'dGVzdA==',
      })
      .expect(201);

    const deliveredResponse = await request(app.getHttpServer())
      .post(`/api/delivery/${jobId}/status`)
      .set('Authorization', `Bearer ${courierToken}`)
      .send({
        status: 'delivered',
      })
      .expect(201);

    assert.equal(deliveredResponse.body.order.status, 'delivered');
    assert.ok(deliveredResponse.body.deliveredAt);
  });
});
