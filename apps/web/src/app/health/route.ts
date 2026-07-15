import { parseClientEnv } from '@crm/config';
import type { HealthCheckResponse } from '@crm/types';
import { NextResponse } from 'next/server';

export function GET() {
  parseClientEnv(process.env);

  const body: HealthCheckResponse = {
    service: 'web',
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body);
}
