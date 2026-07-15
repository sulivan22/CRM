import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { serverEnvProvider } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import { InboxController } from './inbox.controller.js';
import { InboxService } from './inbox.service.js';
import { InboundWebhookController } from './inbound-webhook.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [InboxController, InboundWebhookController],
  providers: [serverEnvProvider, PrismaService, InboxService],
})
export class InboxModule {}
