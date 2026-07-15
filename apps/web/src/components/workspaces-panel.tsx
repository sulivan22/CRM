'use client';

import React, { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@crm/ui';
import { apiRequest, type AuthState } from '@/lib/api';

interface WorkspaceListItem {
  membershipId: string;
  role: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
}

export function WorkspacesPanel() {
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setWorkspaces(await apiRequest<WorkspaceListItem[]>('/workspaces'));
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!name.trim()) {
      setMessage('Workspace name is required.');
      return;
    }
    await apiRequest('/workspaces', { method: 'POST', body: JSON.stringify({ name }) });
    setName('');
    await load();
  }

  async function switchWorkspace(workspaceId: string) {
    await apiRequest<AuthState>('/auth/switch-workspace', {
      method: 'POST',
      body: JSON.stringify({ workspaceId }),
    });
    setMessage('Workspace switched.');
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <form className="flex gap-3" onSubmit={(event) => void create(event)}>
        <input
          className="h-10 flex-1 rounded-md border border-slate-300 px-3"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Workspace name"
        />
        <Button type="submit">Create</Button>
      </form>
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      <div className="grid gap-3">
        {workspaces.map((item) => (
          <article
            key={item.workspace.id}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{item.workspace.name}</h2>
                <p className="text-sm text-slate-500">
                  {item.workspace.slug} · {item.role}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void switchWorkspace(item.workspace.id)}
              >
                Switch
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
