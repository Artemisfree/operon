import 'reflect-metadata';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module.js';

export async function createTestApp() {
  process.env.AI_PROVIDER = 'mock';
  process.env.OPENAI_API_KEY = '';
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      'postgresql://operon:operon@127.0.0.1:9432/operon?schema=public';
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-jwt-secret';
  }

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

  await prisma.aiActionLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.reviewRequest.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.agentBehaviorVersion.deleteMany();
  await prisma.agentBehaviorProfile.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.courier.deleteMany();
  await prisma.product.deleteMany();
  await prisma.adminUser.deleteMany();

  await prisma.$disconnect();
}

export async function closeApp(app: INestApplication) {
  await app.close();
}
