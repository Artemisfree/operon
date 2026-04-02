import { Controller, Get, Inject } from '@nestjs/common';

import { PrismaService } from '../db/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async getHealth() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      service: 'operon-api',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
