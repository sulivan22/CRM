import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { DeliveryStatus, Prisma, type Delivery } from '@crm/database';
import { Queue, type ConnectionOptions } from 'bullmq';
import { DELIVERY_SEND_JOB, DELIVERY_SEND_QUEUE } from '@crm/delivery';
import { getRedisConnection, type ServerEnv } from '@crm/config';
import { SERVER_ENV } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import type { ListDeliveriesQueryDto } from './dto.js';

const deliveryInclude = {
  generatedMessage: {
    include: {
      outreach: true,
    },
  },
} satisfies Prisma.DeliveryInclude;

@Injectable()
export class DeliveriesService implements OnModuleDestroy {
  private readonly queue: Queue<{ deliveryId: string }, unknown, typeof DELIVERY_SEND_JOB>;

  constructor(
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
    private readonly prismaService: PrismaService,
  ) {
    const connection: ConnectionOptions = {
      ...getRedisConnection(env),
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue(DELIVERY_SEND_QUEUE, { connection });
  }

  async sendOutreach(input: {
    actorUserId: string;
    workspaceId: string;
    outreachId: string;
    retryFailed?: boolean;
  }) {
    const outreach = await this.prismaService.client.outreach.findFirst({
      where: { id: input.outreachId, workspaceId: input.workspaceId },
      include: { workspace: { include: { emailSettings: true } } },
    });
    if (!outreach) {
      throw new NotFoundException('Outreach not found');
    }
    const emailSettings =
      outreach.workspace.emailSettings ??
      (await this.prismaService.client.workspaceEmailSettings.create({
        data: {
          workspaceId: input.workspaceId,
          provider: 'fake',
          fromName: outreach.workspace.name,
          fromEmail: 'no-reply@example.test',
          enabled: true,
        },
      }));
    if (!emailSettings.enabled) {
      throw new BadRequestException('Workspace email provider is disabled.');
    }

    const messages = await this.prismaService.client.generatedMessage.findMany({
      where: {
        workspaceId: input.workspaceId,
        outreachId: input.outreachId,
        status: 'APPROVED',
        ...(input.retryFailed
          ? { delivery: { is: { status: 'FAILED' } } }
          : { delivery: { is: null } }),
      },
      orderBy: { createdAt: 'asc' },
    });

    if (messages.length === 0) {
      return { enqueued: 0, deliveryIds: [] as string[] };
    }

    const deliveries = await this.prismaService.client.$transaction(async (tx) => {
      const createdOrReset: Delivery[] = [];
      for (const message of messages) {
        if (input.retryFailed) {
          const delivery = await tx.delivery.update({
            where: { generatedMessageId: message.id },
            data: { status: 'PENDING', error: null, providerMessageId: null, sentAt: null },
          });
          createdOrReset.push(delivery);
        } else {
          const delivery = await tx.delivery.upsert({
            where: { generatedMessageId: message.id },
            update: {},
            create: {
              workspaceId: input.workspaceId,
              generatedMessageId: message.id,
              provider: emailSettings.provider,
              status: 'PENDING',
            },
          });
          createdOrReset.push(delivery);
        }
      }
      await tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          action: input.retryFailed ? 'delivery.retry_failed' : 'delivery.send_queued',
          entityType: 'Outreach',
          entityId: input.outreachId,
          metadata: { deliveries: createdOrReset.length },
        },
      });
      return createdOrReset;
    });

    await Promise.all(deliveries.map((delivery) => this.enqueueDelivery(delivery.id)));

    return { enqueued: deliveries.length, deliveryIds: deliveries.map((delivery) => delivery.id) };
  }

  async list(workspaceId: string, query: ListDeliveriesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);
    const outreachId: string | undefined = query.outreachId;
    const where: Prisma.DeliveryWhereInput = {
      workspaceId,
      status: query.status,
      generatedMessage: outreachId ? { outreachId } : undefined,
    };

    const [items, total, counters] = await Promise.all([
      this.prismaService.client.delivery.findMany({
        where,
        include: deliveryInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prismaService.client.delivery.count({ where }),
      this.deliveryCounters(workspaceId, outreachId),
    ]);

    return { items, page, pageSize, total, counters };
  }

  async get(workspaceId: string, deliveryId: string) {
    const delivery = await this.prismaService.client.delivery.findFirst({
      where: { id: deliveryId, workspaceId },
      include: deliveryInclude,
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    return delivery;
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  private async enqueueDelivery(deliveryId: string) {
    await this.queue.add(
      DELIVERY_SEND_JOB,
      { deliveryId },
      {
        jobId: deliveryId,
        attempts: this.env.DELIVERY_ATTEMPTS,
        backoff: { type: 'exponential', delay: this.env.DELIVERY_BACKOFF_MS },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }

  private async deliveryCounters(workspaceId: string, outreachId?: string) {
    const baseWhere: Prisma.DeliveryWhereInput = {
      workspaceId,
      generatedMessage: outreachId ? { outreachId } : undefined,
    };
    const [pending, sending, sent, failed] = await Promise.all(
      (['PENDING', 'SENDING', 'SENT', 'FAILED'] satisfies DeliveryStatus[]).map((status) =>
        this.prismaService.client.delivery.count({ where: { ...baseWhere, status } }),
      ),
    );
    return { pending, sending, sent, failed };
  }
}
