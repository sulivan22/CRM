'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@crm/ui';
import { AppShell } from '@/components/app-shell';
import { apiRequest, type AuthState } from '@/lib/api';

type Outreach = {
  id: string;
  name: string;
  objective: string;
  status: string;
  totalRecipients: number;
  generatedRecipients: number;
  approvedRecipients: number;
  updatedAt: string;
};

type OutreachList = {
  items: Outreach[];
  total: number;
};

export default function OutreachPage() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [items, setItems] = useState<Outreach[]>([]);
  const [message, setMessage] = useState('');
  const workspaceId = auth?.activeWorkspaceId;

  useEffect(() => {
    apiRequest<AuthState>('/auth/me')
      .then(setAuth)
      .catch(() => {
        window.location.href = '/login';
      });
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    void loadOutreach(workspaceId);
  }, [workspaceId]);

  async function loadOutreach(activeWorkspaceId: string) {
    const response = await apiRequest<OutreachList>(`/workspaces/${activeWorkspaceId}/outreach`);
    setItems(response.items);
  }

  async function archive(outreachId: string) {
    if (!workspaceId) return;
    await apiRequest(`/workspaces/${workspaceId}/outreach/${outreachId}`, { method: 'DELETE' });
    setMessage('Outreach archived.');
    await loadOutreach(workspaceId);
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Outreach</h2>
            <p className="text-sm text-slate-600">{items.length} drafts and reviews</p>
          </div>
          <div className="flex items-center gap-3">
            {message ? <p className="text-sm text-slate-600">{message}</p> : null}
            <Button
              type="button"
              onClick={() => {
                window.location.href = '/app/outreach/new';
              }}
            >
              New outreach
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Recipients</th>
                <th className="px-4 py-3">Generated</th>
                <th className="px-4 py-3">Approved</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-950">{item.name}</p>
                    <p className="line-clamp-1 text-xs text-slate-500">{item.objective}</p>
                  </td>
                  <td className="px-4 py-3">{item.totalRecipients}</td>
                  <td className="px-4 py-3">{item.generatedRecipients}</td>
                  <td className="px-4 py-3">{item.approvedRecipients}</td>
                  <td className="px-4 py-3">{item.status}</td>
                  <td className="px-4 py-3">{new Date(item.updatedAt).toLocaleString()}</td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        window.location.href = `/app/outreach/${item.id}`;
                      }}
                    >
                      Open
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void archive(item.id)}>
                      Archive
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
