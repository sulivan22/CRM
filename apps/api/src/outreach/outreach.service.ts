import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  CommunicationChannelType,
  GeneratedMessageStatus,
  Prisma,
  type OutreachGenerationJob,
} from '@prisma/client';
import { Queue, type ConnectionOptions } from 'bullmq';
import { AIService, type OutreachMessageInput } from '@crm/ai';
import {
  OUTREACH_GENERATION_JOB,
  OUTREACH_GENERATION_QUEUE,
  normalizeCountryCode,
  normalizeLanguageCode,
  normalizeText,
  toJsonInput,
} from '@crm/database';
import { getRedisConnection, type ServerEnv } from '@crm/config';
import { AuditService } from '../auth/audit.service.js';
import { SERVER_ENV } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import type {
  AudienceDto,
  AudienceFiltersDto,
  CreateOutreachDto,
  ListMessagesQueryDto,
  ListOutreachQueryDto,
  RegenerateMessageDto,
  UpdateMessageDto,
  UpdateOutreachDto,
} from './dto.js';

const messageInclude = {
  recipient: {
    include: {
      person: {
        include: {
          organization: true,
          channels: { where: { status: 'ACTIVE' }, orderBy: [{ isPrimary: 'desc' as const }] },
          tags: { include: { tag: true } },
        },
      },
    },
  },
} satisfies Prisma.GeneratedMessageInclude;

@Injectable()
export class OutreachService implements OnModuleDestroy {
  private readonly queue: Queue<
    { generationJobId: string },
    unknown,
    typeof OUTREACH_GENERATION_JOB
  >;
  private readonly aiService: AIService;

  constructor(
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
  ) {
    this.aiService = new AIService({
      provider: env.AI_PROVIDER,
      model: env.AI_DEFAULT_MODEL,
      apiKey: env.OPENAI_API_KEY,
    });
    const connection: ConnectionOptions = {
      ...getRedisConnection(env),
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue(OUTREACH_GENERATION_QUEUE, { connection });
  }

  async resolveAudience(workspaceId: string, audience: AudienceDto) {
    return this.resolveAudiencePeople(workspaceId, audience);
  }

  async create(input: { actorUserId: string; workspaceId: string; dto: CreateOutreachDto }) {
    const recipients = await this.resolveAudiencePeople(input.workspaceId, input.dto.audience);
    if (recipients.length === 0) {
      throw new BadRequestException('Audience resolves to zero recipients.');
    }

    const outreach = await this.prismaService.client.$transaction(async (tx) => {
      const created = await tx.outreach.create({
        data: {
          workspaceId: input.workspaceId,
          createdByUserId: input.actorUserId,
          name: normalizeText(input.dto.name),
          objective: normalizeText(input.dto.objective),
          languageCode: normalizeLanguageCode(input.dto.languageCode) || 'en',
          tone: input.dto.tone,
          length: input.dto.length,
          status: 'DRAFT',
          audienceDefinition: toJsonInput(input.dto.audience),
          totalRecipients: recipients.length,
          instruction: {
            create: {
              workspaceId: input.workspaceId,
              objective: normalizeText(input.dto.objective),
              languageCode: normalizeLanguageCode(input.dto.languageCode) || 'en',
              tone: input.dto.tone,
              length: input.dto.length,
              additionalContext: normalizeText(input.dto.additionalContext) || null,
            },
          },
          recipients: {
            create: recipients.map((person) => ({
              workspaceId: input.workspaceId,
              personId: person.id,
              status: 'PENDING',
              contextSnapshot: toJsonInput({
                displayName: person.displayName,
                organization: person.organization?.name ?? null,
                channels: person.channels.map((channel) => channel.type),
                tags: person.tags.map(({ tag }) => tag.name),
              }),
            })),
          },
        },
        include: { instruction: true, _count: { select: { recipients: true } } },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          action: 'outreach.created',
          entityType: 'Outreach',
          entityId: created.id,
          metadata: { recipients: recipients.length },
        },
      });
      return created;
    });

    return outreach;
  }

