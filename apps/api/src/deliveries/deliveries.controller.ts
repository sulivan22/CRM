import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard.js';
import { WorkspaceRolesGuard } from '../auth/workspace-roles.guard.js';
import { WorkspaceRoles } from '../auth/decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { DeliveriesService } from './deliveries.service.js';
import { ListDeliveriesQueryDto, SendOutreachDto } from './dto.js';

@Controller('workspaces/:workspaceId')
@UseGuards(AuthGuard, WorkspaceMembershipGuard)
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Post('outreach/:outreachId/send')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  sendOutreach(
    @Param('workspaceId') workspaceId: string,
    @Param('outreachId') outreachId: string,
    @Body() dto: SendOutreachDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.deliveriesService.sendOutreach({
      actorUserId: requireUserId(request),
      workspaceId,
      outreachId,
      retryFailed: dto.retryFailed,
    });
  }

  @Get('deliveries')
  list(@Param('workspaceId') workspaceId: string, @Query() query: ListDeliveriesQueryDto) {
    return this.deliveriesService.list(workspaceId, query);
  }

  @Get('deliveries/:id')
  get(@Param('workspaceId') workspaceId: string, @Param('id') deliveryId: string) {
    return this.deliveriesService.get(workspaceId, deliveryId);
  }
}

function requireUserId(request: AuthenticatedRequest) {
  if (!request.user) {
    throw new Error('Auth guard did not attach user');
  }
  return request.user.id;
}
