import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { WorkspacesService } from '../src/workspaces/workspaces.service.js';
import type { AuditService } from '../src/auth/audit.service.js';
import type { SlugService } from '../src/auth/slug.service.js';
import type { PrismaService } from '../src/prisma.service.js';

describe('WorkspacesService membership protections', () => {
  it('prevents demoting the last active owner', async () => {
    const prisma = {
      client: {
        workspaceMembership: {
          count: () => Promise.resolve(0)
        }
      }
    } as unknown as PrismaService;
    const service = new WorkspacesService(
      prisma,
      {} as SlugService,
      {} as AuditService
    );

    await expect(service.assertNotLastActiveOwner('workspace-id', 'membership-id')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('rejects admin attempts to modify owner memberships', async () => {
    const prisma = {
      client: {
        workspaceMembership: {
          findUnique: () =>
            Promise.resolve({
              id: 'membership-id',
              workspaceId: 'workspace-id',
              role: 'OWNER',
              status: 'ACTIVE',
              user: { id: 'owner-id' }
            })
        }
      }
    } as unknown as PrismaService;
    const service = new WorkspacesService(
      prisma,
      {} as SlugService,
      {} as AuditService
    );

    await expect(
      service.updateMembership({
        actorUserId: 'admin-id',
        actorRole: 'ADMIN',
        workspaceId: 'workspace-id',
        membershipId: 'membership-id',
        role: 'MEMBER'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
