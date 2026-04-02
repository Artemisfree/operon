import { z } from 'zod';

const money = z.coerce.number().positive().multipleOf(0.01);

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  price: money,
  currency: z.string().trim().min(3).max(3).default('RUB'),
  isActive: z.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field must be provided',
);

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
