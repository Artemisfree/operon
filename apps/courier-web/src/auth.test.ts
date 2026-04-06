import { describe, expect, it } from 'vitest';

import { COURIER_TOKEN_STORAGE_KEY } from './auth';

describe('courier auth constants', () => {
  it('uses a stable storage key', () => {
    expect(COURIER_TOKEN_STORAGE_KEY).toBe('operon_courier_token');
  });
});
