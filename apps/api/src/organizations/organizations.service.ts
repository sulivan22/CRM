import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type OrganizationType } from '@prisma/client';
import { normalizeCountryCode, normalizeName, normalizeText } from '@crm/database';
import { AuditService } from '../auth/audit.service.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  list(workspaceId: string) {
    return this.prismaService.client.organization.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      include: { _count: { select: { people: true } } },
    });
  }

  async create(input: {
    actorUserId: string;
    workspaceId: string;
    name: string;
    type?: OrganizationType;
    website?: string;
    countryCode?: string;
    description?: string;
  }) {
    const name = normalizeText(input.name);
    try {
      const organization = await this.prismaService.client.organization.create({
        data: {
          workspaceId: input.workspaceId,
          name,
          normalizedName: normalizeName(name),
          type: input.type ?? 'COMPANY',
          website: normalizeText(input.website) || null,
          countryCode: normalizeCountryCode(input.countryCode) || null,
          description: normalizeText(input.description) || null,
        },
      });
      await this.auditService.record({
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        action: 'organization.created',
        entityType: 'Organization',
        entityId: organization.id,
        metadata: { name: organization.name },
      });
      return organization;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Organization already exists in this workspace');
      }
      throw error;
    }
  }

  async get(workspaceId: string, organizationId: string) {
    const organization = await this.prismaService.client.organization.findFirst({
      where: { id: organizationId, workspaceId, status: 'ACTIVE' },
      include: {
        people: {
          where: { status: { not: 'ARCHIVED' } },
          take: 20,
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  async update(input: {
    actorUserId: string;
    workspaceId: string;
    organizationId: string;
    name?: string;
    type?: OrganizationType;
    website?: string;
    countryCode?: string;
    description?: string;
  }) {
    await this.get(input.workspaceId, input.organizationId);
    const data: Prisma.OrganizationUpdateInput = {};
    if (input.name !== undefined) {
      data.name = normalizeText(input.name);
      data.normalizedName = normalizeName(input.name);
    }
    if (input.type !== undefined) data.type = input.type;
    if (input.website !== undefined) data.website = normalizeText(input.website) || null;
    if (input.countryCode !== undefined)
      data.countryCode = normalizeCountryCode(input.countryCode) || null;
    if (input.description !== undefined)
      data.description = normalizeText(input.description) || null;

    const organization = await this.prismaService.client.organization.update({
      where: { id: input.organizationId },
      data,
    });
    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'organization.updated',
      entityType: 'Organization',
      entityId: organization.id,
      metadata: { fields: Object.keys(data) },
    });
    return organization;
  }

  async archive(input: { actorUserId: string; workspaceId: string; organizationId: string }) {
    await this.get(input.workspaceId, input.organizationId);
    const organization = await this.prismaService.client.organization.update({
      where: { id: input.organizationId },
      data: { status: 'ARCHIVED' },
    });
    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'organization.archived',
      entityType: 'Organization',
      entityId: organization.id,
      metadata: {},
    });
    return organization;
  }
}
