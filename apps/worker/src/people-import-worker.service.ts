import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker, type ConnectionOptions } from 'bullmq';
import { PEOPLE_IMPORT_QUEUE, prisma, processPeopleImportJob } from '@crm/database';
import { getRedisConnection, type ServerEnv } from '@crm/config';
import { SERVER_ENV } from './worker-env.js';

@Injectable()
export class PeopleImportWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PeopleImportWorkerService.name);
  private readonly connection: ConnectionOptions;
  private readonly worker: Worker<{ importJobId: string }, unknown, string>;

  constructor(@Inject(SERVER_ENV) private readonly env: ServerEnv) {
    this.connection = {
      ...getRedisConnection(env),
      maxRetriesPerRequest: null,
    };
    this.worker = new Worker(
      PEOPLE_IMPORT_QUEUE,
      (job: Job<{ importJobId: string }>) => processPeopleImportJob(prisma, job.data.importJobId),
      {
        connection: this.connection,
        concurrency: env.WORKER_CONCURRENCY,
      },
    );
  }

  onModuleInit() {
    this.worker.on('completed', (job) => {
      this.logger.log(
        JSON.stringify({
          queue: PEOPLE_IMPORT_QUEUE,
          jobId: job.id,
          importJobId: job.data.importJobId,
        }),
      );
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        JSON.stringify({
          queue: PEOPLE_IMPORT_QUEUE,
          jobId: job?.id,
          importJobId: job?.data.importJobId,
          error: error.message,
        }),
      );
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
