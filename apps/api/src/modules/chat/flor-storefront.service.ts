import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type FlorVariant = {
  id: number;
  name: string;
  price: string | number;
  order: number;
  is_active: boolean;
};

type FlorProduct = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  variants: FlorVariant[];
  images?: Array<{ url: string; is_primary: boolean; alt_text?: string | null }>;
};

type FlorDeliverySlot = {
  start: string;
  end: string;
};

type FlorDeliveryDay = {
  date: string;
  slots: FlorDeliverySlot[];
};

type FlorCreateOrderInput = {
  customerName?: string;
  customerPhone: string;
  deliveryAddress: string;
  comment?: string;
  deliveryDate?: string;
  deliverySlotStart?: string;
  deliverySlotEnd?: string;
  items: Array<{
    productQuery: string;
    quantity: number;
    variantQuery?: string;
  }>;
};

@Injectable()
export class FlorStorefrontService {
  constructor(private readonly configService: ConfigService) {}

  async findProducts(query: string) {
    const searchParams = new URLSearchParams({
      q: query,
      limit: '5',
      sort: 'created_at',
    });
    const products = await this.request<FlorProduct[]>(
      `/store/products?${searchParams.toString()}`,
    );

    return products.map((product) => {
      const activeVariants = product.variants
        .filter((variant) => variant.is_active)
        .sort((left, right) => left.order - right.order);
      const firstVariant = activeVariants[0];
      const primaryImage =
        product.images?.find((image) => image.is_primary) ?? product.images?.[0];

      return {
        id: `flor:${product.id}`,
        externalId: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        price: firstVariant?.price ?? null,
        currency: 'AED',
        imageUrl: primaryImage?.url ?? null,
        variants: activeVariants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          price: variant.price,
        })),
      };
    });
  }

  async listDeliverySlots(days = 7) {
    const searchParams = new URLSearchParams({
      days: String(Math.max(1, Math.min(days, 14))),
    });
    return this.request<FlorDeliveryDay[]>(
      `/api/delivery/slots?${searchParams.toString()}`,
    );
  }

  async createOrder(input: FlorCreateOrderInput) {
    const firstItem = input.items[0];
    if (!firstItem) {
      throw new BadRequestException('At least one item is required');
    }

    const matches = await this.findProducts(firstItem.productQuery);
    if (matches.length === 0) {
      throw new BadRequestException(
        `No FLOR product found for "${firstItem.productQuery}"`,
      );
    }
    if (matches.length > 1) {
      throw new BadRequestException(
        `Product query "${firstItem.productQuery}" is ambiguous`,
      );
    }

    const product = matches[0];
    if (!product) {
      throw new BadRequestException(
        `No FLOR product found for "${firstItem.productQuery}"`,
      );
    }
    const variants = product.variants as Array<{
      id: number;
      name: string;
      price: string | number;
    }>;
    const variant =
      this.findVariant(variants, firstItem.variantQuery) ?? variants[0];

    if (!variant) {
      throw new BadRequestException(`Product "${product.name}" has no active variants`);
    }

    const slot = await this.resolveDeliverySlot(input);
    const customerName = input.customerName?.trim() || 'Guest';

    return this.request('/store/orders', {
      method: 'POST',
      body: JSON.stringify({
        customer_name: customerName,
        customer_phone: input.customerPhone,
        recipient_name: customerName,
        recipient_phone: input.customerPhone,
        delivery_address: input.deliveryAddress,
        delivery_date: slot.deliveryDate,
        delivery_slot_start: slot.deliverySlotStart,
        delivery_slot_end: slot.deliverySlotEnd,
        delivery_notes: input.comment,
        card_message: input.comment,
        delivery_fee: '0.00',
        items: [
          {
            product_id: product.externalId,
            variant_id: variant.id,
            quantity: firstItem.quantity,
            add_on_ids: [],
          },
        ],
      }),
    });
  }

  async getOrderStatus(orderId: string) {
    const order = await this.request<{ id: number; order_number: string; status: string }>(
      `/store/orders/${encodeURIComponent(orderId)}`,
    );

    return {
      orderId: String(order.id),
      orderNumber: order.order_number,
      status: order.status,
    };
  }

  private findVariant(
    variants: Array<{ id: number; name: string; price: string | number }>,
    variantQuery?: string,
  ) {
    if (!variantQuery?.trim()) {
      return null;
    }

    const normalized = variantQuery.trim().toLowerCase();
    return (
      variants.find((variant) => variant.name.toLowerCase() === normalized) ??
      variants.find((variant) => variant.name.toLowerCase().includes(normalized)) ??
      null
    );
  }

  private async resolveDeliverySlot(input: FlorCreateOrderInput) {
    if (input.deliveryDate && input.deliverySlotStart && input.deliverySlotEnd) {
      return {
        deliveryDate: input.deliveryDate,
        deliverySlotStart: input.deliverySlotStart,
        deliverySlotEnd: input.deliverySlotEnd,
      };
    }

    const days = await this.listDeliverySlots(7);
    for (const day of days) {
      const slot = day.slots[0];
      if (slot) {
        return {
          deliveryDate: slot.start,
          deliverySlotStart: slot.start,
          deliverySlotEnd: slot.end,
        };
      }
    }

    throw new BadRequestException('No FLOR delivery slots are available');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = (
      this.configService.get<string>('flor.apiBaseUrl') ?? 'http://localhost:8000'
    ).replace(/\/$/, '');
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ServiceUnavailableException(
        `FLOR API request failed (${response.status}): ${errorText}`,
      );
    }

    return (await response.json()) as T;
  }
}
