import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { serverEnvProvider } from '../env.js';
import { AuditService } from './audit.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';
import { SlugService } from './slug.service.js';
import { WorkspaceMembershipGuard } from './workspace-membership.guard.js';
import { WorkspaceRolesGuard } from './workspace-roles.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    serverEnvProvider,
    PrismaService,
    AuthService,
    SessionService,
    SlugService,
    AuditService,
    AuthGuard,
    WorkspaceMembershipGuard,
    WorkspaceRolesGuard
  ],
  exports: [AuthGuard, WorkspaceMembershipGuard, WorkspaceRolesGuard, SessionService, AuditService, SlugService]
})
export class AuthModule {}
