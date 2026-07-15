import type { Job } from 'bullmq';

export interface BootstrapJobData {
  requestedBy: string;
}

export interface BootstrapJobResult {
  processed: true;
  requestedBy: string;
}

export function processBootstrapJob(job: Pick<Job<BootstrapJobData>, 'data'>): BootstrapJobResult {
  return {
    processed: true,
    requestedBy: job.data.requestedBy,
  };
}
