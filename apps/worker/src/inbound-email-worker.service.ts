import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker, type ConnectionOptions } from 'bullmq';
import { getRedisConnection, type ServerEnv } from '@crm/config';
import { prisma, Prisma, type PrismaClient } from '@crm/database';
import {
  createInboundProvider,
  INBOUND_EMAIL_QUEUE,
  type NormalizedInboundMessage,
} from '@crm/inbox';
import { SERVER_ENV } from './worker-env.js';

@Injectable()
export class InboundEmailWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboundEmailWorkerService.name);
  private readonly worker: Worker<{ eventId: string }, unknown, string>;

  constructor(@Inject(SERVER_ENV) private readonly env: ServerEnv) {
    const connection: ConnectionOptions = {
      ...getRedisConnection(env),
      maxRetriesPerRequest: null,
    };
    this.worker = new Worker(
      INBOUND_EMAIL_QUEUE,
      (job: Job<{ eventId: string }>) => processInboundEmailJob(prisma, this.env, job.data.eventId),
      {
        connection,
        concurrency: env.WORKER_CONCURRENCY,
      },
    );
  }

  onModuleInit() {
    this.worker.on('completed', (job) => {
      this.logger.log(JSON.stringify({ queue: INBOUND_EMAIL_QUEUE, jobId: job.id }));
    });
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        JSON.stringify({ queue: INBOUND_EMAIL_QUEUE, jobId: job?.id, error: error.message }),
      );
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}

const deliveryInclude = {
  generatedMessage: {
    include: {
      outreach: true,
      recipient: {
        include: {
          person: true,
        },
      },
    },
  },
} satisfies Prisma.DeliveryInclude;

export async function processInboundEmailJob(db: PrismaClient, env: ServerEnv, eventId: string) {
  const event = await db.inboundWebhookEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new Error(`Inbound webhook event ${eventId} not found`);
  }
  if (event.status === 'PROCESSED' || event.status === 'IGNORED') {
    return event;
  }

  const provider = createInboundProvider({
    provider: event.provider,
    webhookSecret: env.RESEND_WEBHOOK_SECRET,
  });
  const payload = event.payload as Record<string, unknown>;
  const normalized = provider.normalize(payload);
  if (!normalized) {
    return markEventIgnored(
      db,
      event.id,
      event.workspaceId,
      'Unsupported or incomplete inbound event.',
    );
  }

  try {
    const duplicate = await db.inboundMessage.findUnique({
      where: {
        provider_providerMessageId: {
          provider: normalized.provider,
          providerMessageId: normalized.providerMessageId,
        },
      },
    });
    if (duplicate) {
      return db.inboundWebhookEvent.update({
        where: { id: event.id },
        data: {
          workspaceId: duplicate.workspaceId,
          status: 'PROCESSED',
          errorMessage: null,
          processedAt: new Date(),
        },
      });
    }

    const correlated = await correlateInboundMessage(db, normalized);
    if (!correlated) {
      return markEventIgnored(db, event.id, null, 'Inbound message could not be correlated.');
    }

    return db.$transaction(async (tx) => {
      const conversation =
        correlated.conversation ??
        (await tx.conversation.findFirst({
          where: {
            workspaceId: correlated.workspaceId,
            deliveryId: correlated.deliveryId,
          },
        })) ??
        (await tx.conversation.create({
          data: {
            workspaceId: correlated.workspaceId,
            personId: correlated.personId,
            outreachId: correlated.outreachId,
            generatedMessageId: correlated.generatedMessageId,
            deliveryId: correlated.deliveryId,
            channel: 'EMAIL',
            subject: normalized.subject,
            status: 'OPEN',
            lastMessageAt: normalized.receivedAt,
            unreadCount: 0,
          },
        }));

      await tx.inboundMessage.create({
        data: {
          workspaceId: correlated.workspaceId,
          conversationId: conversation.id,
          provider: normalized.provider,
          providerMessageId: normalized.providerMessageId,
          providerThreadId: normalized.providerThreadId,
          fromAddress: normalized.fromAddress,
          toAddress: normalized.toAddress,
          replyToAddress: normalized.replyToAddress,
          subject: normalized.subject,
          textBody: normalized.textBody,
          htmlBody: normalized.htmlBody,
          headers: jsonOrUndefined(normalized.headers),
          receivedAt: normalized.receivedAt,
          rawMetadata: jsonOrUndefined(normalized.rawMetadata),
        },
      });

      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          subject: conversation.subject ?? normalized.subject,
          lastMessageAt: normalized.receivedAt,
          unreadCount: { increment: 1 },
          status: conversation.status === 'ARCHIVED' ? 'ARCHIVED' : 'OPEN',
        },
      });

      return tx.inboundWebhookEvent.update({
        where: { id: event.id },
        data: {
          workspaceId: correlated.workspaceId,
          status: 'PROCESSED',
          errorMessage: null,
          processedAt: new Date(),
        },
      });
    });
  } catch (error) {
    await db.inboundWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: 'FAILED',
        errorMessage:
          error instanceof Error ? error.message.slice(0, 500) : 'Inbound processing failed.',
      },
    });
    throw error;
  }
}

