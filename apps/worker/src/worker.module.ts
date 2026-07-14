import { Module } from '@nestjs/common';
import { serverEnvProvider } from './worker-env.js';
import { BootstrapQueueService } from './bootstrap-queue.service.js';

@Module({
  providers: [serverEnvProvider, BootstrapQueueService]
})
export class WorkerModule {}
