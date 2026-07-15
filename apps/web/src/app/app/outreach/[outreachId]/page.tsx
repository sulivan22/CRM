'use client';

import React, { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'next/navigation';
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
  instruction: {
    tone: string;
    length: string;
    languageCode: string;
    additionalContext: string | null;
  } | null;
  generationJobs: GenerationJob[];
};
type GenerationJob = {
  id: string;
  status: string;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
};
type Message = {
  id: string;
  subject: string;
  body: string;
  cta: string | null;
  status: string;
  generationVersion: number;
  recipient: {
    person: {
      displayName: string;
      organization: { name: string } | null;
      channels: { type: string; value: string }[];
    };
  };
};
type MessageList = { items: Message[]; total: number };

function formString(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export default function OutreachDetailPage() {
  const params = useParams<{ outreachId: string }>();
  const outreachId = params.outreachId;
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [outreach, setOutreach] = useState<Outreach | null>(null);
  const [generation, setGeneration] = useState<GenerationJob | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const workspaceId = auth?.activeWorkspaceId;
  const selected = messages.find((message) => message.id === selectedId) ?? messages[0] ?? null;

  useEffect(() => {
    apiRequest<AuthState>('/auth/me')
      .then(setAuth)
      .catch(() => {
        window.location.href = '/login';
      });
  }, []);

  useEffect(() => {
    if (!workspaceId || !outreachId) return;
    void load(workspaceId, outreachId);
  }, [workspaceId, outreachId]);

  async function load(activeWorkspaceId: string, activeOutreachId: string) {
    const [nextOutreach, nextGeneration, nextMessages] = await Promise.all([
      apiRequest<Outreach>(`/workspaces/${activeWorkspaceId}/outreach/${activeOutreachId}`),
      apiRequest<GenerationJob | null>(
        `/workspaces/${activeWorkspaceId}/outreach/${activeOutreachId}/generation`,
      ),
      apiRequest<MessageList>(
        `/workspaces/${activeWorkspaceId}/outreach/${activeOutreachId}/messages`,
      ),
    ]);
    setOutreach(nextOutreach);
    setGeneration(nextGeneration);
    setMessages(nextMessages.items);
    setSelectedId((current) => current ?? nextMessages.items[0]?.id ?? null);
  }

  async function generate() {
    if (!workspaceId || !outreachId) return;
    const job = await apiRequest<GenerationJob>(
      `/workspaces/${workspaceId}/outreach/${outreachId}/generate`,
      {
        method: 'POST',
      },
    );
    setGeneration(job);
    setNotice('Generation queued.');
  }

  async function refresh() {
    if (!workspaceId || !outreachId) return;
    await load(workspaceId, outreachId);
  }

  async function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !outreachId || !selected) return;
    const form = new FormData(event.currentTarget);
    await apiRequest<Message>(
      `/workspaces/${workspaceId}/outreach/${outreachId}/messages/${selected.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          subject: formString(form, 'subject'),
          body: formString(form, 'body'),
          cta: formString(form, 'cta') || null,
        }),
      },
    );
    setNotice('Message edited.');
    await refresh();
  }

  async function action(path: string, label: string) {
    if (!workspaceId || !outreachId || !selected) return;
    await apiRequest(
      `/workspaces/${workspaceId}/outreach/${outreachId}/messages/${selected.id}/${path}`,
      {
        method: 'POST',
      },
    );
    setNotice(label);
    await refresh();
  }

  async function regenerate() {
    if (!workspaceId || !outreachId || !selected) return;
    const instruction = window.prompt('Regeneration instruction') ?? undefined;
    await apiRequest(
      `/workspaces/${workspaceId}/outreach/${outreachId}/messages/${selected.id}/regenerate`,
      {
        method: 'POST',
        body: JSON.stringify({ instruction }),
      },
    );
    setNotice('Message regenerated.');
    await refresh();
  }

  async function approveAll() {
    if (!workspaceId || !outreachId) return;
    await apiRequest(`/workspaces/${workspaceId}/outreach/${outreachId}/approve`, {
      method: 'POST',
    });
    setNotice('Valid messages approved.');
    await refresh();
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">
              {outreach?.name ?? 'Outreach'}
            </h2>
            <p className="max-w-3xl text-sm text-slate-600">{outreach?.objective}</p>
            <p className="mt-1 text-sm text-slate-500">
              {outreach?.status} · {outreach?.totalRecipients ?? 0} recipients ·{' '}
              {outreach?.generatedRecipients ?? 0} generated · {outreach?.approvedRecipients ?? 0}{' '}
              approved
            </p>
          </div>
          <div className="flex gap-2">
            {notice ? <p className="self-center text-sm text-slate-600">{notice}</p> : null}
            <Button type="button" variant="outline" onClick={() => void refresh()}>
              Refresh
            </Button>
            <Button type="button" onClick={() => void generate()}>
              Generate
            </Button>
            <Button type="button" variant="outline" onClick={() => void approveAll()}>
              Approve all
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p>
            Generation: {generation?.status ?? 'Not started'} · {generation?.processed ?? 0}/
            {generation?.total ?? outreach?.totalRecipients ?? 0} processed ·{' '}
            {generation?.failed ?? 0} failed
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Version</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <tr
                    key={message.id}
                    className={`cursor-pointer border-b border-slate-100 ${selected?.id === message.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                    onClick={() => setSelectedId(message.id)}
                  >
                    <td className="px-4 py-3">{message.recipient.person.displayName}</td>
                    <td className="px-4 py-3">{message.subject}</td>
                    <td className="px-4 py-3">{message.status}</td>
                    <td className="px-4 py-3">{message.generationVersion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <aside className="rounded-md border border-slate-200 bg-white p-4">
            {selected ? (
              <form onSubmit={(event) => void edit(event)} className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">{selected.recipient.person.displayName}</h3>
                  <p className="text-xs text-slate-500">
                    {selected.recipient.person.organization?.name ?? 'No organization'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selected.recipient.person.channels
                      .map((channel) => `${channel.type}: ${channel.value}`)
                      .join(' · ')}
                  </p>
                </div>
                <input
                  name="subject"
                  defaultValue={selected.subject}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
                <textarea
                  name="body"
                  defaultValue={selected.body}
                  className="min-h-64 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  name="cta"
                  defaultValue={selected.cta ?? ''}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                  placeholder="CTA"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button type="submit">Save edit</Button>
                  <Button type="button" variant="outline" onClick={() => void regenerate()}>
                    Regenerate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void action('approve', 'Message approved.')}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void action('reject', 'Message rejected.')}
                  >
                    Reject
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-slate-600">Generate messages to preview drafts.</p>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
