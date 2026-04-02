import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);

  app.setGlobalPrefix('api');

  await app.listen(port);

  Logger.log(`API is running on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
