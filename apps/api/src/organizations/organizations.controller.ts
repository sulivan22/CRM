import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard.js';
import { WorkspaceRolesGuard } from '../auth/workspace-roles.guard.js';
import { WorkspaceRoles } from '../auth/decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto.js';
import { OrganizationsService } from './organizations.service.js';

@Controller('workspaces/:workspaceId/organizations')
@UseGuards(AuthGuard, WorkspaceMembershipGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  list(@Param('workspaceId') workspaceId: string) {
    return this.organizationsService.list(workspaceId);
  }

  @Post()
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateOrganizationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.create({
      actorUserId: requireUserId(request),
      workspaceId,
      ...dto,
    });
  }

  @Get(':organizationId')
  get(@Param('workspaceId') workspaceId: string, @Param('organizationId') organizationId: string) {
    return this.organizationsService.get(workspaceId, organizationId);
  }

  @Patch(':organizationId')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('organizationId') organizationId: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.update({
      actorUserId: requireUserId(request),
      workspaceId,
      organizationId,
      ...dto,
    });
  }

  @Delete(':organizationId')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  archive(
    @Param('workspaceId') workspaceId: string,
    @Param('organizationId') organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.archive({
      actorUserId: requireUserId(request),
      workspaceId,
      organizationId,
    });
  }
}

function requireUserId(request: AuthenticatedRequest) {
  if (!request.user) {
    throw new Error('Auth guard did not attach user');
  }
  return request.user.id;
}
