import { describe, expect, it } from 'vitest';

import { normalizeAdminApiBaseUrl } from './api';

describe('normalizeAdminApiBaseUrl', () => {
  it('removes a trailing slash', () => {
    expect(normalizeAdminApiBaseUrl('http://localhost:3004/api/')).toBe(
      'http://localhost:3004/api',
    );
  });

  it('falls back to the local API URL', () => {
    expect(normalizeAdminApiBaseUrl()).toBe('http://localhost:3004/api');
  });
});
