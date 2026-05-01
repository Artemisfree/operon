import { Inject, Injectable } from '@nestjs/common';
import { MessageRole, OrderStatus, ReviewRequestStatus } from '@prisma/client';

import { serializeValue } from '../../common/serialization.js';
import { PrismaService } from '../db/prisma.service.js';

@Injectable()
export class MetricsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSnapshot() {
    const [
      ordersTotal,
      deliveredCount,
      conversationsTotal,
      operatorRows,
      reviewsSent,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.delivered } }),
      this.prisma.conversation.count(),
      this.prisma.message.findMany({
        where: { role: MessageRole.operator },
        select: { conversationId: true },
        distinct: ['conversationId'],
      }),
      this.prisma.reviewRequest.count({
        where: { status: ReviewRequestStatus.sent },
      }),
    ]);

    const conversationsWithOperator = operatorRows.length;
    const deliveredPct =
      ordersTotal > 0 ? Math.round((deliveredCount / ordersTotal) * 1000) / 10 : 0;
    const handoffPct =
      conversationsTotal > 0
        ? Math.round((conversationsWithOperator / conversationsTotal) * 1000) / 10
        : 0;

    return serializeValue({
      ordersTotal,
      ordersDelivered: deliveredCount,
      deliveredPct,
      conversationsTotal,
      conversationsWithOperatorReply: conversationsWithOperator,
      handoffPct,
      reviewRequestsSent: reviewsSent,
    });
  }
}
