import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { HealthCheckResponse, ReadyCheckResponse } from '@crm/types';
import { HealthService } from './health.service.js';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOkResponse({ description: 'API is running' })
  getHealth(): HealthCheckResponse {
    return this.healthService.getHealth();
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'API dependencies are ready' })
  @ApiServiceUnavailableResponse({ description: 'A dependency is unavailable' })
  async getReady(): Promise<ReadyCheckResponse> {
    return this.healthService.getReady();
  }
}
