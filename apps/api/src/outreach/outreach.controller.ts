import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard.js';
import { WorkspaceRolesGuard } from '../auth/workspace-roles.guard.js';
import { WorkspaceRoles } from '../auth/decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import {
  CreateOutreachDto,
  ListMessagesQueryDto,
  ListOutreachQueryDto,
  RegenerateMessageDto,
  ResolveAudienceDto,
  UpdateMessageDto,
  UpdateOutreachDto,
} from './dto.js';
import { OutreachService } from './outreach.service.js';

@Controller('workspaces/:workspaceId/outreach')
@UseGuards(AuthGuard, WorkspaceMembershipGuard)
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  @Post('audience/resolve')
  resolveAudience(@Param('workspaceId') workspaceId: string, @Body() dto: ResolveAudienceDto) {
    return this.outreachService.resolveAudience(workspaceId, dto.audience);
  }

  @Post()
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateOutreachDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.outreachService.create({
      actorUserId: requireUserId(request),
      workspaceId,
      dto,
    });
  }

  @Get()
  list(@Param('workspaceId') workspaceId: string, @Query() query: ListOutreachQueryDto) {
    return this.outreachService.list(workspaceId, query);
  }

  @Get(':outreachId')
  get(@Param('workspaceId') workspaceId: string, @Param('outreachId') outreachId: string) {
    return this.outreachService.get(workspaceId, outreachId);
  }

  @Patch(':outreachId')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('outreachId') outreachId: string,
    @Body() dto: UpdateOutreachDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.outreachService.update({
      actorUserId: requireUserId(request),
      workspaceId,
      outreachId,
      dto,
    });
  }

  @Delete(':outreachId')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  archive(
    @Param('workspaceId') workspaceId: string,
    @Param('outreachId') outreachId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.outreachService.archive({
      actorUserId: requireUserId(request),
      workspaceId,
      outreachId,
    });
  }

  @Post(':outreachId/generate')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  generate(
    @Param('workspaceId') workspaceId: string,
    @Param('outreachId') outreachId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.outreachService.enqueueGeneration({
      actorUserId: requireUserId(request),
      workspaceId,
      outreachId,
    });
  }

  @Get(':outreachId/generation')
  generation(@Param('workspaceId') workspaceId: string, @Param('outreachId') outreachId: string) {
    return this.outreachService.getGeneration(workspaceId, outreachId);
  }

  @Get(':outreachId/messages')
  listMessages(
    @Param('workspaceId') workspaceId: string,
    @Param('outreachId') outreachId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.outreachService.listMessages(workspaceId, outreachId, query);
  }

  @Get(':outreachId/messages/:messageId')
  getMessage(
    @Param('workspaceId') workspaceId: string,
    @Param('outreachId') outreachId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.outreachService.getMessage(workspaceId, outreachId, messageId);
  }

  @Patch(':outreachId/messages/:messageId')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  updateMessage(
    @Param('workspaceId') workspaceId: string,
    @Param('outreachId') outreachId: string,
    @Param('messageId') messageId: string,
    @Body() dto: UpdateMessageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.outreachService.updateMessage({
      actorUserId: requireUserId(request),
      workspaceId,
      outreachId,
      messageId,
      dto,
    });
  }

  @Post(':outreachId/messages/:messageId/regenerate')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  regenerateMessage(
    @Param('workspaceId') workspaceId: string,
    @Param('outreachId') outreachId: string,
    @Param('messageId') messageId: string,
    @Body() dto: RegenerateMessageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.outreachService.regenerateMessage({
      actorUserId: requireUserId(request),
      workspaceId,
      outreachId,
      messageId,
      dto,
    });
  }

  @Post(':outreachId/messages/:messageId/approve')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  approveMessage(
    @Param('workspaceId') workspaceId: string,
    @Param('outreachId') outreachId: string,
    @Param('messageId') messageId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.outreachService.setMessageStatus({
      actorUserId: requireUserId(request),
      workspaceId,
      outreachId,
      messageId,
      status: 'APPROVED',
    });
  }

  @Post(':outreachId/messages/:messageId/reject')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  rejectMessage(
    @Param('workspaceId') workspaceId: string,
    @Param('outreachId') outreachId: string,
    @Param('messageId') messageId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.outreachService.setMessageStatus({
      actorUserId: requireUserId(request),
      workspaceId,
      outreachId,
      messageId,
      status: 'REJECTED',
    });
  }

  @Post(':outreachId/approve')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  approveAll(
    @Param('workspaceId') workspaceId: string,
    @Param('outreachId') outreachId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.outreachService.approveAll({
      actorUserId: requireUserId(request),
      workspaceId,
      outreachId,
    });
  }
}

function requireUserId(request: AuthenticatedRequest) {
  if (!request.user) {
    throw new Error('Auth guard did not attach user');
  }
  return request.user.id;
}
