import { z } from 'zod';

export const assignDeliverySchema = z.object({
  orderId: z.string().uuid(),
  courierId: z.string().uuid(),
});

export const deliveryStatusSchema = z.object({
  status: z.literal('delivered'),
});

const maxProofPayloadChars = 4_000_000;

export const proofPhotoSchema = z.object({
  imageBase64: z.string().min(1).max(maxProofPayloadChars),
});

export type AssignDeliveryInput = z.infer<typeof assignDeliverySchema>;
export type DeliveryStatusInput = z.infer<typeof deliveryStatusSchema>;
export type ProofPhotoInput = z.infer<typeof proofPhotoSchema>;
