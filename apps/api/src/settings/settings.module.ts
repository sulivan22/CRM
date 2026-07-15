import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuditService } from '../auth/audit.service.js';
import { PrismaService } from '../prisma.service.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SettingsController],
  providers: [PrismaService, AuditService, SettingsService],
})
export class SettingsModule {}
