import { Module } from '@nestjs/common';
import { DeliveriesController } from './deliveries.controller.js';
import { DeliveriesService } from './deliveries.service.js';
import { PrismaService } from '../prisma.service.js';
import { serverEnvProvider } from '../env.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [DeliveriesController],
  providers: [serverEnvProvider, DeliveriesService, PrismaService],
})
export class DeliveriesModule {}
