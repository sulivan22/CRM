import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { serverEnvProvider } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import { OutreachController } from './outreach.controller.js';
import { OutreachService } from './outreach.service.js';

@Module({
  imports: [AuthModule],
  controllers: [OutreachController],
  providers: [serverEnvProvider, PrismaService, OutreachService],
  exports: [OutreachService],
})
export class OutreachModule {}
