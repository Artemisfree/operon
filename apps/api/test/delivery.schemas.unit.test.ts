import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assignDeliverySchema,
  deliveryStatusSchema,
  proofPhotoSchema,
} from '../src/modules/delivery/delivery.schemas.js';

describe('delivery.schemas (zod)', () => {
  it('assignDeliverySchema accepts valid UUIDs', () => {
    const parsed = assignDeliverySchema.parse({
      orderId: '550e8400-e29b-41d4-a716-446655440000',
      courierId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    });
    assert.equal(parsed.orderId, '550e8400-e29b-41d4-a716-446655440000');
  });

  it('assignDeliverySchema rejects invalid uuid', () => {
    assert.throws(() =>
      assignDeliverySchema.parse({
        orderId: 'not-a-uuid',
        courierId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    );
  });

  it('deliveryStatusSchema only allows delivered', () => {
    deliveryStatusSchema.parse({ status: 'delivered' });
    assert.throws(() => deliveryStatusSchema.parse({ status: 'pending' }));
  });

  it('proofPhotoSchema rejects empty string', () => {
    assert.throws(() => proofPhotoSchema.parse({ imageBase64: '' }));
  });

  it('proofPhotoSchema accepts non-empty base64', () => {
    const parsed = proofPhotoSchema.parse({ imageBase64: 'SGVsbG8=' });
    assert.equal(parsed.imageBase64, 'SGVsbG8=');
  });
});
