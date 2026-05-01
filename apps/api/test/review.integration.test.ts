import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { closeApp, createTestApp, resetDatabase } from './helpers.js';

const prisma = new PrismaClient();

async function loginAdmin(
  app: Awaited<ReturnType<typeof createTestApp>>,
  email = 'review-admin@test.local',
) {
  const passwordHash = await hash('admin12345', 10);
  await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
    },
  });

  const response = await request(app.getHttpServer())
    .post('/api/admin/auth/login')
    .send({
      email,
      password: 'admin12345',
    })
    .expect(201);

  return response.body.accessToken as string;
}

describe('Review pipeline (Phase E)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  before(async () => {
    process.env.REVIEW_DELAY_MINUTES = '0';
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

  it('POST /review/send delivers assistant message once (idempotent schedule)', async () => {
    const token = await loginAdmin(app);

    const conversation = await prisma.conversation.create({
      data: {
        customerName: 'Тест',
        customerPhone: '+79991112233',
      },
    });

    const product = await prisma.product.create({
      data: {
        name: `Review-product-${Date.now()}`,
        price: 100,
        currency: 'RUB',
      },
    });

    const order = await prisma.order.create({
      data: {
        customerName: 'Тест',
        customerPhone: '+79991112233',
        deliveryAddress: 'Москва',
        totalAmount: 100,
        status: 'delivered',
        conversationId: conversation.id,
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPrice: 100,
          },
        },
        statusHistory: {
          create: {
            status: 'delivered',
            note: 'test seed',
          },
        },
      },
    });

    const schedule1 = await request(app.getHttpServer())
      .post('/api/review/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: order.id })
      .expect(201);

    assert.ok(schedule1.body.id);

    await request(app.getHttpServer())
      .post('/api/review/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: order.id })
      .expect(201);

    const send = await request(app.getHttpServer())
      .post('/api/review/send')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    assert.equal(send.body.sent, 1);
    assert.equal(send.body.skippedNoConversation, 0);

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });

    const reviewMessages = messages.filter((m) =>
      m.content.includes('оцените доставку'),
    );
    assert.equal(reviewMessages.length, 1);

    const second = await request(app.getHttpServer())
      .post('/api/review/send')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    assert.equal(second.body.checked, 0);
    assert.equal(second.body.sent, 0);
  });

  it('GET /admin/metrics returns snapshot', async () => {
    const token = await loginAdmin(app, 'metrics-admin@test.local');

    await prisma.conversation.create({
      data: {
        messages: {
          create: {
            role: 'operator',
            content: 'hi',
          },
        },
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/admin/metrics')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.equal(typeof res.body.ordersTotal, 'number');
    assert.equal(typeof res.body.deliveredPct, 'number');
    assert.equal(typeof res.body.handoffPct, 'number');
  });
});
