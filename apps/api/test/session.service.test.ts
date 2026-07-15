import { describe, expect, it } from 'vitest';
import type { ServerEnv } from '@crm/config';
import { SessionService } from '../src/auth/session.service.js';
import type { PrismaService } from '../src/prisma.service.js';

function env(): ServerEnv {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://crm:crm_password@localhost:5432/crm',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_URL: 'redis://localhost:6379',
    API_HOST: '0.0.0.0',
    API_PORT: 3001,
    API_CORS_ORIGIN: 'http://localhost:3000',
    API_SWAGGER_ENABLED: false,
    AUTH_COOKIE_NAME: 'crm_session',
    AUTH_SESSION_TTL_SECONDS: 3600,
    AUTH_COOKIE_SECURE: false,
    PASSWORD_MIN_LENGTH: 12,
    WORKER_CONCURRENCY: 1,
    AI_PROCESSING_ATTEMPTS: 3,
    AI_PROCESSING_BACKOFF_MS: 2000,
    OUTREACH_GENERATION_BATCH_SIZE: 25,
    DELIVERY_ATTEMPTS: 5,
    DELIVERY_BACKOFF_MS: 2000,
    INBOUND_PROVIDER: 'fake',
    INBOUND_MAX_BODY_BYTES: 262_144,
    INBOUND_ATTEMPTS: 5,
    INBOUND_BACKOFF_MS: 2000,
  };
}

describe('SessionService', () => {
  it('creates an opaque token and stores only its hash', async () => {
    let storedTokenHash = '';
    const prisma = {
      client: {
        session: {
          create: (input: { data: { tokenHash: string } }) => {
            storedTokenHash = input.data.tokenHash;
            return Promise.resolve({ id: 'session-id', ...input.data });
          },
        },
      },
    } as unknown as PrismaService;
    const service = new SessionService(env(), prisma);

    const result = await service.createSession({ userId: 'user-id' });

    expect(result.rawToken).not.toBe(storedTokenHash);
    expect(storedTokenHash).toHaveLength(64);
  });
});
