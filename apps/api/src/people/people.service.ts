import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type CommunicationChannelType, type PersonStatus } from '@prisma/client';
import {
  normalizeChannelValue,
  normalizeCountryCode,
  normalizeLanguageCode,
  normalizeText,
} from '@crm/database';
import { AuditService } from '../auth/audit.service.js';
import { PrismaService } from '../prisma.service.js';
import type { PersonChannelDto } from './dto.js';

const personInclude = {
  organization: true,
  channels: { where: { status: 'ACTIVE' }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
  tags: { include: { tag: true }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.PersonInclude;

@Injectable()
export class PeopleService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    workspaceId: string,
    filters: {
      search?: string;
      organizationId?: string;
      tagId?: string;
      countryCode?: string;
      languageCode?: string;
      channelType?: CommunicationChannelType;
      status?: PersonStatus;
    },
  ) {
    const search = normalizeText(filters.search);
    const where: Prisma.PersonWhereInput = {
      workspaceId,
      status: filters.status ?? 'ACTIVE',
      organizationId: filters.organizationId,
      countryCode: filters.countryCode ? normalizeCountryCode(filters.countryCode) : undefined,
      languageCode: filters.languageCode ? normalizeLanguageCode(filters.languageCode) : undefined,
      tags: filters.tagId ? { some: { tagId: filters.tagId } } : undefined,
      channels: filters.channelType
        ? { some: { type: filters.channelType, status: 'ACTIVE' } }
        : undefined,
    };

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { jobTitle: { contains: search, mode: 'insensitive' } },
        { organization: { name: { contains: search, mode: 'insensitive' } } },
        { channels: { some: { normalizedValue: { contains: search.toLocaleLowerCase() } } } },
      ];
    }

    return this.prismaService.client.person.findMany({
      where,
      include: personInclude,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async create(input: {
    actorUserId: string;
    workspaceId: string;
    organizationId?: string;
    firstName?: string;
    lastName?: string;
    displayName: string;
    jobTitle?: string;
    countryCode?: string;
    languageCode?: string;
    followerCount?: number;
    channels?: PersonChannelDto[];
    tagIds?: string[];
  }) {
    await this.assertOrganization(input.workspaceId, input.organizationId);
    await this.assertTags(input.workspaceId, input.tagIds ?? []);
    const channels = this.normalizeChannels(input.channels ?? []);

    try {
      const person = await this.prismaService.client.person.create({
        data: {
          workspaceId: input.workspaceId,
          organizationId: input.organizationId,
          firstName: normalizeText(input.firstName) || null,
          lastName: normalizeText(input.lastName) || null,
          displayName: normalizeText(input.displayName),
          jobTitle: normalizeText(input.jobTitle) || null,
          countryCode: normalizeCountryCode(input.countryCode) || null,
          languageCode: normalizeLanguageCode(input.languageCode) || null,
          followerCount: input.followerCount ?? null,
          source: 'MANUAL',
          channels: {
            create: channels.map((channel) => ({ ...channel, workspaceId: input.workspaceId })),
          },
          tags: { create: (input.tagIds ?? []).map((tagId) => ({ tagId })) },
        },
        include: personInclude,
      });
      await this.auditService.record({
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        action: 'person.created',
        entityType: 'Person',
        entityId: person.id,
        metadata: { displayName: person.displayName },
      });
      return person;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A person with one of these channels already exists.');
      }
      throw error;
    }
  }

  async get(workspaceId: string, personId: string) {
    const person = await this.prismaService.client.person.findFirst({
      where: { id: personId, workspaceId, status: { not: 'ARCHIVED' } },
      include: personInclude,
    });
    if (!person) {
      throw new NotFoundException('Person not found');
    }
    return person;
  }

  async update(input: {
    actorUserId: string;
    workspaceId: string;
    personId: string;
    organizationId?: string | null;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    jobTitle?: string;
    countryCode?: string;
    languageCode?: string;
    followerCount?: number;
    status?: PersonStatus;
  }) {
    await this.get(input.workspaceId, input.personId);
    await this.assertOrganization(input.workspaceId, input.organizationId ?? undefined);
    const data: Prisma.PersonUpdateInput = {};
    if (input.organizationId !== undefined)
      data.organization = input.organizationId
        ? { connect: { id: input.organizationId } }
        : { disconnect: true };
    if (input.firstName !== undefined) data.firstName = normalizeText(input.firstName) || null;
    if (input.lastName !== undefined) data.lastName = normalizeText(input.lastName) || null;
    if (input.displayName !== undefined) data.displayName = normalizeText(input.displayName);
    if (input.jobTitle !== undefined) data.jobTitle = normalizeText(input.jobTitle) || null;
    if (input.countryCode !== undefined)
      data.countryCode = normalizeCountryCode(input.countryCode) || null;
    if (input.languageCode !== undefined)
      data.languageCode = normalizeLanguageCode(input.languageCode) || null;
    if (input.followerCount !== undefined) data.followerCount = input.followerCount;
    if (input.status !== undefined) data.status = input.status;

    const person = await this.prismaService.client.person.update({
      where: { id: input.personId },
      data,
      include: personInclude,
    });
    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'person.updated',
      entityType: 'Person',
      entityId: person.id,
      metadata: { fields: Object.keys(data) },
    });
    return person;
  }

  async archive(input: { actorUserId: string; workspaceId: string; personId: string }) {
    await this.get(input.workspaceId, input.personId);
    const person = await this.prismaService.client.person.update({
      where: { id: input.personId },
      data: {
        status: 'ARCHIVED',
        channels: { updateMany: { where: {}, data: { status: 'ARCHIVED' } } },
      },
      include: personInclude,
    });
    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'person.archived',
      entityType: 'Person',
      entityId: person.id,
      metadata: {},
    });
    return person;
  }

  async addChannel(input: {
    actorUserId: string;
    workspaceId: string;
    personId: string;
    channel: PersonChannelDto;
  }) {
    await this.get(input.workspaceId, input.personId);
    const [channel] = this.normalizeChannels([input.channel]);
    if (!channel) {
      throw new BadRequestException('Channel value is invalid');
    }

    try {
      await this.prismaService.client.communicationChannel.create({
        data: {
          workspaceId: input.workspaceId,
          personId: input.personId,
          ...channel,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Channel already exists in this workspace');
      }
      throw error;
    }
    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'person.channel.created',
      entityType: 'Person',
      entityId: input.personId,
      metadata: { type: channel.type },
    });
    return this.get(input.workspaceId, input.personId);
  }

  async archiveChannel(input: {
    actorUserId: string;
    workspaceId: string;
    personId: string;
    channelId: string;
  }) {
    await this.get(input.workspaceId, input.personId);
    const channel = await this.prismaService.client.communicationChannel.findFirst({
      where: { id: input.channelId, personId: input.personId, workspaceId: input.workspaceId },
    });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    await this.prismaService.client.communicationChannel.update({
      where: { id: channel.id },
      data: { status: 'ARCHIVED' },
    });
    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'person.channel.archived',
      entityType: 'CommunicationChannel',
      entityId: channel.id,
      metadata: {},
    });
    return this.get(input.workspaceId, input.personId);
  }

  async assignTag(input: {
    actorUserId: string;
    workspaceId: string;
    personId: string;
    tagId: string;
  }) {
    await this.get(input.workspaceId, input.personId);
    await this.assertTags(input.workspaceId, [input.tagId]);
    await this.prismaService.client.personTag.upsert({
      where: { personId_tagId: { personId: input.personId, tagId: input.tagId } },
      update: {},
      create: { personId: input.personId, tagId: input.tagId },
    });
    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'person.tag.assigned',
      entityType: 'Person',
      entityId: input.personId,
      metadata: { tagId: input.tagId },
    });
    return this.get(input.workspaceId, input.personId);
  }

  async removeTag(input: {
    actorUserId: string;
    workspaceId: string;
    personId: string;
    tagId: string;
  }) {
    await this.get(input.workspaceId, input.personId);
    await this.prismaService.client.personTag.deleteMany({
      where: {
        personId: input.personId,
        tagId: input.tagId,
        tag: { workspaceId: input.workspaceId },
      },
    });
    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'person.tag.removed',
      entityType: 'Person',
      entityId: input.personId,
      metadata: { tagId: input.tagId },
    });
    return this.get(input.workspaceId, input.personId);
  }

  private normalizeChannels(channels: PersonChannelDto[]) {
    return channels
      .map((channel) => ({
        type: channel.type,
        value: normalizeText(channel.value),
        normalizedValue: normalizeChannelValue(channel.type, channel.value),
        isPrimary: channel.isPrimary ?? false,
      }))
      .filter((channel) => channel.value && channel.normalizedValue);
  }

  private async assertOrganization(workspaceId: string, organizationId?: string) {
    if (!organizationId) {
      return;
    }
    const organization = await this.prismaService.client.organization.findFirst({
      where: { id: organizationId, workspaceId, status: 'ACTIVE' },
    });
    if (!organization) {
      throw new BadRequestException('Organization does not belong to this workspace');
    }
  }

  private async assertTags(workspaceId: string, tagIds: string[]) {
    if (tagIds.length === 0) {
      return;
    }
    const count = await this.prismaService.client.tag.count({
      where: { workspaceId, id: { in: tagIds } },
    });
    if (count !== new Set(tagIds).size) {
      throw new BadRequestException('One or more tags do not belong to this workspace');
    }
  }
}
