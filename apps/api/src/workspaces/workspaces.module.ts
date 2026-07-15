import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuditService } from '../auth/audit.service.js';
import { SlugService } from '../auth/slug.service.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Module({
  imports: [AuthModule],
  controllers: [WorkspacesController],
  providers: [PrismaService, SlugService, AuditService, WorkspacesService],
})
export class WorkspacesModule {}
