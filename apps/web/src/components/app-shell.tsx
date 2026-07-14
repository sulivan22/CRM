'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@crm/ui';
import { apiRequest, type AuthState } from '@/lib/api';

export function AppShell({ children }: { children?: React.ReactNode }) {
  const [state, setState] = useState<AuthState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<AuthState>('/auth/me')
      .then(setState)
      .catch(() => {
        window.location.href = '/login';
      });
  }, []);

  async function logout() {
    await apiRequest<void>('/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  async function switchWorkspace(workspaceId: string) {
    setError('');
    try {
      const next = await apiRequest<AuthState>('/auth/switch-workspace', {
        method: 'POST',
        body: JSON.stringify({ workspaceId })
      });
      setState(next);
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : 'Unable to switch workspace.');
    }
  }

  if (!state) {
    return <main className="p-6 text-sm text-slate-600">Loading</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <p className="text-sm text-slate-500">Signed in as</p>
          <h1 className="text-lg font-semibold">{state.user.displayName ?? state.user.email}</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            aria-label="Active workspace"
            className="h-9 rounded-md border border-slate-300 px-3 text-sm"
            value={state.activeWorkspaceId ?? ''}
            onChange={(event) => void switchWorkspace(event.target.value)}
          >
            <option value="" disabled>
              Select workspace
            </option>
            {state.memberships.map((membership) => (
              <option key={membership.workspace.id} value={membership.workspace.id}>
                {membership.workspace.name}
              </option>
            ))}
          </select>
          <a className="text-sm font-medium text-slate-700" href="/app/workspaces">
            Workspaces
          </a>
          <Button type="button" variant="outline" onClick={() => void logout()}>
            Logout
          </Button>
        </div>
      </header>
      {error ? <p className="px-6 pt-4 text-sm text-red-700">{error}</p> : null}
      <section className="p-6">{children ?? <p>Application shell operational.</p>}</section>
    </main>
  );
}
