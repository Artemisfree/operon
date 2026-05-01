import { Inject, Injectable } from '@nestjs/common';

import { serializeValue } from '../../common/serialization.js';
import { PrismaService } from '../db/prisma.service.js';

const courierPublicSelect = {
  id: true,
  displayName: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CouriersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll() {
    const couriers = await this.prisma.courier.findMany({
      where: { isActive: true },
      select: courierPublicSelect,
      orderBy: { displayName: 'asc' },
    });

    return serializeValue(couriers);
  }
}
