import { Module } from '@nestjs/common';
import { serverEnvProvider } from './worker-env.js';
import { BootstrapQueueService } from './bootstrap-queue.service.js';
import { PeopleImportWorkerService } from './people-import-worker.service.js';
import { OutreachGenerationWorkerService } from './outreach-generation-worker.service.js';

@Module({
  providers: [
    serverEnvProvider,
    BootstrapQueueService,
    PeopleImportWorkerService,
    OutreachGenerationWorkerService,
  ],
})
export class WorkerModule {}
