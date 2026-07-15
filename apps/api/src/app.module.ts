import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { JsonLogger } from './common/json-logger.service.js';
import { serverEnvProvider } from './env.js';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';
import { PrismaService } from './prisma.service.js';
import { AuthModule } from './auth/auth.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { PeopleModule } from './people/people.module.js';
import { TagsModule } from './tags/tags.module.js';
import { ImportsModule } from './imports/imports.module.js';
import { OutreachModule } from './outreach/outreach.module.js';
import { DeliveriesModule } from './deliveries/deliveries.module.js';
import { InboxModule } from './inbox/inbox.module.js';
import { AIModule } from './ai/ai.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    AuthModule,
    WorkspacesModule,
    OrganizationsModule,
    PeopleModule,
    TagsModule,
    ImportsModule,
    OutreachModule,
    DeliveriesModule,
    InboxModule,
    AIModule,
  ],
  controllers: [HealthController],
  providers: [serverEnvProvider, PrismaService, HealthService, JsonLogger, AllExceptionsFilter],
})
export class AppModule {}