async function correlateInboundMessage(db: PrismaClient, normalized: NormalizedInboundMessage) {
  if (normalized.providerThreadId) {
    const existingThreadMessage = await db.inboundMessage.findFirst({
      where: { provider: normalized.provider, providerThreadId: normalized.providerThreadId },
      include: { conversation: true },
      orderBy: { receivedAt: 'desc' },
    });
    if (existingThreadMessage) {
      return {
        workspaceId: existingThreadMessage.workspaceId,
        personId: existingThreadMessage.conversation.personId,
        outreachId: existingThreadMessage.conversation.outreachId,
        generatedMessageId: existingThreadMessage.conversation.generatedMessageId,
        deliveryId: existingThreadMessage.conversation.deliveryId,
        conversation: existingThreadMessage.conversation,
      };
    }
  }

  const delivery = await findCorrelatedDelivery(db, normalized);
  if (!delivery) {
    return null;
  }

  return {
    workspaceId: delivery.workspaceId,
    personId: delivery.generatedMessage.recipient.person.id,
    outreachId: delivery.generatedMessage.outreachId,
    generatedMessageId: delivery.generatedMessageId,
    deliveryId: delivery.id,
    conversation: null,
  };
}

async function findCorrelatedDelivery(db: PrismaClient, normalized: NormalizedInboundMessage) {
  const messageId = normalized.deliveryProviderMessageId ?? extractReplyToken(normalized.toAddress);
  if (messageId) {
    const matches = await db.delivery.findMany({
      where: { providerMessageId: messageId },
      include: deliveryInclude,
      take: 2,
    });
    if (matches.length === 1) {
      return matches[0];
    }
  }

  const normalizedFrom = normalized.fromAddress.trim().toLowerCase();
  const subject = stripReplyPrefix(normalized.subject);
  const subjectWhere = subject
    ? { subject: { equals: subject, mode: 'insensitive' as const } }
    : {};
  const matches = await db.delivery.findMany({
    where: {
      status: 'SENT',
      generatedMessage: {
        ...subjectWhere,
        recipient: {
          person: {
            channels: {
              some: {
                type: 'EMAIL',
                normalizedValue: normalizedFrom,
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    },
    include: deliveryInclude,
    take: 2,
  });
  return matches.length === 1 ? matches[0] : null;
}

async function markEventIgnored(
  db: PrismaClient,
  eventId: string,
  workspaceId: string | null,
  reason: string,
) {
  return db.inboundWebhookEvent.update({
    where: { id: eventId },
    data: {
      workspaceId,
      status: 'IGNORED',
      errorMessage: reason,
      processedAt: new Date(),
    },
  });
}

function extractReplyToken(address: string) {
  return address.match(/reply\+([0-9a-f-]{36})@/i)?.[1];
}

function stripReplyPrefix(subject?: string | null) {
  return subject?.replace(/^(\s*(re|fw|fwd):\s*)+/i, '').trim();
}

function jsonOrUndefined(value?: Record<string, unknown> | null) {
  return value ? (value as Prisma.InputJsonValue) : undefined;
}
