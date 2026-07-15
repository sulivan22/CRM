import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { serverEnvProvider } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import { AIController } from './ai.controller.js';
import { AIOrchestrationService } from './ai.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AIController],
  providers: [serverEnvProvider, PrismaService, AIOrchestrationService],
})
export class AIModule {}