  async list(workspaceId: string, query: ListOutreachQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);
    const where: Prisma.OutreachWhereInput = {
      workspaceId,
      status: query.status ?? { not: 'ARCHIVED' },
      createdByUserId: query.createdByUserId,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: 'insensitive' } },
            { objective: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prismaService.client.outreach.findMany({
        where,
        orderBy: query.sort === 'createdAt' ? { createdAt: 'desc' } : { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prismaService.client.outreach.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async get(workspaceId: string, outreachId: string) {
    const outreach = await this.prismaService.client.outreach.findFirst({
      where: { id: outreachId, workspaceId },
      include: {
        instruction: true,
        generationJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { recipients: true, generatedMessages: true } },
      },
    });
    if (!outreach) {
      throw new NotFoundException('Outreach not found');
    }
    return outreach;
  }

  async update(input: {
    actorUserId: string;
    workspaceId: string;
    outreachId: string;
    dto: UpdateOutreachDto;
  }) {
    const outreach = await this.get(input.workspaceId, input.outreachId);
    if (!['DRAFT', 'READY_FOR_REVIEW'].includes(outreach.status)) {
      throw new BadRequestException('Outreach is not editable in its current state.');
    }
    const generationFieldsChanged = [
      'objective',
      'languageCode',
      'tone',
      'length',
      'additionalContext',
    ].some((field) => field in input.dto);

    const updated = await this.prismaService.client.$transaction(async (tx) => {
      const next = await tx.outreach.update({
        where: { id: input.outreachId },
        data: {
          name: input.dto.name ? normalizeText(input.dto.name) : undefined,
          objective: input.dto.objective ? normalizeText(input.dto.objective) : undefined,
          languageCode: input.dto.languageCode
            ? normalizeLanguageCode(input.dto.languageCode) || undefined
            : undefined,
          tone: input.dto.tone,
          length: input.dto.length,
          status:
            generationFieldsChanged && outreach.status === 'READY_FOR_REVIEW' ? 'DRAFT' : undefined,
          generatedRecipients: generationFieldsChanged ? 0 : undefined,
          approvedRecipients: generationFieldsChanged ? 0 : undefined,
        },
      });
      if (generationFieldsChanged) {
        await tx.generatedMessage.updateMany({
          where: { workspaceId: input.workspaceId, outreachId: input.outreachId, active: true },
          data: { active: false },
        });
        await tx.outreachRecipient.updateMany({
          where: { workspaceId: input.workspaceId, outreachId: input.outreachId },
          data: { status: 'PENDING' },
        });
        await tx.outreachInstruction.update({
          where: { outreachId: input.outreachId },
          data: {
            objective: input.dto.objective ? normalizeText(input.dto.objective) : undefined,
            languageCode: input.dto.languageCode
              ? normalizeLanguageCode(input.dto.languageCode) || undefined
              : undefined,
            tone: input.dto.tone,
            length: input.dto.length,
            additionalContext:
              input.dto.additionalContext !== undefined
                ? normalizeText(input.dto.additionalContext) || null
                : undefined,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          action: 'outreach.updated',
          entityType: 'Outreach',
          entityId: input.outreachId,
          metadata: {
            fields: Object.keys(input.dto),
            requiresRegeneration: generationFieldsChanged,
          },
        },
      });
      return next;
    });
    return updated;
  }

  async archive(input: { actorUserId: string; workspaceId: string; outreachId: string }) {
    const current = await this.get(input.workspaceId, input.outreachId);
    if (current.status === 'GENERATING') {
      throw new BadRequestException('Outreach cannot be archived while generation is running.');
    }
    const outreach = await this.prismaService.client.outreach.update({
      where: { id: input.outreachId },
      data: { status: 'ARCHIVED' },
    });
    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'outreach.archived',
      entityType: 'Outreach',
      entityId: input.outreachId,
      metadata: {},
    });
    return outreach;
  }

  async enqueueGeneration(input: { actorUserId: string; workspaceId: string; outreachId: string }) {
    const outreach = await this.get(input.workspaceId, input.outreachId);
    if (!['DRAFT', 'READY_FOR_REVIEW', 'FAILED'].includes(outreach.status)) {
      throw new BadRequestException('Outreach cannot be generated in its current state.');
    }
    const activeJob = await this.prismaService.client.outreachGenerationJob.findFirst({
      where: {
        outreachId: input.outreachId,
        workspaceId: input.workspaceId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });
    if (activeJob) {
      throw new ConflictException('Generation is already running.');
    }

    let job: OutreachGenerationJob;
    try {
      job = await this.prismaService.client.$transaction(async (tx) => {
        await tx.outreach.update({
          where: { id: input.outreachId },
          data: { status: 'GENERATING', generatedRecipients: 0, approvedRecipients: 0 },
        });
        const created = await tx.outreachGenerationJob.create({
          data: {
            workspaceId: input.workspaceId,
            outreachId: input.outreachId,
            status: 'PENDING',
            total: outreach.totalRecipients,
          },
        });
        await tx.auditLog.create({
          data: {
            workspaceId: input.workspaceId,
            actorUserId: input.actorUserId,
            action: 'outreach.generation.started',
            entityType: 'OutreachGenerationJob',
            entityId: created.id,
            metadata: { outreachId: input.outreachId },
          },
        });
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Generation is already running.');
      }
      throw error;
    }

    try {
      await this.queue.add(
        OUTREACH_GENERATION_JOB,
        { generationJobId: job.id },
        {
          jobId: job.id,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      await this.prismaService.client.$transaction(async (tx) => {
        await tx.outreachGenerationJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            errorMessage:
              error instanceof Error ? error.message.slice(0, 500) : 'Queue enqueue failed',
            completedAt: new Date(),
          },
        });
        await tx.outreach.update({
          where: { id: input.outreachId },
          data: { status: 'FAILED' },
        });
        await tx.auditLog.create({
          data: {
            workspaceId: input.workspaceId,
            actorUserId: input.actorUserId,
            action: 'outreach.generation.enqueue_failed',
            entityType: 'OutreachGenerationJob',
            entityId: job.id,
            metadata: { outreachId: input.outreachId },
          },
        });
      });
      throw new BadRequestException('Generation could not be queued.');
    }

    return job;
  }

  async getGeneration(workspaceId: string, outreachId: string) {
    await this.get(workspaceId, outreachId);
    return this.prismaService.client.outreachGenerationJob.findFirst({
      where: { workspaceId, outreachId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listMessages(workspaceId: string, outreachId: string, query: ListMessagesQueryDto) {
    await this.get(workspaceId, outreachId);
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);
    const where: Prisma.GeneratedMessageWhereInput = {
      workspaceId,
      outreachId,
      active: true,
      status: query.status,
      recipient: {
        person: {
          displayName: query.recipientSearch
            ? { contains: query.recipientSearch, mode: 'insensitive' }
            : undefined,
          AND: this.personChannelClauses(query.hasEmail, query.hasInstagram),
        },
      },
    };
    const [items, total] = await Promise.all([
      this.prismaService.client.generatedMessage.findMany({
        where,
        include: messageInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prismaService.client.generatedMessage.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  async getMessage(workspaceId: string, outreachId: string, messageId: string) {
    const message = await this.prismaService.client.generatedMessage.findFirst({
      where: { id: messageId, outreachId, workspaceId },
      include: messageInclude,
    });
    if (!message) {
      throw new NotFoundException('Generated message not found');
    }
    return message;
  }

  async updateMessage(input: {
    actorUserId: string;
    workspaceId: string;
    outreachId: string;
    messageId: string;
    dto: UpdateMessageDto;
  }) {
    await this.getMessage(input.workspaceId, input.outreachId, input.messageId);
    const message = await this.prismaService.client.generatedMessage.update({
      where: { id: input.messageId },
      data: {
        subject: normalizeText(input.dto.subject),
        body: normalizeText(input.dto.body),
        cta: input.dto.cta ? normalizeText(input.dto.cta) : null,
        status: 'EDITED',
        manuallyEdited: true,
      },
      include: messageInclude,
    });
    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'outreach.message.edited',
      entityType: 'GeneratedMessage',
      entityId: input.messageId,
      metadata: { outreachId: input.outreachId },
    });
    return message;
  }

  async regenerateMessage(input: {
    actorUserId: string;
    workspaceId: string;
    outreachId: string;
    messageId: string;
    dto: RegenerateMessageDto;
  }) {
    const previous = await this.getMessage(input.workspaceId, input.outreachId, input.messageId);
    const context = await this.buildMessageInput(
      input.workspaceId,
      input.outreachId,
      previous.recipientId,
      {
        previousMessage: {
          subject: previous.subject,
          body: previous.body,
          cta: previous.cta,
        },
        regenerationInstruction: input.dto.instruction ?? null,
      },
    );
    const output = await this.aiService.regenerateOutreachMessage(context);
    const nextVersion = previous.generationVersion + 1;
    const message = await this.prismaService.client.$transaction(async (tx) => {
      await tx.generatedMessage.updateMany({
        where: { recipientId: previous.recipientId, active: true },
        data: { active: false },
      });
      return tx.generatedMessage.create({
        data: {
          workspaceId: input.workspaceId,
          outreachId: input.outreachId,
          recipientId: previous.recipientId,
          subject: output.subject,
          body: output.body,
          cta: output.cta,
          status: 'GENERATED',
          generationVersion: nextVersion,
          provider: output.provider,
          model: output.model,
          promptSnapshot: toJsonInput({
            objective: context.objective,
            languageCode: context.languageCode,
            tone: context.tone,
            length: context.length,
            regenerationInstruction: input.dto.instruction ?? null,
          }),
          outputMetadata: toJsonInput(output.metadata),
        },
        include: messageInclude,
      });
    });
    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'outreach.message.regenerated',
      entityType: 'GeneratedMessage',
      entityId: message.id,
      metadata: { previousMessageId: input.messageId },
    });
    return message;
  }

  async setMessageStatus(input: {
    actorUserId: string;
    workspaceId: string;
    outreachId: string;
    messageId: string;
    status: Extract<GeneratedMessageStatus, 'APPROVED' | 'REJECTED'>;
  }) {
    const previous = await this.getMessage(input.workspaceId, input.outreachId, input.messageId);
    const message = await this.prismaService.client.generatedMessage.update({
      where: { id: previous.id },
      data: {
        status: input.status,
        approvedAt: input.status === 'APPROVED' ? new Date() : null,
        recipient: {
          update: { status: input.status === 'APPROVED' ? 'APPROVED' : 'GENERATED' },
        },
      },
      include: messageInclude,
    });
    await this.recountOutreach(input.workspaceId, input.outreachId);
    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action:
        input.status === 'APPROVED' ? 'outreach.message.approved' : 'outreach.message.rejected',
      entityType: 'GeneratedMessage',
      entityId: input.messageId,
      metadata: {},
    });
    return message;
  }

  async approveAll(input: { actorUserId: string; workspaceId: string; outreachId: string }) {
    await this.get(input.workspaceId, input.outreachId);
    await this.prismaService.client.$transaction(async (tx) => {
      const validMessages = await tx.generatedMessage.findMany({
        where: {
          workspaceId: input.workspaceId,
          outreachId: input.outreachId,
          active: true,
          status: { in: ['GENERATED', 'EDITED'] },
        },
      });
      await tx.generatedMessage.updateMany({
        where: { id: { in: validMessages.map((message) => message.id) } },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });
      await tx.outreachRecipient.updateMany({
        where: { id: { in: validMessages.map((message) => message.recipientId) } },
        data: { status: 'APPROVED' },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          action: 'outreach.approved',
          entityType: 'Outreach',
          entityId: input.outreachId,
          metadata: { messages: validMessages.length },
        },
      });
    });
    return this.recountOutreach(input.workspaceId, input.outreachId, true);
  }

  async buildMessageInput(
    workspaceId: string,
    outreachId: string,
    recipientId: string,
    options?: {
      previousMessage?: OutreachMessageInput['previousMessage'];
      regenerationInstruction?: string | null;
    },
  ): Promise<OutreachMessageInput> {
    const outreach = await this.prismaService.client.outreach.findFirst({
      where: { id: outreachId, workspaceId },
      include: {
        instruction: true,
        workspace: true,
        recipients: {
          where: { id: recipientId },
          include: {
            person: {
              include: {
                organization: true,
                channels: { where: { status: 'ACTIVE' }, orderBy: [{ isPrimary: 'desc' }] },
                tags: { include: { tag: true } },
              },
            },
          },
        },
      },
    });
    const recipient = outreach?.recipients[0];
    if (!outreach || !outreach.instruction || !recipient) {
      throw new NotFoundException('Outreach recipient context not found');
    }
    return {
      objective: outreach.instruction.objective,
      languageCode: outreach.instruction.languageCode,
      tone: outreach.instruction.tone,
      length: outreach.instruction.length,
      workspaceContext: {
        name: outreach.workspace.name,
        brandSummary: '',
        defaultLanguage: 'en',
      },
      person: recipient.person,
      organization: recipient.person.organization,
      channels: recipient.person.channels.map((channel) => ({
        type: channel.type,
        value: channel.value,
        isPrimary: channel.isPrimary,
      })),
      tags: recipient.person.tags.map(({ tag }) => tag.name),
      additionalContext: outreach.instruction.additionalContext,
      previousMessage: options?.previousMessage ?? null,
      regenerationInstruction: options?.regenerationInstruction ?? null,
    };
  }

  async recountOutreach(workspaceId: string, outreachId: string, allowApproveStatus = false) {
    const [generatedRecipients, approvedRecipients, totalRecipients] = await Promise.all([
      this.prismaService.client.outreachRecipient.count({
        where: { workspaceId, outreachId, status: { in: ['GENERATED', 'APPROVED'] } },
      }),
      this.prismaService.client.outreachRecipient.count({
        where: { workspaceId, outreachId, status: 'APPROVED' },
      }),
      this.prismaService.client.outreachRecipient.count({ where: { workspaceId, outreachId } }),
    ]);
    const status =
      allowApproveStatus && totalRecipients > 0 && approvedRecipients === totalRecipients
        ? 'APPROVED'
        : undefined;
    return this.prismaService.client.outreach.update({
      where: { id: outreachId },
      data: { generatedRecipients, approvedRecipients, totalRecipients, status },
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  private async resolveAudiencePeople(workspaceId: string, audience: AudienceDto) {
    const filters = audience.filters;
    const sources: Prisma.PersonWhereInput[] = [];
    if (audience.personIds?.length) {
      sources.push({ id: { in: [...new Set(audience.personIds)] } });
    }
    if (audience.tagIds?.length) {
      sources.push({ tags: { some: { tagId: { in: [...new Set(audience.tagIds)] } } } });
    }
    if (audience.organizationIds?.length) {
      sources.push({ organizationId: { in: [...new Set(audience.organizationIds)] } });
    }
    if (filters && Object.keys(filters).length > 0) {
      sources.push(this.filtersToWhere(filters));
    }
    const where: Prisma.PersonWhereInput = {
      workspaceId,
      status: { not: 'ARCHIVED' },
      OR: sources.length ? sources : undefined,
    };
    return this.prismaService.client.person.findMany({
      where,
      include: {
        organization: true,
        channels: { where: { status: 'ACTIVE' }, orderBy: [{ isPrimary: 'desc' }] },
        tags: { include: { tag: true } },
      },
      orderBy: { id: 'asc' },
      take: 1000,
    });
  }

  private filtersToWhere(filters: AudienceFiltersDto): Prisma.PersonWhereInput {
    const search = normalizeText(filters.search);
    return {
      organizationId: filters.organizationId,
      organization: filters.organizationType ? { type: filters.organizationType } : undefined,
      status:
        filters.status === 'DO_NOT_CONTACT' || filters.status === 'ACTIVE'
          ? filters.status
          : undefined,
      countryCode: filters.countryCode ? normalizeCountryCode(filters.countryCode) : undefined,
      languageCode: filters.languageCode ? normalizeLanguageCode(filters.languageCode) : undefined,
      followerCount:
        filters.minFollowers !== undefined || filters.maxFollowers !== undefined
          ? { gte: filters.minFollowers, lte: filters.maxFollowers }
          : undefined,
      tags: filters.tagId ? { some: { tagId: filters.tagId } } : undefined,
      AND: this.personChannelClauses(filters.hasEmail, filters.hasInstagram, filters.channelType),
      OR: search
        ? [
            { displayName: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { jobTitle: { contains: search, mode: 'insensitive' } },
            { organization: { name: { contains: search, mode: 'insensitive' } } },
            { channels: { some: { normalizedValue: { contains: search.toLocaleLowerCase() } } } },
          ]
        : undefined,
    };
  }

  private personChannelClauses(
    hasEmail?: boolean,
    hasInstagram?: boolean,
    channelType?: CommunicationChannelType,
  ): Prisma.PersonWhereInput[] | undefined {
    const clauses: Prisma.PersonWhereInput[] = [];
    if (channelType) clauses.push({ channels: { some: { type: channelType, status: 'ACTIVE' } } });
    if (hasEmail) clauses.push({ channels: { some: { type: 'EMAIL', status: 'ACTIVE' } } });
    if (hasInstagram) clauses.push({ channels: { some: { type: 'INSTAGRAM', status: 'ACTIVE' } } });
    return clauses.length ? clauses : undefined;
  }
}
