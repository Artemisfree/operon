import { describe, expect, it } from 'vitest';

import { TOKEN_STORAGE_KEY } from './auth';

describe('admin auth constants', () => {
  it('uses a stable storage key', () => {
    expect(TOKEN_STORAGE_KEY).toBe('operon-admin-token');
  });
});
