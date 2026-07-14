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
import { CommunicationChannelType, PersonStatus } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard.js';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard.js';
import { WorkspaceRolesGuard } from '../auth/workspace-roles.guard.js';
import { WorkspaceRoles } from '../auth/decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AddTagDto, CreatePersonDto, PersonChannelDto, UpdatePersonDto } from './dto.js';
import { PeopleService } from './people.service.js';

@Controller('workspaces/:workspaceId/people')
@UseGuards(AuthGuard, WorkspaceMembershipGuard)
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get()
  list(
    @Param('workspaceId') workspaceId: string,
    @Query('search') search?: string,
    @Query('organizationId') organizationId?: string,
    @Query('tagId') tagId?: string,
    @Query('countryCode') countryCode?: string,
    @Query('languageCode') languageCode?: string,
    @Query('channelType') channelType?: CommunicationChannelType,
    @Query('status') status?: PersonStatus,
  ) {
    return this.peopleService.list(workspaceId, {
      search,
      organizationId,
      tagId,
      countryCode,
      languageCode,
      channelType,
      status,
    });
  }

  @Post()
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreatePersonDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.peopleService.create({
      actorUserId: requireUserId(request),
      workspaceId,
      ...dto,
    });
  }

  @Get(':personId')
  get(@Param('workspaceId') workspaceId: string, @Param('personId') personId: string) {
    return this.peopleService.get(workspaceId, personId);
  }

  @Patch(':personId')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('personId') personId: string,
    @Body() dto: UpdatePersonDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.peopleService.update({
      actorUserId: requireUserId(request),
      workspaceId,
      personId,
      ...dto,
    });
  }

  @Delete(':personId')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  archive(
    @Param('workspaceId') workspaceId: string,
    @Param('personId') personId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.peopleService.archive({
      actorUserId: requireUserId(request),
      workspaceId,
      personId,
    });
  }

  @Post(':personId/channels')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  addChannel(
    @Param('workspaceId') workspaceId: string,
    @Param('personId') personId: string,
    @Body() channel: PersonChannelDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.peopleService.addChannel({
      actorUserId: requireUserId(request),
      workspaceId,
      personId,
      channel,
    });
  }

  @Delete(':personId/channels/:channelId')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  archiveChannel(
    @Param('workspaceId') workspaceId: string,
    @Param('personId') personId: string,
    @Param('channelId') channelId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.peopleService.archiveChannel({
      actorUserId: requireUserId(request),
      workspaceId,
      personId,
      channelId,
    });
  }

  @Post(':personId/tags')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  assignTag(
    @Param('workspaceId') workspaceId: string,
    @Param('personId') personId: string,
    @Body() dto: AddTagDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.peopleService.assignTag({
      actorUserId: requireUserId(request),
      workspaceId,
      personId,
      tagId: dto.tagId,
    });
  }

  @Delete(':personId/tags/:tagId')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  removeTag(
    @Param('workspaceId') workspaceId: string,
    @Param('personId') personId: string,
    @Param('tagId') tagId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.peopleService.removeTag({
      actorUserId: requireUserId(request),
      workspaceId,
      personId,
      tagId,
    });
  }
}

function requireUserId(request: AuthenticatedRequest) {
  if (!request.user) {
    throw new Error('Auth guard did not attach user');
  }
  return request.user.id;
}
