export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface HealthCheckResponse {
  service: string;
  status: HealthStatus;
  timestamp: string;
}

export interface ReadyCheckResponse extends HealthCheckResponse {
  checks: Record<string, HealthStatus>;
}
