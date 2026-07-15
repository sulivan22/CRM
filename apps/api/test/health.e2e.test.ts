import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { HealthController } from '../src/health/health.controller.js';
import { PrismaService } from '../src/prisma.service.js';

describe('health endpoints', () => {
  let app: INestApplication;
  let controller: HealthController;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        client: {
          $connect: () => Promise.resolve(undefined),
          $disconnect: () => Promise.resolve(undefined),
          $queryRaw: () => Promise.resolve([{ ok: 1 }]),
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    controller = app.get(HealthController);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns API health', () => {
    const response = controller.getHealth();

    expect(response).toMatchObject({ service: 'api', status: 'ok' });
  });

  it('returns readiness when dependencies are available', async () => {
    const response = await controller.getReady();

    expect(response.checks.database).toBe('ok');
  });
});
