import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker, type ConnectionOptions } from 'bullmq';
import { getRedisConnection, type ServerEnv } from '@crm/config';
import { SERVER_ENV } from './worker-env.js';
import {
  type BootstrapJobData,
  type BootstrapJobResult,
  processBootstrapJob
} from './bootstrap-processor.js';

@Injectable()
export class BootstrapQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BootstrapQueueService.name);
  private readonly connection: ConnectionOptions;
  private readonly queue: Queue<BootstrapJobData, BootstrapJobResult, 'bootstrap.test'>;
  private readonly worker: Worker<BootstrapJobData, BootstrapJobResult, 'bootstrap.test'>;

  constructor(@Inject(SERVER_ENV) private readonly env: ServerEnv) {
    this.connection = {
      ...getRedisConnection(env),
      maxRetriesPerRequest: null
    };
    this.queue = new Queue<BootstrapJobData, BootstrapJobResult, 'bootstrap.test'>('bootstrap', {
      connection: this.connection
    });
    this.worker = new Worker<BootstrapJobData, BootstrapJobResult, 'bootstrap.test'>(
      'bootstrap',
      (job: Job<BootstrapJobData>) => Promise.resolve(processBootstrapJob(job)),
      {
        connection: this.connection,
        concurrency: env.WORKER_CONCURRENCY
      }
    );
  }

  async onModuleInit() {
    this.worker.on('completed', (job, result) => {
      this.logger.log(JSON.stringify({ queue: 'bootstrap', jobId: job.id, result }));
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        JSON.stringify({ queue: 'bootstrap', jobId: job?.id, error: error.message })
      );
    });

    await this.enqueueBootstrapJob('worker-startup');
  }

  async enqueueBootstrapJob(requestedBy: string) {
    return this.queue.add(
      'bootstrap.test',
      { requestedBy },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1_000
        },
        removeOnComplete: true,
        removeOnFail: 100
      }
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
  }
}
