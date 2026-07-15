import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AIOrchestrationService } from './ai.service.js';
import { AIRequestDto, ListAIInsightsQueryDto } from './dto.js';

@Controller('workspaces/:workspaceId/ai')
@UseGuards(AuthGuard, WorkspaceMembershipGuard)
export class AIController {
  constructor(private readonly aiService: AIOrchestrationService) {}

  @Post('generate')
  generate(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: AIRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.aiService.enqueue({
      actorUserId: requireUserId(request),
      workspaceId,
      operation: 'generate',
      dto,
    });
  }

  @Post('summarize')
  summarize(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: AIRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.aiService.enqueue({
      actorUserId: requireUserId(request),
      workspaceId,
      operation: 'summarize',
      dto,
    });
  }

  @Post('extract')
  extract(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: AIRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.aiService.enqueue({
      actorUserId: requireUserId(request),
      workspaceId,
      operation: 'extract',
      dto,
    });
  }

  @Post('suggest-next-action')
  suggestNextAction(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: AIRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.aiService.enqueue({
      actorUserId: requireUserId(request),
      workspaceId,
      operation: 'suggest_next_action',
      dto,
    });
  }

  @Get('executions/:executionId')
  getExecution(
    @Param('workspaceId') workspaceId: string,
    @Param('executionId') executionId: string,
  ) {
    return this.aiService.getExecution(workspaceId, executionId);
  }

  @Get('insights')
  listInsights(@Param('workspaceId') workspaceId: string, @Query() query: ListAIInsightsQueryDto) {
    return this.aiService.listInsights(workspaceId, query);
  }
}

function requireUserId(request: AuthenticatedRequest) {
  if (!request.user) {
    throw new Error('Auth guard did not attach user');
  }
  return request.user.id;
}
