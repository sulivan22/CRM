import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { AI_PROCESSING_JOB, AI_PROCESSING_QUEUE, PROMPT_VERSION, type AIOperation } from '@crm/ai';
import { getRedisConnection, type ServerEnv } from '@crm/config';
import { Prisma } from '@crm/database';
import { Queue, type ConnectionOptions } from 'bullmq';
import { SERVER_ENV } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import type { AIRequestDto, ListAIInsightsQueryDto } from './dto.js';

const operationMap = {
  generate: 'generate',
  summarize: 'summarize',
  extract: 'extract',
  suggest_next_action: 'suggest_next_action',
} satisfies Record<string, AIOperation>;

@Injectable()
export class AIOrchestrationService implements OnModuleDestroy {
  private readonly queue: Queue<{ executionId: string }, unknown, typeof AI_PROCESSING_JOB>;

  constructor(
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
    private readonly prismaService: PrismaService,
  ) {
    const connection: ConnectionOptions = {
      ...getRedisConnection(env),
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue(AI_PROCESSING_QUEUE, { connection });
  }

  async enqueue(input: {
    actorUserId: string;
    workspaceId: string;
    operation: keyof typeof operationMap;
    dto: AIRequestDto;
  }) {
    if (!input.dto.personId && !input.dto.conversationId && !input.dto.instruction) {
      throw new BadRequestException('Provide personId, conversationId, or instruction.');
    }
    await this.assertTargets(input.workspaceId, input.dto);
    const settings = await this.resolveAISettings(input.workspaceId);
    if (!settings.enabled) {
      throw new BadRequestException('Workspace AI provider is disabled.');
    }
    const execution = await this.prismaService.client.aIExecution.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        operation: operationMap[input.operation],
        provider: settings.provider,
        model: settings.model,
        status: 'PENDING',
        promptVersion: PROMPT_VERSION,
        input: {
          personId: input.dto.personId,
          conversationId: input.dto.conversationId,
          instruction: input.dto.instruction,
        },
      },
    });
    await this.queue.add(
      AI_PROCESSING_JOB,
      { executionId: execution.id },
      {
        jobId: execution.id,
        attempts: this.env.AI_PROCESSING_ATTEMPTS,
        backoff: { type: 'exponential', delay: this.env.AI_PROCESSING_BACKOFF_MS },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
    return execution;
  }

  async getExecution(workspaceId: string, executionId: string) {
    const execution = await this.prismaService.client.aIExecution.findFirst({
      where: { id: executionId, workspaceId },
      include: { insights: true },
    });
    if (!execution) {
      throw new NotFoundException('AI execution not found');
    }
    return execution;
  }

  async listInsights(workspaceId: string, query: ListAIInsightsQueryDto) {
    return this.prismaService.client.aIInsight.findMany({
      where: {
        workspaceId,
        personId: query.personId,
        conversationId: query.conversationId,
        type: query.type as Prisma.EnumAIInsightTypeFilter | undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  private async resolveAISettings(workspaceId: string) {
    return (
      (await this.prismaService.client.workspaceAISettings.findUnique({
        where: { workspaceId },
      })) ??
      (await this.prismaService.client.workspaceAISettings.create({
        data: { workspaceId, provider: 'fake', model: 'fake-v1', enabled: true },
      }))
    );
  }

  private async assertTargets(workspaceId: string, dto: AIRequestDto) {
    if (dto.personId) {
      const person = await this.prismaService.client.person.findFirst({
        where: { id: dto.personId, workspaceId, status: { not: 'ARCHIVED' } },
      });
      if (!person) throw new NotFoundException('Person not found');
    }
    if (dto.conversationId) {
      const conversation = await this.prismaService.client.conversation.findFirst({
        where: { id: dto.conversationId, workspaceId },
      });
      if (!conversation) throw new NotFoundException('Conversation not found');
    }
  }
}
