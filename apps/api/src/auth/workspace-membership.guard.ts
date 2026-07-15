import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import type { AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class WorkspaceMembershipGuard implements CanActivate {
  constructor(private readonly prismaService: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const workspaceId = request.params?.workspaceId ?? request.currentWorkspace?.id;

    if (!request.user || !workspaceId) {
      throw new ForbiddenException('Workspace membership required');
    }

    const membership = await this.prismaService.client.workspaceMembership.findFirst({
      where: {
        workspaceId,
        userId: request.user.id,
        status: 'ACTIVE',
        workspace: { status: 'ACTIVE' }
      },
      include: { workspace: true }
    });

    if (!membership) {
      throw new ForbiddenException('Workspace membership required');
    }

    request.currentMembership = membership;
    request.currentWorkspace = membership.workspace;
    return true;
  }
}
