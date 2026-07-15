import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard.js';
import { WorkspaceRolesGuard } from '../auth/workspace-roles.guard.js';
import { WorkspaceRoles } from '../auth/decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { InboxService } from './inbox.service.js';
import { ListInboxQueryDto, SimulateInboundDto, UpdateConversationDto } from './dto.js';

@Controller('workspaces/:workspaceId/inbox')
@UseGuards(AuthGuard, WorkspaceMembershipGuard)
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get()
  list(@Param('workspaceId') workspaceId: string, @Query() query: ListInboxQueryDto) {
    return this.inboxService.list(workspaceId, query);
  }

  @Get(':conversationId')
  get(@Param('workspaceId') workspaceId: string, @Param('conversationId') conversationId: string) {
    return this.inboxService.get(workspaceId, conversationId);
  }

  @Post(':conversationId/read')
  markRead(
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inboxService.markRead({
      actorUserId: requireUserId(request),
      workspaceId,
      conversationId,
    });
  }

  @Post(':conversationId/unread')
  markUnread(
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inboxService.markUnread({
      actorUserId: requireUserId(request),
      workspaceId,
      conversationId,
    });
  }

  @Patch(':conversationId')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  updateStatus(
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: UpdateConversationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inboxService.updateStatus({
      actorUserId: requireUserId(request),
      workspaceId,
      conversationId,
      status: dto.status,
    });
  }

  @Post('fake')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  simulateInbound(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SimulateInboundDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inboxService.simulateInbound({
      actorUserId: requireUserId(request),
      workspaceId,
      dto,
    });
  }
}

function requireUserId(request: AuthenticatedRequest) {
  if (!request.user) {
    throw new Error('Auth guard did not attach user');
  }
  return request.user.id;
}
