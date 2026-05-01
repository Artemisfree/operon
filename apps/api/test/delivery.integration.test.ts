import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { closeApp, createTestApp, resetDatabase } from './helpers.js';

const prisma = new PrismaClient();

async function loginAdmin(
  app: Awaited<ReturnType<typeof createTestApp>>,
  email = 'delivery-admin@test.local',
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

async function seedProduct() {
  return prisma.product.create({
    data: {
      name: `Product-${Date.now()}`,
      price: 100,
      currency: 'RUB',
    },
  });
}

async function seedOrder(productId: string, status: 'pending' | 'ready_for_dispatch') {
  const historyStatus = status === 'pending' ? 'pending' : 'ready_for_dispatch';

  return prisma.order.create({
    data: {
      customerName: 'Клиент',
      customerPhone: '+79990000000',
      deliveryAddress: 'Москва, ул. Тест, 1',
      totalAmount: 100,
      status,
      items: {
        create: {
          productId,
          quantity: 1,
          unitPrice: 100,
        },
      },
      statusHistory: {
        create: {
          status: historyStatus,
          note: 'seed',
        },
      },
    },
  });
}

async function createCourier(plainToken: string) {
  const apiTokenHash = await hash(plainToken, 10);

  return prisma.courier.create({
    data: {
      displayName: 'Курьер',
      apiTokenHash,
    },
  });
}

describe('Delivery & couriers integration', () => {
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

  it('GET /couriers returns 401 without admin token', async () => {
    const response = await request(app.getHttpServer()).get('/api/couriers').expect(401);

    assert.equal(response.body.message, 'Missing Authorization header');
  });

  it('GET /couriers lists only active couriers for admin', async () => {
    const token = await loginAdmin(app);
    await createCourier('token-a');
    await prisma.courier.create({
      data: {
        displayName: 'Off',
        apiTokenHash: await hash('token-b', 10),
        isActive: false,
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/couriers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].displayName, 'Курьер');
  });

  it('POST /delivery/assign returns 401 without admin token', async () => {
    await request(app.getHttpServer())
      .post('/api/delivery/assign')
      .send({
        orderId: randomUUID(),
        courierId: randomUUID(),
      })
      .expect(401);
  });

  it('POST /delivery/assign validates body', async () => {
    const token = await loginAdmin(app);

    const response = await request(app.getHttpServer())
      .post('/api/delivery/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    assert.equal(response.body.message, 'Validation failed');
  });

  it('POST /delivery/assign returns 404 when order does not exist', async () => {
    const token = await loginAdmin(app);
    const courier = await createCourier('c1');

    const response = await request(app.getHttpServer())
      .post('/api/delivery/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderId: randomUUID(),
        courierId: courier.id,
      })
      .expect(404);

    assert.match(response.body.message, /not found/);
  });

  it('POST /delivery/assign returns 400 when order is not ready_for_dispatch', async () => {
    const token = await loginAdmin(app);
    const product = await seedProduct();
    const order = await seedOrder(product.id, 'pending');
    const courier = await createCourier('c2');

    await request(app.getHttpServer())
      .post('/api/delivery/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderId: order.id,
        courierId: courier.id,
      })
      .expect(400);
  });

  it('POST /delivery/assign returns 400 for inactive courier', async () => {
    const token = await loginAdmin(app);
    const product = await seedProduct();
    const order = await seedOrder(product.id, 'ready_for_dispatch');
    const courier = await prisma.courier.create({
      data: {
        displayName: 'Inactive',
        apiTokenHash: await hash('x', 10),
        isActive: false,
      },
    });

    await request(app.getHttpServer())
      .post('/api/delivery/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderId: order.id,
        courierId: courier.id,
      })
      .expect(400);
  });

  it('POST /delivery/assign returns 400 on duplicate assign', async () => {
    const token = await loginAdmin(app);
    const product = await seedProduct();
    const order = await seedOrder(product.id, 'ready_for_dispatch');
    const courier = await createCourier('c3');

    await request(app.getHttpServer())
      .post('/api/delivery/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderId: order.id,
        courierId: courier.id,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/delivery/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderId: order.id,
        courierId: courier.id,
      })
      .expect(400);
  });

  it('GET /delivery/jobs returns 401 without courier token', async () => {
    const response = await request(app.getHttpServer()).get('/api/delivery/jobs').expect(401);

    assert.equal(response.body.message, 'Missing Authorization header');
  });

  it('GET /delivery/jobs returns 401 for invalid courier token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/delivery/jobs')
      .set('Authorization', 'Bearer wrong-token')
      .expect(401);

    assert.equal(response.body.message, 'Invalid courier token');
  });

  it('GET /delivery/jobs returns 401 when using admin JWT instead of courier token', async () => {
    const adminToken = await loginAdmin(app);

    const response = await request(app.getHttpServer())
      .get('/api/delivery/jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(401);

    assert.equal(response.body.message, 'Invalid courier token');
  });

  it('courier cannot mark another couriers job as delivered', async () => {
    const adminToken = await loginAdmin(app);
    const product = await seedProduct();
    const order = await seedOrder(product.id, 'ready_for_dispatch');
    const courierA = await createCourier('tok-a');
    const courierB = await createCourier('tok-b');

    const assignResponse = await request(app.getHttpServer())
      .post('/api/delivery/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderId: order.id,
        courierId: courierA.id,
      })
      .expect(201);

    const jobId = assignResponse.body.deliveryJob.id as string;

    await request(app.getHttpServer())
      .post(`/api/delivery/${jobId}/status`)
      .set('Authorization', 'Bearer tok-b')
      .send({ status: 'delivered' })
      .expect(400);
  });

  it('courier cannot upload proof for another couriers job', async () => {
    const adminToken = await loginAdmin(app);
    const product = await seedProduct();
    const order = await seedOrder(product.id, 'ready_for_dispatch');
    const courierA = await createCourier('tok-pa');
    await createCourier('tok-pb');

    const assignResponse = await request(app.getHttpServer())
      .post('/api/delivery/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderId: order.id,
        courierId: courierA.id,
      })
      .expect(201);

    const jobId = assignResponse.body.deliveryJob.id as string;

    await request(app.getHttpServer())
      .post(`/api/delivery/${jobId}/proof-photo`)
      .set('Authorization', 'Bearer tok-pb')
      .send({ imageBase64: 'QQ==' })
      .expect(400);
  });

  it('marking delivered twice returns 400 on second call', async () => {
    const adminToken = await loginAdmin(app);
    const product = await seedProduct();
    const order = await seedOrder(product.id, 'ready_for_dispatch');
    const courier = await createCourier('tok-del');

    const assignResponse = await request(app.getHttpServer())
      .post('/api/delivery/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderId: order.id,
        courierId: courier.id,
      })
      .expect(201);

    const jobId = assignResponse.body.deliveryJob.id as string;

    await request(app.getHttpServer())
      .post(`/api/delivery/${jobId}/status`)
      .set('Authorization', 'Bearer tok-del')
      .send({ status: 'delivered' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/delivery/${jobId}/status`)
      .set('Authorization', 'Bearer tok-del')
      .send({ status: 'delivered' })
      .expect(400);
  });

  it('POST /delivery/:id/proof-photo validates imageBase64', async () => {
    const adminToken = await loginAdmin(app);
    const product = await seedProduct();
    const order = await seedOrder(product.id, 'ready_for_dispatch');
    const courier = await createCourier('tok-ph');

    const assignResponse = await request(app.getHttpServer())
      .post('/api/delivery/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderId: order.id,
        courierId: courier.id,
      })
      .expect(201);

    const jobId = assignResponse.body.deliveryJob.id as string;

    const response = await request(app.getHttpServer())
      .post(`/api/delivery/${jobId}/proof-photo`)
      .set('Authorization', 'Bearer tok-ph')
      .send({ imageBase64: '' })
      .expect(400);

    assert.equal(response.body.message, 'Validation failed');
  });

  it('GET /delivery/jobs omits proof payload but sets hasProofPhoto', async () => {
    const adminToken = await loginAdmin(app);
    const product = await seedProduct();
    const order = await seedOrder(product.id, 'ready_for_dispatch');
    const courier = await createCourier('tok-list');

    const assignResponse = await request(app.getHttpServer())
      .post('/api/delivery/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderId: order.id,
        courierId: courier.id,
      })
      .expect(201);

    const jobId = assignResponse.body.deliveryJob.id as string;

    await request(app.getHttpServer())
      .post(`/api/delivery/${jobId}/proof-photo`)
      .set('Authorization', 'Bearer tok-list')
      .send({ imageBase64: 'ZGF0YQ==' })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/api/delivery/jobs')
      .set('Authorization', 'Bearer tok-list')
      .expect(200);

    assert.equal(listResponse.body.length, 1);
    assert.equal(listResponse.body[0].hasProofPhoto, true);
    assert.equal(listResponse.body[0].proofPhotoData, undefined);
  });
});
