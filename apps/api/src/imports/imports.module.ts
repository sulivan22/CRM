import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { serverEnvProvider } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ImportsController],
  providers: [serverEnvProvider, PrismaService, ImportsService],
})
export class ImportsModule {}
