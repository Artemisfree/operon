import 'reflect-metadata';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module.js';

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();

  return app;
}

export async function resetDatabase() {
  const prisma = new PrismaClient();

  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.adminUser.deleteMany();

  await prisma.$disconnect();
}

export async function closeApp(app: INestApplication) {
  await app.close();
}
