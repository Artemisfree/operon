import { describe, expect, it } from 'vitest';

import { normalizeApiBaseUrl } from './api';

describe('normalizeApiBaseUrl', () => {
  it('removes a trailing slash', () => {
    expect(normalizeApiBaseUrl('http://localhost:3004/api/')).toBe(
      'http://localhost:3004/api',
    );
  });

  it('falls back to the local API URL', () => {
    expect(normalizeApiBaseUrl()).toBe('http://localhost:3004/api');
  });
});
