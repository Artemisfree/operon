import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MessageRole, OrderStatus, ReviewRequestStatus } from '@prisma/client';

import { serializeValue } from '../../common/serialization.js';
import { PrismaService } from '../db/prisma.service.js';

const REVIEW_ASSISTANT_MESSAGE =
  'Спасибо за заказ! Пожалуйста, оцените доставку и сервис — напишите, всё ли понравилось.';

@Injectable()
export class ReviewService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  private getDelayMinutes(): number {
    const raw = this.configService.get<string | number>('review.delayMinutes');
    const n = typeof raw === 'number' ? raw : Number(raw ?? 7);
    return Number.isFinite(n) && n >= 0 ? n : 7;
  }

  /**
   * Idempotent: one review row per order. Call when order becomes delivered.
   */
  async scheduleReviewForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        conversationId: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.delivered) {
      return null;
    }

    const existing = await this.prisma.reviewRequest.findUnique({
      where: { orderId },
    });

    if (existing) {
      return serializeValue(existing);
    }

    const delayMinutes = this.getDelayMinutes();
    const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    const created = await this.prisma.reviewRequest.create({
      data: {
        orderId,
        conversationId: order.conversationId,
        status: ReviewRequestStatus.scheduled,
        scheduledAt,
      },
    });

    return serializeValue(created);
  }

  /** Admin-only: schedule review for a delivered order (testing / manual). */
  async scheduleReviewForOrderOrThrow(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.delivered) {
      throw new BadRequestException('Order must be delivered to schedule a review');
    }

    return this.scheduleReviewForOrder(orderId);
  }

  async processDueReviews() {
    const due = await this.prisma.reviewRequest.findMany({
      where: {
        status: ReviewRequestStatus.scheduled,
        scheduledAt: { lte: new Date() },
      },
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const req of due) {
      const result = await this.processOne(req.id);
      if (result === 'sent') {
        sent += 1;
      } else if (result === 'skipped') {
        skipped += 1;
      } else {
        failed += 1;
      }
    }

    return serializeValue({
      checked: due.length,
      sent,
      skippedNoConversation: skipped,
      failed,
    });
  }

  private async processOne(
    reviewRequestId: string,
  ): Promise<'sent' | 'skipped' | 'failed'> {
    const req = await this.prisma.reviewRequest.findUnique({
      where: { id: reviewRequestId },
    });

    if (!req || req.status !== ReviewRequestStatus.scheduled) {
      return 'failed';
    }

    const conversationId = req.conversationId;
    if (!conversationId) {
      await this.prisma.reviewRequest.update({
        where: { id: req.id },
        data: {
          status: ReviewRequestStatus.skipped_no_conversation,
          sentAt: new Date(),
        },
      });
      return 'skipped';
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.message.create({
          data: {
            conversationId,
            role: MessageRole.assistant,
            content: REVIEW_ASSISTANT_MESSAGE,
          },
        });

        await tx.reviewRequest.update({
          where: { id: req.id },
          data: {
            status: ReviewRequestStatus.sent,
            sentAt: new Date(),
          },
        });
      });
      return 'sent';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.prisma.reviewRequest.update({
        where: { id: req.id },
        data: {
          status: ReviewRequestStatus.failed,
          errorMessage: message,
        },
      });
      return 'failed';
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleReviewCron() {
    await this.processDueReviews();
  }
}
