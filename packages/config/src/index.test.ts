import { describe, expect, it } from 'vitest';
import { parseClientEnv, parseServerEnv } from './index.js';

describe('environment validation', () => {
  it('parses server environment values', () => {
    const env = parseServerEnv({
      DATABASE_URL: 'postgresql://crm:crm_password@localhost:5432/crm',
      REDIS_URL: 'redis://localhost:6379'
    });

    expect(env.API_PORT).toBe(3001);
    expect(env.REDIS_HOST).toBe('localhost');
  });

  it('keeps client environment scoped to public values', () => {
    const env = parseClientEnv({
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3001',
      DATABASE_URL: 'postgresql://crm:crm_password@localhost:5432/crm'
    });

    expect(env).toEqual({ NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3001' });
  });
});
