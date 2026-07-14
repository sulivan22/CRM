export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface HealthCheckResponse {
  service: string;
  status: HealthStatus;
  timestamp: string;
}

export interface ReadyCheckResponse extends HealthCheckResponse {
  checks: Record<string, HealthStatus>;
}

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface SanitizedUser {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  createdAt: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  role: WorkspaceRole;
}
