import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker, type ConnectionOptions } from 'bullmq';
import { createDeliveryProvider, DELIVERY_SEND_QUEUE, type DeliveryMessage } from '@crm/delivery';
import { getRedisConnection, type ServerEnv } from '@crm/config';
import { prisma, type PrismaClient } from '@crm/database';
import { SERVER_ENV } from './worker-env.js';

@Injectable()
export class DeliverySendWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliverySendWorkerService.name);
  private readonly worker: Worker<{ deliveryId: string }, unknown, string>;

  constructor(@Inject(SERVER_ENV) private readonly env: ServerEnv) {
    const connection: ConnectionOptions = {
      ...getRedisConnection(env),
      maxRetriesPerRequest: null,
    };
    this.worker = new Worker(
      DELIVERY_SEND_QUEUE,
      (job: Job<{ deliveryId: string }>) => processDeliveryJob(prisma, job.data.deliveryId),
      {
        connection,
        concurrency: env.WORKER_CONCURRENCY,
      },
    );
  }

  onModuleInit() {
    this.worker.on('completed', (job) => {
      this.logger.log(JSON.stringify({ queue: DELIVERY_SEND_QUEUE, jobId: job.id }));
    });
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        JSON.stringify({ queue: DELIVERY_SEND_QUEUE, jobId: job?.id, error: error.message }),
      );
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}

export async function processDeliveryJob(db: PrismaClient, deliveryId: string) {
  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      workspace: { include: { emailSettings: true } },
      generatedMessage: {
        include: {
          recipient: {
            include: {
              person: {
                include: {
                  channels: {
                    where: { type: 'EMAIL', status: 'ACTIVE' },
                    orderBy: [{ isPrimary: 'desc' }],
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
    throw new Error(`Delivery ${deliveryId} not found`);
  }
  if (delivery.status === 'SENT') {
    return delivery;
  }
  if (delivery.generatedMessage.status !== 'APPROVED') {
    await db.delivery.update({
      where: { id: delivery.id },
      data: { status: 'FAILED', error: 'Generated message is not approved.' },
    });
    throw new Error('Generated message is not approved.');
  }
  if (!delivery.workspace.emailSettings) {
    await db.delivery.update({
      where: { id: delivery.id },
      data: { status: 'FAILED', error: 'Workspace email settings are missing.' },
    });
    throw new Error('Workspace email settings are missing.');
  }
  const emailChannel = delivery.generatedMessage.recipient.person.channels[0];
  if (!emailChannel) {
    await db.delivery.update({
      where: { id: delivery.id },
      data: { status: 'FAILED', error: 'Recipient does not have an active email channel.' },
    });
    throw new Error('Recipient does not have an active email channel.');
  }

  const settings = delivery.workspace.emailSettings;
  if (!settings.enabled) {
    await db.delivery.update({
      where: { id: delivery.id },
      data: { status: 'FAILED', error: 'Workspace email provider is disabled.' },
    });
    throw new Error('Workspace email provider is disabled.');
  }
  await db.delivery.update({
    where: { id: delivery.id },
    data: { status: 'SENDING', error: null, provider: settings.provider },
  });

  const provider = createDeliveryProvider({ provider: settings.provider, apiKey: settings.apiKey });
  const message: DeliveryMessage = {
    idempotencyKey: delivery.id,
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
    replyTo: settings.replyTo,
    toEmail: emailChannel.value,
    subject: delivery.generatedMessage.subject,
    body: delivery.generatedMessage.body,
  };

  try {
    const result = await provider.send(message);
    return db.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'SENT',
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
        error: null,
      },
    });
  } catch (error) {
    await db.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message.slice(0, 500) : 'Delivery failed.',
      },
    });
    throw error;
  }
}
