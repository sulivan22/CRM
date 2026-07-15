import type {
  MembershipStatus,
  Session,
  User,
  Workspace,
  WorkspaceMembership,
  WorkspaceRole
} from '@prisma/client';

export type AuthenticatedUser = Pick<
  User,
  'id' | 'email' | 'displayName' | 'status'
> & { createdAt: string };

export interface RequestMembership extends WorkspaceMembership {
  workspace: Workspace;
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  user?: AuthenticatedUser;
  session?: Session;
  currentWorkspace?: Workspace;
  currentMembership?: RequestMembership;
  params?: Record<string, string | undefined>;
}

export interface CookieResponse {
  cookie(name: string, value: string, options: CookieOptions): unknown;
  clearCookie(name: string, options: Pick<CookieOptions, 'domain' | 'path' | 'sameSite' | 'secure'>): unknown;
}

export interface CookieOptions {
  httpOnly: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  secure: boolean;
  maxAge?: number;
  expires?: Date;
  domain?: string;
  path: string;
}

export const workspaceRoleRank: Record<WorkspaceRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4
};

export const activeMembershipStatus: MembershipStatus = 'ACTIVE';
