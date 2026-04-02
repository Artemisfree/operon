import { z } from 'zod';

const money = z.coerce.number().positive().multipleOf(0.01);

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(6).max(32),
  deliveryAddress: z.string().trim().min(5).max(500),
  comment: z.string().trim().max(2000).optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.coerce.number().int().positive(),
    }),
  ).min(1),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'pending',
    'confirmed',
    'preparing',
    'ready_for_dispatch',
    'on_the_way',
    'delivered',
    'cancelled',
  ]),
  note: z.string().trim().max(500).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
