import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard.js';
import { WorkspaceRolesGuard } from '../auth/workspace-roles.guard.js';
import { WorkspaceRoles } from '../auth/decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { CreateTagDto } from './dto.js';
import { TagsService } from './tags.service.js';

@Controller('workspaces/:workspaceId/tags')
@UseGuards(AuthGuard, WorkspaceMembershipGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  list(@Param('workspaceId') workspaceId: string) {
    return this.tagsService.list(workspaceId);
  }

  @Post()
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateTagDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) {
      throw new Error('Auth guard did not attach user');
    }
    return this.tagsService.create({
      actorUserId: request.user.id,
      workspaceId,
      ...dto,
    });
  }
}
