import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { JsonLogger } from './common/json-logger.service.js';
import { serverEnvProvider } from './env.js';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';
import { PrismaService } from './prisma.service.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100
      }
    ])
  ],
  controllers: [HealthController],
  providers: [serverEnvProvider, PrismaService, HealthService, JsonLogger, AllExceptionsFilter]
})
export class AppModule {}
