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
});
