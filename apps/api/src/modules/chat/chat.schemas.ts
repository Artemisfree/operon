import { z } from 'zod';

export const customerMetaSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(6).max(32).optional(),
  locale: z.enum(['en', 'ru']).optional(),
}).optional();

export const chatMessageSchema = z.object({
  conversation_id: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(4000),
  customer_meta: customerMetaSchema,
});

export const handoffSchema = z.object({
  conversation_id: z.string().uuid(),
});

export const messagesQuerySchema = z.object({
  since: z.string().datetime().optional(),
});

export const operatorMessageSchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type HandoffInput = z.infer<typeof handoffSchema>;
export type MessagesQueryInput = z.infer<typeof messagesQuerySchema>;
export type OperatorMessageInput = z.infer<typeof operatorMessageSchema>;
