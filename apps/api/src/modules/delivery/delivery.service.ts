import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

import { serializeValue } from '../../common/serialization.js';
import { PrismaService } from '../db/prisma.service.js';
import { ReviewService } from '../review/review.service.js';
import type { AssignDeliveryInput, ProofPhotoInput } from './delivery.schemas.js';

const courierPublicSelect = {
  id: true,
  displayName: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ReviewService) private readonly reviewService: ReviewService,
  ) {}

  async assign(input: AssignDeliveryInput, changedBy?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${input.orderId} not found`);
    }

    if (order.status !== OrderStatus.ready_for_dispatch) {
      throw new BadRequestException(
        `Order must be in ${OrderStatus.ready_for_dispatch} to assign a courier`,
      );
    }

    const courier = await this.prisma.courier.findFirst({
      where: {
        id: input.courierId,
        isActive: true,
      },
    });

    if (!courier) {
      throw new BadRequestException(`Courier ${input.courierId} not found or inactive`);
    }

    const existingJob = await this.prisma.deliveryJob.findUnique({
      where: { orderId: input.orderId },
    });

    if (existingJob) {
      throw new BadRequestException('Delivery job already exists for this order');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.deliveryJob.create({
        data: {
          orderId: input.orderId,
          courierId: input.courierId,
        },
      });

      await tx.order.update({
        where: { id: input.orderId },
        data: {
          status: OrderStatus.on_the_way,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: input.orderId,
          status: OrderStatus.on_the_way,
          note: `Courier assigned (${courier.displayName})`,
          changedBy,
        },
      });
    });

    const deliveryJob = await this.prisma.deliveryJob.findUniqueOrThrow({
      where: { orderId: input.orderId },
      include: {
        courier: { select: courierPublicSelect },
        order: {
          include: {
            items: { include: { product: true } },
            statusHistory: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    return serializeValue({ deliveryJob });
  }

  async listJobsForCourier(courierId: string) {
    const jobs = await this.prisma.deliveryJob.findMany({
      where: { courierId },
      orderBy: { assignedAt: 'desc' },
      include: {
        courier: { select: courierPublicSelect },
        order: {
          include: {
            items: { include: { product: true } },
            statusHistory: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    const sanitized = jobs.map(
      ({ proofPhotoData, ...job }) => ({
        ...job,
        hasProofPhoto: Boolean(proofPhotoData),
      }),
    );

    return serializeValue(sanitized);
  }

  async markDelivered(jobId: string, courierId: string, changedBy?: string) {
    const job = await this.prisma.deliveryJob.findUnique({
      where: { id: jobId },
      include: { order: true },
    });

    if (!job) {
      throw new NotFoundException(`Delivery job ${jobId} not found`);
    }

    if (job.courierId !== courierId) {
      throw new BadRequestException('Courier is not assigned to this job');
    }

    if (job.order.status !== OrderStatus.on_the_way) {
      throw new BadRequestException(
        `Order must be ${OrderStatus.on_the_way} to mark delivered`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: job.orderId },
        data: {
          status: OrderStatus.delivered,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: job.orderId,
          status: OrderStatus.delivered,
          note: 'Marked delivered by courier',
          changedBy,
        },
      });

      await tx.deliveryJob.update({
        where: { id: jobId },
        data: {
          deliveredAt: new Date(),
        },
      });

      return tx.deliveryJob.findUniqueOrThrow({
        where: { id: jobId },
        include: {
          courier: { select: courierPublicSelect },
          order: {
            include: {
              items: { include: { product: true } },
              statusHistory: { orderBy: { createdAt: 'asc' } },
            },
          },
        },
      });
    });

    await this.reviewService.scheduleReviewForOrder(job.orderId);

    return serializeValue(updated);
  }

  async saveProofPhoto(
    jobId: string,
    courierId: string,
    input: ProofPhotoInput,
  ) {
    const job = await this.prisma.deliveryJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Delivery job ${jobId} not found`);
    }

    if (job.courierId !== courierId) {
      throw new BadRequestException('Courier is not assigned to this job');
    }

    const updated = await this.prisma.deliveryJob.update({
      where: { id: jobId },
      data: {
        proofPhotoData: input.imageBase64,
      },
      include: {
        courier: { select: courierPublicSelect },
        order: {
          include: {
            items: { include: { product: true } },
            statusHistory: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    return serializeValue(updated);
  }
}
