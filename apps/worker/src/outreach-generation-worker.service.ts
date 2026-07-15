import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker, type ConnectionOptions } from 'bullmq';
import { AIService, type OutreachMessageInput } from '@crm/ai';
import { OUTREACH_GENERATION_QUEUE, prisma, toJsonInput, type PrismaClient } from '@crm/database';
import { getRedisConnection, type ServerEnv } from '@crm/config';
import { SERVER_ENV } from './worker-env.js';

@Injectable()
export class OutreachGenerationWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutreachGenerationWorkerService.name);
  private readonly worker: Worker<{ generationJobId: string }, unknown, string>;
  private readonly aiService: AIService;

  constructor(@Inject(SERVER_ENV) private readonly env: ServerEnv) {
    const connection: ConnectionOptions = {
      ...getRedisConnection(env),
      maxRetriesPerRequest: null,
    };
    this.aiService = new AIService(env);
    this.worker = new Worker(
      OUTREACH_GENERATION_QUEUE,
      (job: Job<{ generationJobId: string }>) =>
        processOutreachGenerationJob(prisma, this.aiService, this.env, job.data.generationJobId),
      {
        connection,
        concurrency: env.WORKER_CONCURRENCY,
      },
    );
  }

  onModuleInit() {
    this.worker.on('completed', (job) => {
      this.logger.log(
        JSON.stringify({
          queue: OUTREACH_GENERATION_QUEUE,
          jobId: job.id,
          generationJobId: job.data.generationJobId,
        }),
      );
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        JSON.stringify({
          queue: OUTREACH_GENERATION_QUEUE,
          jobId: job?.id,
          generationJobId: job?.data.generationJobId,
          error: error.message,
        }),
      );
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}

async function processOutreachGenerationJob(
  db: PrismaClient,
  aiService: AIService,
  env: ServerEnv,
  generationJobId: string,
) {
  const generationJob = await db.outreachGenerationJob.findUnique({
    where: { id: generationJobId },
    include: {
      outreach: {
        include: {
          instruction: true,
          workspace: true,
        },
      },
    },
  });
  if (!generationJob || !generationJob.outreach.instruction) {
    throw new Error(`Outreach generation job ${generationJobId} not found`);
  }

  await db.outreachGenerationJob.update({
    where: { id: generationJobId },
    data: { status: 'PROCESSING', startedAt: new Date(), errorMessage: null },
  });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  while (true) {
    const recipients = await db.outreachRecipient.findMany({
      where: {
        outreachId: generationJob.outreachId,
        workspaceId: generationJob.workspaceId,
        status: 'PENDING',
      },
      include: {
        person: {
          include: {
            organization: true,
            channels: { where: { status: 'ACTIVE' }, orderBy: [{ isPrimary: 'desc' }] },
            tags: { include: { tag: true } },
          },
        },
        messages: { where: { active: true }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
      take: env.OUTREACH_GENERATION_BATCH_SIZE,
    });

    if (recipients.length === 0) {
      break;
    }

    for (const recipient of recipients) {
      processed += 1;
      try {
        if (recipient.messages[0]) {
          await db.outreachRecipient.update({
            where: { id: recipient.id },
            data: { status: 'GENERATED' },
          });
          succeeded += 1;
        } else {
          const context: OutreachMessageInput = {
            objective: generationJob.outreach.instruction.objective,
            languageCode: generationJob.outreach.instruction.languageCode,
            tone: generationJob.outreach.instruction.tone,
            length: generationJob.outreach.instruction.length,
            workspaceContext: {
              name: generationJob.outreach.workspace.name,
              brandSummary: '',
              defaultLanguage: 'en',
            },
            person: recipient.person,
            organization: recipient.person.organization,
            channels: recipient.person.channels.map((channel) => ({
              type: channel.type,
              value: channel.value,
              isPrimary: channel.isPrimary,
            })),
            tags: recipient.person.tags.map(({ tag }) => tag.name),
            additionalContext: generationJob.outreach.instruction.additionalContext,
            previousMessage: null,
            regenerationInstruction: null,
          };
          const output = await aiService.generateOutreachMessage(context);
          await db.$transaction(async (tx) => {
            await tx.generatedMessage.create({
              data: {
                workspaceId: generationJob.workspaceId,
                outreachId: generationJob.outreachId,
                recipientId: recipient.id,
                subject: output.subject,
                body: output.body,
                cta: output.cta,
                status: 'GENERATED',
                generationVersion: 1,
                provider: output.provider,
                model: output.model,
                promptSnapshot: toJsonInput({
                  objective: context.objective,
                  languageCode: context.languageCode,
                  tone: context.tone,
                  length: context.length,
                  personId: recipient.personId,
                }),
                outputMetadata: toJsonInput(output.metadata),
              },
            });
            await tx.outreachRecipient.update({
              where: { id: recipient.id },
              data: { status: 'GENERATED' },
            });
          });
          succeeded += 1;
        }
      } catch {
        failed += 1;
        await db.outreachRecipient.update({
          where: { id: recipient.id },
          data: { status: 'FAILED' },
        });
      }

      await db.outreachGenerationJob.update({
        where: { id: generationJobId },
        data: { processed, succeeded, failed },
      });
    }
  }

  const [processedTotal, succeededTotal, failedTotal] = await Promise.all([
    db.outreachRecipient.count({
      where: {
        workspaceId: generationJob.workspaceId,
        outreachId: generationJob.outreachId,
        status: { in: ['GENERATED', 'APPROVED', 'FAILED'] },
      },
    }),
    db.outreachRecipient.count({
      where: {
        workspaceId: generationJob.workspaceId,
        outreachId: generationJob.outreachId,
        status: { in: ['GENERATED', 'APPROVED'] },
      },
    }),
    db.outreachRecipient.count({
      where: {
        workspaceId: generationJob.workspaceId,
        outreachId: generationJob.outreachId,
        status: 'FAILED',
      },
    }),
  ]);
  const finalStatus = failedTotal > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
  await db.$transaction(async (tx) => {
    await tx.outreachGenerationJob.update({
      where: { id: generationJobId },
      data: {
        status: finalStatus,
        processed: processedTotal,
        succeeded: succeededTotal,
        failed: failedTotal,
        completedAt: new Date(),
      },
    });
    await tx.outreach.update({
      where: { id: generationJob.outreachId },
      data: {
        status: succeededTotal > 0 ? 'READY_FOR_REVIEW' : 'FAILED',
        generatedRecipients: succeededTotal,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: generationJob.workspaceId,
        action:
          finalStatus === 'COMPLETED'
            ? 'outreach.generation.completed'
            : 'outreach.generation.completed_with_errors',
        entityType: 'OutreachGenerationJob',
        entityId: generationJobId,
        metadata: {
          outreachId: generationJob.outreachId,
          processed: processedTotal,
          succeeded: succeededTotal,
          failed: failedTotal,
        },
      },
    });
  });
}
