import { describe, expect, it } from 'vitest';
import { sanitizeUser } from '../src/auth/auth.presenters.js';

describe('sanitizeUser', () => {
  it('does not expose password hashes', () => {
    const user = {
      id: 'user-id',
      email: 'dev@example.com',
      passwordHash: 'secret-hash',
      displayName: null,
      status: 'ACTIVE' as const,
      emailVerifiedAt: null,
      lastLoginAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    };

    expect(sanitizeUser(user)).not.toHaveProperty('passwordHash');
  });
});
