import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type MembershipStatus, type WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { AuditService } from '../auth/audit.service.js';
import { SlugService } from '../auth/slug.service.js';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly slugService: SlugService,
    private readonly auditService: AuditService,
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.prismaService.client.workspaceMembership.findMany({
      where: { userId, status: 'ACTIVE', workspace: { status: 'ACTIVE' } },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((membership) => ({
      membershipId: membership.id,
      role: membership.role,
      workspace: membership.workspace,
    }));
  }

  async create(input: { userId: string; name: string; slug?: string }) {
    const name = input.name.trim();
    const slug = input.slug
      ? await this.slugService.generateUniqueSlug(input.slug)
      : await this.slugService.generateUniqueSlug(name);

    try {
      const workspace = await this.prismaService.client.$transaction(async (tx) => {
        const created = await tx.workspace.create({
          data: { name, slug, createdByUserId: input.userId },
        });
        await tx.workspaceMembership.create({
          data: {
            workspaceId: created.id,
            userId: input.userId,
            role: 'OWNER',
            status: 'ACTIVE',
            joinedAt: new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            workspaceId: created.id,
            actorUserId: input.userId,
            action: 'workspace.created',
            entityType: 'Workspace',
            entityId: created.id,
            metadata: {},
          },
        });
        return created;
      });

      return workspace;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Workspace slug is already in use');
      }
      throw error;
    }
  }

  async getForMember(userId: string, workspaceId: string) {
    const membership = await this.prismaService.client.workspaceMembership.findFirst({
      where: { userId, workspaceId, status: 'ACTIVE', workspace: { status: 'ACTIVE' } },
      include: { workspace: true },
    });

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }

    return { workspace: membership.workspace, membership };
  }

  async updateWorkspace(input: {
    actorUserId: string;
    workspaceId: string;
    name?: string;
    slug?: string;
  }) {
    const data: Prisma.WorkspaceUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name.trim();
    }
    if (input.slug !== undefined) {
      data.slug = await this.slugService.generateUniqueSlug(input.slug);
    }

    const workspace = await this.prismaService.client.workspace.update({
      where: { id: input.workspaceId },
      data,
    });

    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'workspace.updated',
      entityType: 'Workspace',
      entityId: input.workspaceId,
      metadata: { fields: Object.keys(data) },
    });

    return workspace;
  }

  async listMembers(workspaceId: string) {
    return this.prismaService.client.workspaceMembership.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateMembership(input: {
    actorUserId: string;
    actorRole: WorkspaceRole;
    workspaceId: string;
    membershipId: string;
    role?: WorkspaceRole;
    status?: MembershipStatus;
  }) {
    const membership = await this.prismaService.client.workspaceMembership.findUnique({
      where: { id: input.membershipId },
      include: { user: true },
    });

    if (!membership || membership.workspaceId !== input.workspaceId) {
      throw new NotFoundException('Membership not found');
    }

    if (input.actorRole === 'ADMIN') {
      if (input.role === 'OWNER' || membership.role === 'OWNER') {
        throw new ForbiddenException('Admins cannot modify owner memberships');
      }
    }

    const demotesOwner =
      membership.role === 'OWNER' && input.role !== undefined && input.role !== 'OWNER';
    const suspendsOwner =
      membership.role === 'OWNER' && input.status !== undefined && input.status !== 'ACTIVE';

    if (demotesOwner || suspendsOwner) {
      await this.assertNotLastActiveOwner(input.workspaceId, membership.id);
    }

    if (!input.role && !input.status) {
      throw new BadRequestException('No membership changes provided');
    }

    const updated = await this.prismaService.client.workspaceMembership.update({
      where: { id: input.membershipId },
      data: {
        role: input.role,
        status: input.status,
      },
      include: { user: true },
    });

    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: input.status === 'SUSPENDED' ? 'membership.suspended' : 'membership.updated',
      entityType: 'WorkspaceMembership',
      entityId: input.membershipId,
      metadata: { role: input.role, status: input.status },
    });

    return updated;
  }

  async assertNotLastActiveOwner(workspaceId: string, membershipId: string) {
    const activeOwners = await this.prismaService.client.workspaceMembership.count({
      where: {
        workspaceId,
        role: 'OWNER',
        status: 'ACTIVE',
        id: { not: membershipId },
      },
    });

    if (activeOwners < 1) {
      throw new BadRequestException('Cannot remove the last active workspace owner');
    }
  }
}
