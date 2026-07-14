import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeName, normalizeText } from '@crm/database';
import { AuditService } from '../auth/audit.service.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class TagsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  list(workspaceId: string) {
    return this.prismaService.client.tag.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { people: true } } },
    });
  }

  async create(input: { actorUserId: string; workspaceId: string; name: string; color?: string }) {
    const name = normalizeText(input.name);
    try {
      const tag = await this.prismaService.client.tag.create({
        data: {
          workspaceId: input.workspaceId,
          name,
          normalizedName: normalizeName(name),
          color: input.color ?? null,
        },
      });
      await this.auditService.record({
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        action: 'tag.created',
        entityType: 'Tag',
        entityId: tag.id,
        metadata: { name: tag.name },
      });
      return tag;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Tag already exists in this workspace');
      }
      throw error;
    }
  }
}
