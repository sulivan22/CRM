import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { WorkspaceRole } from '@prisma/client';
import type { AuthenticatedRequest } from './auth.types.js';

export const WORKSPACE_ROLES_KEY = 'workspaceRoles';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});

export const CurrentWorkspace = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.currentWorkspace;
});

export const CurrentMembership = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.currentMembership;
});

export const WorkspaceRoles = (...roles: WorkspaceRole[]) => SetMetadata(WORKSPACE_ROLES_KEY, roles);
