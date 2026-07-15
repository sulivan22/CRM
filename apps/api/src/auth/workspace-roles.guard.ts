import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { WorkspaceRole } from '@prisma/client';
import { WORKSPACE_ROLES_KEY } from './decorators.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { workspaceRoleRank } from './auth.types.js';

@Injectable()
export class WorkspaceRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<WorkspaceRole[]>(WORKSPACE_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const membership = request.currentMembership;

    if (!membership) {
      throw new ForbiddenException('Workspace role required');
    }

    const currentRank = workspaceRoleRank[membership.role] ?? 0;
    const allowed = roles.some((role) => currentRank >= (workspaceRoleRank[role] ?? 0));
    if (!allowed) {
      throw new ForbiddenException('Insufficient workspace role');
    }

    return true;
  }
}
