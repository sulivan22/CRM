import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConversationStatus, Prisma } from '@crm/database';
import { getRedisConnection, type ServerEnv } from '@crm/config';
import {
  FakeInboundProvider,
  INBOUND_EMAIL_JOB,
  INBOUND_EMAIL_QUEUE,
  ResendInboundProvider,
  type InboundWebhookHeaders,
} from '@crm/inbox';
import { Queue, type ConnectionOptions } from 'bullmq';
import { SERVER_ENV } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import type { ListInboxQueryDto, SimulateInboundDto } from './dto.js';

const conversationInclude = {
  person: true,
  outreach: true,
  delivery: true,
  generatedMessage: true,
  messages: {
    orderBy: { receivedAt: 'desc' },
    take: 1,
  },
} satisfies Prisma.ConversationInclude;

@Injectable()
export class InboxService implements OnModuleDestroy {
  private readonly queue: Queue<{ eventId: string }, unknown, typeof INBOUND_EMAIL_JOB>;

  constructor(
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
    private readonly prismaService: PrismaService,
  ) {
    const connection: ConnectionOptions = {
      ...getRedisConnection(env),
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue(INBOUND_EMAIL_QUEUE, { connection });
  }

  async receiveResendWebhook(input: { rawBody: string; headers: InboundWebhookHeaders }) {
    if (Buffer.byteLength(input.rawBody, 'utf8') > this.env.INBOUND_MAX_BODY_BYTES) {
      throw new PayloadTooLargeException('Inbound webhook payload is too large.');
    }

    const provider = new ResendInboundProvider(this.env.RESEND_WEBHOOK_SECRET ?? '');
    let verified;
    try {
      verified = provider.verifyWebhook(input.rawBody, input.headers);
    } catch {
      throw new UnauthorizedException('Invalid inbound webhook signature.');
    }

    const event = await this.createWebhookEvent({
      provider: verified.provider,
      providerEventId: verified.providerEventId,
      eventType: verified.eventType,
      payloadHash: verified.payloadHash,
      payload: verified.payload,
    });
    await this.enqueueInboundEvent(event.id);
    return { accepted: true, eventId: event.id };
  }

  async simulateInbound(input: {
    actorUserId: string;
    workspaceId: string;
    dto: SimulateInboundDto;
  }) {
    const delivery = await this.prismaService.client.delivery.findFirst({
      where: { id: input.dto.deliveryId, workspaceId: input.workspaceId },
      include: {
        generatedMessage: {
          include: {
            recipient: {
              include: {
                person: {
                  include: {
                    channels: {
                      where: { type: 'EMAIL', status: 'ACTIVE' },
                      orderBy: [{ isPrimary: 'desc' }],
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    const email = delivery.generatedMessage.recipient.person.channels[0]?.value;
    if (!email) {
      throw new BadRequestException('Delivery recipient does not have an active email channel.');
    }

    const payload = {
      id: `fake_evt_${delivery.id}_${Date.now()}`,
      type: 'email.received',
      data: {
        providerMessageId: `fake_in_${delivery.id}_${Date.now()}`,
        deliveryProviderMessageId: delivery.providerMessageId ?? `fake_${delivery.id}`,
        from: email,
        to: 'inbound@example.test',
        subject: input.dto.subject ?? `Re: ${delivery.generatedMessage.subject}`,
        textBody: input.dto.textBody ?? 'Simulated inbound reply.',
        htmlBody: input.dto.htmlBody,
        receivedAt: new Date().toISOString(),
      },
    };
    const rawBody = JSON.stringify(payload);
    const verified = new FakeInboundProvider().verifyWebhook(rawBody, { id: payload.id });
    const event = await this.createWebhookEvent({
      provider: verified.provider,
      providerEventId: verified.providerEventId,
      eventType: verified.eventType,
      payloadHash: verified.payloadHash,
      payload: verified.payload,
    });

    await this.prismaService.client.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        action: 'inbox.fake_inbound_queued',
        entityType: 'Delivery',
        entityId: delivery.id,
        metadata: { eventId: event.id },
      },
    });
    await this.enqueueInboundEvent(event.id);
    return { accepted: true, eventId: event.id };
  }

  async list(workspaceId: string, query: ListInboxQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);
    const where: Prisma.ConversationWhereInput = {
      workspaceId,
      status: query.status,
      personId: query.personId,
      outreachId: query.outreachId,
      unreadCount: query.unreadOnly ? { gt: 0 } : undefined,
      OR: query.search
        ? [
            { subject: { contains: query.search, mode: 'insensitive' } },
            { person: { displayName: { contains: query.search, mode: 'insensitive' } } },
            { messages: { some: { textBody: { contains: query.search, mode: 'insensitive' } } } },
            {
              messages: { some: { fromAddress: { contains: query.search, mode: 'insensitive' } } },
            },
          ]
        : undefined,
    };

    const [items, total, counters] = await Promise.all([
      this.prismaService.client.conversation.findMany({
        where,
        include: conversationInclude,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prismaService.client.conversation.count({ where }),
      this.conversationCounters(workspaceId),
    ]);

    return { items, page, pageSize, total, counters };
  }

  async get(workspaceId: string, conversationId: string) {
    const conversation = await this.prismaService.client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
      include: {
        person: true,
        outreach: true,
        delivery: true,
        generatedMessage: true,
        messages: { orderBy: { receivedAt: 'asc' } },
      },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  async markRead(input: { actorUserId: string; workspaceId: string; conversationId: string }) {
    await this.ensureConversation(input.workspaceId, input.conversationId);
    const now = new Date();
    const conversation = await this.prismaService.client.$transaction(async (tx) => {
      await tx.inboundMessage.updateMany({
        where: {
          workspaceId: input.workspaceId,
          conversationId: input.conversationId,
          readAt: null,
        },
        data: { readAt: now },
      });
      const updated = await tx.conversation.update({
        where: { id: input.conversationId },
        data: { unreadCount: 0 },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          action: 'inbox.mark_read',
          entityType: 'Conversation',
          entityId: input.conversationId,
          metadata: {},
        },
      });
      return updated;
    });
    return conversation;
  }

  async markUnread(input: { actorUserId: string; workspaceId: string; conversationId: string }) {
    const conversation = await this.ensureConversation(input.workspaceId, input.conversationId);
    const latest = await this.prismaService.client.inboundMessage.findFirst({
      where: { workspaceId: input.workspaceId, conversationId: input.conversationId },
      orderBy: { receivedAt: 'desc' },
    });
    if (!latest) {
      return conversation;
    }

    return this.prismaService.client.$transaction(async (tx) => {
      await tx.inboundMessage.update({
        where: { id: latest.id },
        data: { readAt: null },
      });
      const updated = await tx.conversation.update({
        where: { id: input.conversationId },
        data: { unreadCount: { increment: conversation.unreadCount === 0 ? 1 : 0 } },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          action: 'inbox.mark_unread',
          entityType: 'Conversation',
          entityId: input.conversationId,
          metadata: {},
        },
      });
      return updated;
    });
  }

  async updateStatus(input: {
    actorUserId: string;
    workspaceId: string;
    conversationId: string;
    status: ConversationStatus;
  }) {
    await this.ensureConversation(input.workspaceId, input.conversationId);
    const updated = await this.prismaService.client.conversation.update({
      where: { id: input.conversationId },
      data: { status: input.status },
    });
    await this.prismaService.client.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        action: 'inbox.status_updated',
        entityType: 'Conversation',
        entityId: input.conversationId,
        metadata: { status: input.status },
      },
    });
    return updated;
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  private async createWebhookEvent(input: {
    provider: string;
    providerEventId: string;
    eventType: string;
    payloadHash: string;
    payload: Record<string, unknown>;
  }) {
    try {
      return await this.prismaService.client.inboundWebhookEvent.create({
        data: {
          provider: input.provider,
          providerEventId: input.providerEventId,
          eventType: input.eventType,
          payloadHash: input.payloadHash,
          payload: input.payload as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = await this.prismaService.client.inboundWebhookEvent.findUniqueOrThrow({
          where: {
            provider_providerEventId: {
              provider: input.provider,
              providerEventId: input.providerEventId,
            },
          },
        });
        return existing;
      }
      throw error;
    }
  }

  private async enqueueInboundEvent(eventId: string) {
    await this.queue.add(
      INBOUND_EMAIL_JOB,
      { eventId },
      {
        jobId: eventId,
        attempts: this.env.INBOUND_ATTEMPTS,
        backoff: { type: 'exponential', delay: this.env.INBOUND_BACKOFF_MS },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }

  private async ensureConversation(workspaceId: string, conversationId: string) {
    const conversation = await this.prismaService.client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  private async conversationCounters(workspaceId: string) {
    const [open, closed, archived, unread] = await Promise.all([
      this.prismaService.client.conversation.count({ where: { workspaceId, status: 'OPEN' } }),
      this.prismaService.client.conversation.count({ where: { workspaceId, status: 'CLOSED' } }),
      this.prismaService.client.conversation.count({ where: { workspaceId, status: 'ARCHIVED' } }),
      this.prismaService.client.conversation.count({
        where: { workspaceId, unreadCount: { gt: 0 } },
      }),
    ]);
    return { open, closed, archived, unread };
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}
