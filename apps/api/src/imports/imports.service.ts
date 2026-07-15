import { BadRequestException, Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, type ConnectionOptions } from 'bullmq';
import {
  PEOPLE_IMPORT_JOB,
  PEOPLE_IMPORT_QUEUE,
  inferPeopleImportMapping,
  parseCsv,
  toJsonInput,
  type PeopleImportMapping,
} from '@crm/database';
import { getRedisConnection, type ServerEnv } from '@crm/config';
import { AuditService } from '../auth/audit.service.js';
import { SERVER_ENV } from '../env.js';
import { PrismaService } from '../prisma.service.js';

type UploadFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Injectable()
export class ImportsService implements OnModuleDestroy {
  private readonly logger = new Logger(ImportsService.name);
  private readonly queue: Queue<{ importJobId: string }, unknown, typeof PEOPLE_IMPORT_JOB>;

  constructor(
    @Inject(SERVER_ENV) env: ServerEnv,
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
  ) {
    const connection: ConnectionOptions = {
      ...getRedisConnection(env),
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue(PEOPLE_IMPORT_QUEUE, { connection });
  }

  async createPeopleImport(input: {
    actorUserId: string;
    workspaceId: string;
    file?: UploadFile;
    mapping?: PeopleImportMapping['fields'];
    overwriteExisting?: boolean;
  }) {
    if (!input.file) {
      throw new BadRequestException('CSV file is required.');
    }
    if (!input.file.originalname.toLocaleLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV imports are supported.');
    }

    const parsed = parseCsv(input.file.buffer.toString('utf8'));
    if (parsed.headers.length === 0) {
      throw new BadRequestException('CSV headers are required.');
    }

    const fields = Object.keys(input.mapping ?? {}).length
      ? (input.mapping ?? {})
      : inferPeopleImportMapping(parsed.headers);
    const mapping: PeopleImportMapping = {
      fields,
      overwriteExisting: input.overwriteExisting ?? false,
      rows: parsed.rows,
    };

    const importJob = await this.prismaService.client.importJob.create({
      data: {
        workspaceId: input.workspaceId,
        createdByUserId: input.actorUserId,
        type: 'people',
        status: 'QUEUED',
        originalFilename: input.file.originalname,
        totalRows: parsed.rows.length,
        mapping: toJsonInput(mapping),
        summary: toJsonInput({ headers: parsed.headers }),
      },
    });

    try {
      await this.queue.add(
        PEOPLE_IMPORT_JOB,
        { importJobId: importJob.id },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      this.logger.error(`Failed to enqueue people import ${importJob.id}: ${String(error)}`);
      await this.prismaService.client.importJob.update({
        where: { id: importJob.id },
        data: { status: 'FAILED', summary: toJsonInput({ error: 'Failed to enqueue import job' }) },
      });
    }

    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'people.import.created',
      entityType: 'ImportJob',
      entityId: importJob.id,
      metadata: { rows: parsed.rows.length, filename: input.file.originalname },
    });

    return this.getJob(input.workspaceId, importJob.id);
  }

  async getJob(workspaceId: string, importJobId: string) {
    const job = await this.prismaService.client.importJob.findFirst({
      where: { id: importJobId, workspaceId },
      include: { _count: { select: { rowErrors: true } } },
    });
    if (!job) {
      throw new BadRequestException('Import job not found.');
    }
    return job;
  }

  async listErrors(workspaceId: string, importJobId: string) {
    await this.getJob(workspaceId, importJobId);
    return this.prismaService.client.importRowError.findMany({
      where: { importJobId },
      orderBy: { rowNumber: 'asc' },
      take: 200,
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
