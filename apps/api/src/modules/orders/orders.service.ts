import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

import { serializeValue } from '../../common/serialization.js';
import { PrismaService } from '../db/prisma.service.js';
import type {
  CreateOrderInput,
  UpdateOrderStatusInput,
} from './orders.schemas.js';

const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready_for_dispatch', 'cancelled'],
  ready_for_dispatch: ['on_the_way', 'cancelled'],
  on_the_way: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

@Injectable()
export class OrdersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateOrderInput) {
    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'One or more products were not found or inactive',
      );
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const totalAmount = input.items.reduce((total, item) => {
      const product = productMap.get(item.productId);

      if (!product) {
        return total;
      }

      return total + product.price.toNumber() * item.quantity;
    }, 0);

    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deliveryAddress: input.deliveryAddress,
          comment: input.comment,
          totalAmount: new Prisma.Decimal(totalAmount),
          items: {
            create: input.items.map((item) => {
              const product = productMap.get(item.productId);

              if (!product) {
                throw new BadRequestException(
                  `Product ${item.productId} was not found`,
                );
              }

              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: product.price,
              };
            }),
          },
        },
        include: this.orderInclude(),
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: createdOrder.id,
          status: createdOrder.status,
          note: 'Order created',
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: createdOrder.id },
        include: this.orderInclude(),
      });
    });

    return serializeValue(order);
  }

  async findAll() {
    const orders = await this.prisma.order.findMany({
      include: this.orderInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return serializeValue(orders);
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude(),
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return serializeValue(order);
  }

  async updateStatus(id: string, input: UpdateOrderStatusInput, changedBy?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    const allowedNextStatuses = ALLOWED_STATUS_TRANSITIONS[order.status];

    if (!allowedNextStatuses.includes(input.status)) {
      throw new BadRequestException(
        `Status transition ${order.status} -> ${input.status} is not allowed`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status: input.status,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: input.status,
          note: input.note,
          changedBy,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id },
        include: this.orderInclude(),
      });
    });

    return serializeValue(updated);
  }

  private orderInclude() {
    return {
      items: {
        include: {
          product: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' as const },
      },
      deliveryJob: {
        include: {
          courier: {
            select: {
              id: true,
              displayName: true,
              phone: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    };
  }
}
