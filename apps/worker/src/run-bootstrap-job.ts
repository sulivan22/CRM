import { Queue, type ConnectionOptions } from 'bullmq';
import { getRedisConnection, parseServerEnv } from '@crm/config';
import type { BootstrapJobData, BootstrapJobResult } from './bootstrap-processor.js';

const env = parseServerEnv(process.env);
const connection: ConnectionOptions = {
  ...getRedisConnection(env),
  maxRetriesPerRequest: null,
};
const queue = new Queue<BootstrapJobData, BootstrapJobResult, 'bootstrap.test'>('bootstrap', {
  connection,
});

const job = await queue.add(
  'bootstrap.test',
  { requestedBy: 'manual-command' },
  {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1_000,
    },
  },
);

console.log(JSON.stringify({ queued: true, queue: 'bootstrap', jobId: job.id }));

await queue.close();
