import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AI_PROCESSING_QUEUE, AIService, type AIContext, type AIOperation } from '@crm/ai';
import { getRedisConnection, type ServerEnv } from '@crm/config';
import { prisma, Prisma, type PrismaClient } from '@crm/database';
import { Job, Worker, type ConnectionOptions } from 'bullmq';
import { SERVER_ENV } from './worker-env.js';

@Injectable()
export class AIProcessingWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AIProcessingWorkerService.name);
  private readonly worker: Worker<{ executionId: string }, unknown, string>;

  constructor(@Inject(SERVER_ENV) private readonly env: ServerEnv) {
    const connection: ConnectionOptions = {
      ...getRedisConnection(env),
      maxRetriesPerRequest: null,
    };
    this.worker = new Worker(
      AI_PROCESSING_QUEUE,
      (job: Job<{ executionId: string }>) => processAIExecutionJob(prisma, job.data.executionId),
      {
        connection,
        concurrency: env.WORKER_CONCURRENCY,
      },
    );
  }

  onModuleInit() {
    this.worker.on('completed', (job) => {
      this.logger.log(JSON.stringify({ queue: AI_PROCESSING_QUEUE, jobId: job.id }));
    });
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        JSON.stringify({ queue: AI_PROCESSING_QUEUE, jobId: job?.id, error: error.message }),
      );
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}

export async function processAIExecutionJob(db: PrismaClient, executionId: string) {
  const execution = await db.aIExecution.findUnique({ where: { id: executionId } });
  if (!execution) {
    throw new Error(`AI execution ${executionId} not found`);
  }
  if (execution.status === 'COMPLETED') {
    return execution;
  }

  await db.aIExecution.update({
    where: { id: execution.id },
    data: { status: 'PROCESSING', startedAt: new Date(), errorMessage: null },
  });

  try {
    const input = execution.input as {
      personId?: string;
      conversationId?: string;
      instruction?: string;
    };
    const context = await buildAIContext(db, execution.workspaceId, input);
    const operation = execution.operation as AIOperation;
    const aiService = await resolveWorkspaceAIService(db, execution.workspaceId);
    const result = await aiService.run(operation, context);
    const insightType = insightTypeFor(operation);

    return db.$transaction(async (tx) => {
      await tx.aIInsight.create({
        data: {
          workspaceId: execution.workspaceId,
          executionId: execution.id,
          personId: input.personId ?? context.person?.id,
          conversationId: input.conversationId ?? context.conversation?.id,
          type: insightType,
          title: result.title,
          content: result.content,
          confidence: result.confidence,
          data: result.data as Prisma.InputJsonValue,
        },
      });
      return tx.aIExecution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          provider: result.provider,
          model: result.model,
          output: result as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
          errorMessage: null,
        },
      });
    });
  } catch (error) {
    await db.aIExecution.update({
      where: { id: execution.id },
      data: {
        status: 'FAILED',
        errorMessage:
          error instanceof Error ? error.message.slice(0, 500) : 'AI processing failed.',
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

async function resolveWorkspaceAIService(db: PrismaClient, workspaceId: string) {
  const settings =
    (await db.workspaceAISettings.findUnique({ where: { workspaceId } })) ??
    (await db.workspaceAISettings.create({
      data: { workspaceId, provider: 'fake', model: 'fake-v1', enabled: true },
    }));
  if (!settings.enabled) {
    throw new Error('Workspace AI provider is disabled.');
  }
  return new AIService({
    provider: settings.provider === 'openai' ? 'openai' : 'fake',
    model: settings.model,
    apiKey: settings.apiKey,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
  });
}

async function buildAIContext(
  db: PrismaClient,
  workspaceId: string,
  input: { personId?: string; conversationId?: string; instruction?: string },
): Promise<AIContext> {
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const [person, conversation] = await Promise.all([
    input.personId
      ? db.person.findFirst({
          where: { id: input.personId, workspaceId },
          include: {
            organization: true,
            channels: { where: { status: 'ACTIVE' }, orderBy: [{ isPrimary: 'desc' }] },
            tags: { include: { tag: true } },
          },
        })
      : null,
    input.conversationId
      ? db.conversation.findFirst({
          where: { id: input.conversationId, workspaceId },
          include: {
            person: true,
            messages: { orderBy: { receivedAt: 'asc' }, take: 20 },
          },
        })
      : null,
  ]);

  const contextPerson = person ?? conversation?.person ?? null;
  const personOrganization = person?.organization?.name ?? null;
  const personTags = person?.tags.map(({ tag }) => tag.name) ?? [];
  const personChannels =
    person?.channels.map((channel) => `${channel.type}:${channel.value}`) ?? [];
  return {
    workspace: { id: workspace.id, name: workspace.name },
    person: contextPerson
      ? {
          id: contextPerson.id,
          displayName: contextPerson.displayName,
          jobTitle: contextPerson.jobTitle,
          organization: personOrganization,
          tags: personTags,
          channels: personChannels,
        }
      : null,
    conversation: conversation
      ? {
          id: conversation.id,
          subject: conversation.subject,
          messages: conversation.messages.map((message) => ({
            from: message.fromAddress,
            subject: message.subject,
            body: message.textBody,
            receivedAt: message.receivedAt.toISOString(),
          })),
        }
      : null,
    instruction: input.instruction,
  };
}

function insightTypeFor(operation: AIOperation) {
  if (operation === 'summarize') return 'REPLY_SUMMARY';
  if (operation === 'extract') return 'FACT_EXTRACTION';
  if (operation === 'classify_intent') return 'INTENT_CLASSIFICATION';
  if (operation === 'suggest_next_action') return 'NEXT_ACTION';
  return 'GENERATED_TEXT';
}
