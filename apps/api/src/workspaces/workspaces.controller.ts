import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard.js';
import { WorkspaceRolesGuard } from '../auth/workspace-roles.guard.js';
import { WorkspaceRoles } from '../auth/decorators.js';
import { sanitizeUser } from '../auth/auth.presenters.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { CreateWorkspaceDto, UpdateMembershipDto, UpdateWorkspaceDto } from './dto.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('workspaces')
@UseGuards(AuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.workspacesService.listForUser(this.requireUserId(request));
  }

  @Post()
  create(@Body() dto: CreateWorkspaceDto, @Req() request: AuthenticatedRequest) {
    return this.workspacesService.create({
      userId: this.requireUserId(request),
      name: dto.name,
      slug: dto.slug
    });
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceMembershipGuard)
  get(@Req() request: AuthenticatedRequest) {
    return {
      workspace: request.currentWorkspace,
      membership: request.currentMembership
    };
  }

  @Patch(':workspaceId')
  @UseGuards(WorkspaceMembershipGuard, WorkspaceRolesGuard)
  @WorkspaceRoles('ADMIN')
  update(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.workspacesService.updateWorkspace({
      actorUserId: this.requireUserId(request),
      workspaceId,
      name: dto.name,
      slug: dto.slug
    });
  }

  @Get(':workspaceId/members')
  @UseGuards(WorkspaceMembershipGuard)
  async members(@Param('workspaceId') workspaceId: string) {
    const members = await this.workspacesService.listMembers(workspaceId);
    return members.map((membership) => ({
      id: membership.id,
      role: membership.role,
      status: membership.status,
      joinedAt: membership.joinedAt?.toISOString() ?? null,
      user: sanitizeUser(membership.user)
    }));
  }

  @Patch(':workspaceId/members/:membershipId')
  @UseGuards(WorkspaceMembershipGuard, WorkspaceRolesGuard)
  @WorkspaceRoles('ADMIN')
  updateMember(
    @Param('workspaceId') workspaceId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipDto,
    @Req() request: AuthenticatedRequest
  ) {
    if (!request.currentMembership) {
      throw new Error('Workspace guard did not attach membership');
    }
    return this.workspacesService.updateMembership({
      actorUserId: this.requireUserId(request),
      actorRole: request.currentMembership.role,
      workspaceId,
      membershipId,
      role: dto.role,
      status: dto.status
    });
  }

  private requireUserId(request: AuthenticatedRequest) {
    if (!request.user) {
      throw new Error('Auth guard did not attach user');
    }
    return request.user.id;
  }
}
