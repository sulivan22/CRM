import type { User, Workspace, WorkspaceMembership } from '@prisma/client';

export function sanitizeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    createdAt: user.createdAt.toISOString()
  };
}

export function presentMembership(
  membership: WorkspaceMembership & { workspace: Workspace }
) {
  return {
    id: membership.id,
    role: membership.role,
    status: membership.status,
    workspace: {
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      status: membership.workspace.status
    }
  };
}
