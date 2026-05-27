import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { serializeValue } from '../../common/serialization.js';
import { PrismaService } from '../db/prisma.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { ProductsService } from '../products/products.service.js';
import { FlorStorefrontService } from './flor-storefront.service.js';

type CreateOrderToolInput = {
  customerName?: string;
  customerPhone: string;
  deliveryAddress: string;
  comment?: string;
  deliveryDate?: string;
  deliverySlotStart?: string;
  deliverySlotEnd?: string;
  confirmed: boolean;
  conversationId?: string;
  items: Array<{
    productQuery: string;
    quantity: number;
    variantQuery?: string;
  }>;
};

@Injectable()
export class ChatToolService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(OrdersService) private readonly ordersService: OrdersService,
    @Inject(ProductsService) private readonly productsService: ProductsService,
    @Inject(FlorStorefrontService)
    private readonly florStorefrontService: FlorStorefrontService,
  ) {}

  async findProduct(query: string) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      throw new BadRequestException('Product query is required');
    }

    if (this.isFlorCatalog()) {
      return this.florStorefrontService.findProducts(normalizedQuery);
    }

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: normalizedQuery, mode: 'insensitive' } },
          { description: { contains: normalizedQuery, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return serializeValue(products);
  }

  async createOrder(input: CreateOrderToolInput) {
    if (!input.confirmed) {
      throw new BadRequestException(
        'Order cannot be created without explicit confirmation',
      );
    }

    if (!input.customerPhone || !input.deliveryAddress) {
      throw new BadRequestException(
        'Phone and delivery address are required for order creation',
      );
    }

    if (!input.items.length) {
      throw new BadRequestException('At least one item is required');
    }

    if (this.isFlorCatalog()) {
      return this.florStorefrontService.createOrder(input);
    }

    const resolvedItems = [];

    for (const item of input.items) {
      const matches = (await this.findProduct(item.productQuery)) as Array<{
        id: string;
      }>;

      if (matches.length === 0) {
        throw new NotFoundException(
          `No product found for query "${item.productQuery}"`,
        );
      }

      if (matches.length > 1) {
        throw new BadRequestException(
          `Product query "${item.productQuery}" is ambiguous`,
        );
      }

      const matchedProduct = matches[0];
      if (!matchedProduct) {
        throw new NotFoundException(
          `No product found for query "${item.productQuery}"`,
        );
      }

      resolvedItems.push({
        productId: matchedProduct.id,
        quantity: item.quantity,
      });
    }

    return this.ordersService.create({
      customerName: input.customerName?.trim() || 'Гость',
      customerPhone: input.customerPhone,
      deliveryAddress: input.deliveryAddress,
      comment: input.comment,
      conversationId: input.conversationId,
      items: resolvedItems,
    });
  }

  async getOrderStatus(orderId: string) {
    if (this.isFlorCatalog()) {
      return this.florStorefrontService.getOrderStatus(orderId);
    }

    const order = await this.ordersService.findOne(orderId);
    return {
      orderId,
      status: (order as { status: string }).status,
    };
  }

  async startHandoff(conversationId: string) {
    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { handoffState: 'operator' },
    });

    return serializeValue(conversation);
  }

  async stopHandoff(conversationId: string) {
    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { handoffState: 'ai' },
    });

    return serializeValue(conversation);
  }

  async appendOperatorNote(orderId: string, text: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const note = await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: order.status,
        note: text,
        changedBy: 'ai',
      },
    });

    return serializeValue(note);
  }

  async listDeliverySlots(days?: number) {
    if (!this.isFlorCatalog()) {
      return {
        message:
          'Delivery slot lookup is only configured for external storefront providers.',
      };
    }

    return this.florStorefrontService.listDeliverySlots(days);
  }

  async executeTool(name: string, args: Record<string, unknown>) {
    switch (name) {
      case 'find_product':
        return this.findProduct(String(args.query ?? ''));
      case 'list_delivery_slots':
        return this.listDeliverySlots(Number(args.days ?? 7));
      case 'create_order':
        return this.createOrder(args as unknown as CreateOrderToolInput);
      case 'get_order_status':
        return this.getOrderStatus(String(args.orderId ?? ''));
      case 'start_handoff':
        return this.startHandoff(String(args.conversationId ?? ''));
      case 'append_operator_note':
        return this.appendOperatorNote(
          String(args.orderId ?? ''),
          String(args.text ?? ''),
        );
      default:
        throw new BadRequestException(`Unknown tool: ${name}`);
    }
  }

  private isFlorCatalog() {
    return this.configService.get<string>('catalog.provider') === 'flor';
  }
}
