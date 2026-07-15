import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import argon2 from 'argon2';
import type { ServerEnv } from '@crm/config';
import { SERVER_ENV } from '../env.js';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AuditService } from './audit.service.js';
import { sanitizeUser, presentMembership } from './auth.presenters.js';
import { SessionService } from './session.service.js';
import { SlugService } from './slug.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
    private readonly prismaService: PrismaService,
    private readonly sessionService: SessionService,
    private readonly slugService: SlugService,
    private readonly auditService: AuditService,
  ) {}

  normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async register(input: {
    email: string;
    password: string;
    displayName?: string;
    workspaceName?: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  }) {
    this.assertPasswordPolicy(input.password);
    const email = this.normalizeEmail(input.email);
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const workspaceName = input.workspaceName?.trim();

    try {
      const result = await this.prismaService.client.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            displayName: input.displayName?.trim() || null,
          },
        });

        let activeWorkspaceId: string | null = null;
        if (workspaceName) {
          const slug = await this.generateSlugInTransaction(tx, workspaceName);
          const workspace = await tx.workspace.create({
            data: {
              name: workspaceName,
              slug,
              createdByUserId: user.id,
            },
          });
          activeWorkspaceId = workspace.id;
          await tx.workspaceMembership.create({
            data: {
              workspaceId: workspace.id,
              userId: user.id,
              role: 'OWNER',
              status: 'ACTIVE',
              joinedAt: new Date(),
            },
          });
          await tx.auditLog.create({
            data: {
              workspaceId: workspace.id,
              actorUserId: user.id,
              action: 'workspace.created',
              entityType: 'Workspace',
              entityId: workspace.id,
              metadata: { source: 'registration' },
            },
          });
        }

        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: 'auth.registered',
            entityType: 'User',
            entityId: user.id,
            metadata: {},
          },
        });

        return { user, activeWorkspaceId };
      });

      const session = await this.sessionService.createSession({
        userId: result.user.id,
        activeWorkspaceId: result.activeWorkspaceId,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      });

      return {
        rawToken: session.rawToken,
        body: await this.authPayload(result.user, result.activeWorkspaceId),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async login(input: {
    email: string;
    password: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  }) {
    const email = this.normalizeEmail(input.email);
    const user = await this.prismaService.client.user.findUnique({ where: { email } });

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !(await argon2.verify(user.passwordHash, input.password))
    ) {
      await this.auditService.record({
        action: 'auth.login_failed',
        entityType: 'User',
        metadata: { email },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const firstMembership = await this.prismaService.client.workspaceMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE', workspace: { status: 'ACTIVE' } },
      orderBy: { createdAt: 'asc' },
    });
    const session = await this.sessionService.createSession({
      userId: user.id,
      activeWorkspaceId: firstMembership?.workspaceId,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });

    await this.prismaService.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.auditService.record({
      actorUserId: user.id,
      action: 'auth.login_succeeded',
      entityType: 'User',
      entityId: user.id,
      metadata: {},
    });

    return {
      rawToken: session.rawToken,
      body: await this.authPayload(user, firstMembership?.workspaceId ?? null),
    };
  }

  async me(userId: string, activeWorkspaceId?: string | null) {
    const user = await this.prismaService.client.user.findUniqueOrThrow({ where: { id: userId } });
    return this.authPayload(user, activeWorkspaceId ?? null);
  }

  async switchWorkspace(input: { userId: string; sessionId: string; workspaceId: string }) {
    const membership = await this.prismaService.client.workspaceMembership.findFirst({
      where: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        status: 'ACTIVE',
        workspace: { status: 'ACTIVE' },
      },
      include: { workspace: true },
    });

    if (!membership) {
      throw new UnauthorizedException('Workspace not available');
    }

    await this.prismaService.client.session.update({
      where: { id: input.sessionId },
      data: { activeWorkspaceId: input.workspaceId },
    });
    await this.auditService.record({
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      action: 'workspace.switched',
      entityType: 'Workspace',
      entityId: input.workspaceId,
      metadata: {},
    });

    return this.me(input.userId, input.workspaceId);
  }

  private async authPayload(user: User, activeWorkspaceId: string | null) {
    const memberships = await this.prismaService.client.workspaceMembership.findMany({
      where: { userId: user.id, status: 'ACTIVE', workspace: { status: 'ACTIVE' } },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      user: sanitizeUser(user),
      memberships: memberships.map(presentMembership),
      activeWorkspaceId,
    };
  }

  private assertPasswordPolicy(password: string) {
    if (password.length < this.env.PASSWORD_MIN_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${this.env.PASSWORD_MIN_LENGTH} characters`,
      );
    }
  }

  private async generateSlugInTransaction(tx: Prisma.TransactionClient, name: string) {
    const base = this.slugService.normalize(name);
    let candidate = base;
    let suffix = 1;

    while (await tx.workspace.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }
}
