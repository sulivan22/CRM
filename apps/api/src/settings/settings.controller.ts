import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard.js';
import { WorkspaceRolesGuard } from '../auth/workspace-roles.guard.js';
import { WorkspaceRoles } from '../auth/decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import {
  UpdateWorkspaceAISettingsDto,
  UpdateWorkspaceEmailSettingsDto,
  UpdateWorkspaceSettingsDto,
} from './dto.js';
import { SettingsService } from './settings.service.js';

@Controller('workspaces/:workspaceId/settings')
@UseGuards(AuthGuard, WorkspaceMembershipGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getGeneral(@Param('workspaceId') workspaceId: string) {
    return this.settingsService.getGeneral(workspaceId);
  }

  @Patch()
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  updateGeneral(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceSettingsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settingsService.updateGeneral({
      actorUserId: requireUserId(request),
      workspaceId,
      dto,
    });
  }

  @Get('ai')
  getAI(@Param('workspaceId') workspaceId: string) {
    return this.settingsService.getAI(workspaceId);
  }

  @Patch('ai')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  updateAI(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceAISettingsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settingsService.updateAI({
      actorUserId: requireUserId(request),
      workspaceId,
      dto,
    });
  }

  @Post('ai/test')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  testAI(@Param('workspaceId') workspaceId: string) {
    return this.settingsService.testAI(workspaceId);
  }

  @Get('email')
  getEmail(@Param('workspaceId') workspaceId: string) {
    return this.settingsService.getEmail(workspaceId);
  }

  @Patch('email')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  updateEmail(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceEmailSettingsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settingsService.updateEmail({
      actorUserId: requireUserId(request),
      workspaceId,
      dto,
    });
  }

  @Post('email/test')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  testEmail(@Param('workspaceId') workspaceId: string) {
    return this.settingsService.testEmail(workspaceId);
  }
}

function requireUserId(request: AuthenticatedRequest) {
  if (!request.user) {
    throw new Error('Auth guard did not attach user');
  }
  return request.user.id;
}
