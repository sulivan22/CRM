import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { HealthCheckResponse, HealthStatus, ReadyCheckResponse } from '@crm/types';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  getHealth(): HealthCheckResponse {
    return {
      service: 'api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getReady(): Promise<ReadyCheckResponse> {
    const databaseStatus = await this.getDatabaseStatus();
    const status: HealthStatus = databaseStatus === 'ok' ? 'ok' : 'degraded';

    const response = {
      service: 'api',
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: databaseStatus,
      },
    } satisfies ReadyCheckResponse;

    if (status !== 'ok') {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }

  private async getDatabaseStatus(): Promise<HealthStatus> {
    try {
      await this.prismaService.client.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }
}
