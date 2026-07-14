import { parseClientEnv } from '@crm/config';

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: isFormData
      ? init?.headers
      : {
          'Content-Type': 'application/json',
          ...init?.headers,
        },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function apiBaseUrl() {
  return parseClientEnv({
    ...process.env,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001',
  }).NEXT_PUBLIC_API_BASE_URL;
}

export interface AuthMembership {
  id: string;
  role: string;
  status: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
}

export interface AuthState {
  user: {
    id: string;
    email: string;
    displayName: string | null;
  };
  memberships: AuthMembership[];
  activeWorkspaceId: string | null;
}
