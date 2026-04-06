import { describe, expect, it } from 'vitest';

import { nextAdminStatuses, ORDER_STATUS_LABEL } from './orderWorkflow';

describe('orderWorkflow', () => {
  it('covers every label key used in nextAdminStatuses paths', () => {
    const keys = new Set<string>();
    for (const s of [
      'pending',
      'confirmed',
      'preparing',
      'ready_for_dispatch',
      'on_the_way',
      'delivered',
      'cancelled',
    ]) {
      for (const n of nextAdminStatuses(s)) {
        keys.add(n);
      }
      keys.add(s);
    }
    for (const k of keys) {
      expect(ORDER_STATUS_LABEL[k], `missing label for ${k}`).toBeDefined();
    }
  });

  it('nextAdminStatuses matches backend workflow for operator-driven steps', () => {
    expect(nextAdminStatuses('pending')).toEqual(['confirmed', 'cancelled']);
    expect(nextAdminStatuses('confirmed')).toEqual(['preparing', 'cancelled']);
    expect(nextAdminStatuses('preparing')).toEqual(['ready_for_dispatch', 'cancelled']);
    expect(nextAdminStatuses('ready_for_dispatch')).toEqual([]);
    expect(nextAdminStatuses('on_the_way')).toEqual(['delivered', 'cancelled']);
    expect(nextAdminStatuses('delivered')).toEqual([]);
    expect(nextAdminStatuses('unknown')).toEqual([]);
  });
});
