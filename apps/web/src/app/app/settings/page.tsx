'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@crm/ui';
import { AppShell } from '@/components/app-shell';
import { apiRequest, type AuthState } from '@/lib/api';

type Tab = 'general' | 'ai' | 'email';

interface GeneralSettings {
  companyName: string;
  logoUrl: string | null;
  timezone: string;
  locale: string;
}

interface AISettings {
  provider: 'fake' | 'openai';
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  hasApiKey: boolean;
}

interface EmailSettings {
  provider: 'fake' | 'resend';
  domain: string | null;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  enabled: boolean;
  hasApiKey: boolean;
}

function formString(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function tabLabel(tab: Tab) {
  if (tab === 'ai') return 'AI';
  if (tab === 'general') return 'General';
  return 'Email';
}

export default function SettingsPage() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [tab, setTab] = useState<Tab>('general');
  const [general, setGeneral] = useState<GeneralSettings | null>(null);
  const [ai, setAI] = useState<AISettings | null>(null);
  const [email, setEmail] = useState<EmailSettings | null>(null);
  const [message, setMessage] = useState('');
  const workspaceId = auth?.activeWorkspaceId;

  useEffect(() => {
    apiRequest<AuthState>('/auth/me')
      .then(setAuth)
      .catch(() => setMessage('Unable to load session.'));
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    void loadSettings(workspaceId);
  }, [workspaceId]);

  async function loadSettings(activeWorkspaceId: string) {
    const [nextGeneral, nextAI, nextEmail] = await Promise.all([
      apiRequest<GeneralSettings>(`/workspaces/${activeWorkspaceId}/settings`),
      apiRequest<AISettings>(`/workspaces/${activeWorkspaceId}/settings/ai`),
      apiRequest<EmailSettings>(`/workspaces/${activeWorkspaceId}/settings/email`),
    ]);
    setGeneral(nextGeneral);
    setAI(nextAI);
    setEmail(nextEmail);
  }

  async function saveGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    const form = new FormData(event.currentTarget);
    const next = await apiRequest<GeneralSettings>(`/workspaces/${workspaceId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify({
        companyName: formString(form, 'companyName'),
        logoUrl: formString(form, 'logoUrl') || null,
        timezone: formString(form, 'timezone') || 'UTC',
        locale: formString(form, 'locale') || 'en-US',
      }),
    });
    setGeneral(next);
    setMessage('General settings saved.');
  }

  async function saveAI(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    const form = new FormData(event.currentTarget);
    const apiKey = formString(form, 'apiKey');
    const next = await apiRequest<AISettings>(`/workspaces/${workspaceId}/settings/ai`, {
      method: 'PATCH',
      body: JSON.stringify({
        provider: formString(form, 'provider') || 'fake',
        model: formString(form, 'model') || 'fake-v1',
        temperature: Number(formString(form, 'temperature') || 0.2),
        maxTokens: Number(formString(form, 'maxTokens') || 800),
        enabled: form.get('enabled') === 'true',
        ...(apiKey ? { apiKey } : {}),
      }),
    });
    setAI(next);
    event.currentTarget.reset();
    setMessage('AI settings saved.');
  }

  async function saveEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    const form = new FormData(event.currentTarget);
    const apiKey = formString(form, 'apiKey');
    const next = await apiRequest<EmailSettings>(`/workspaces/${workspaceId}/settings/email`, {
      method: 'PATCH',
      body: JSON.stringify({
        provider: formString(form, 'provider') || 'fake',
        domain: formString(form, 'domain') || null,
        fromName: formString(form, 'fromName'),
        fromEmail: formString(form, 'fromEmail'),
        replyTo: formString(form, 'replyTo') || null,
        enabled: form.get('enabled') === 'true',
        ...(apiKey ? { apiKey } : {}),
      }),
    });
    setEmail(next);
    event.currentTarget.reset();
    setMessage('Email settings saved.');
  }

  async function test(path: 'ai' | 'email') {
    if (!workspaceId) return;
    const result = await apiRequest<{ ok: boolean; provider: string; status: string }>(
      `/workspaces/${workspaceId}/settings/${path}/test`,
      { method: 'POST' },
    );
    setMessage(`${path.toUpperCase()} ${result.provider}: ${result.status}`);
  }

  if (!auth) {
    return <AppShell>Loading</AppShell>;
  }

  return (
    <AppShell>
      <main className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Settings</h2>
            <p className="text-sm text-slate-600">Workspace providers and defaults</p>
          </div>
          {message ? (
            <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              {message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {(['general', 'ai', 'email'] satisfies Tab[]).map((item) => (
            <Button
              key={item}
              type="button"
              variant={tab === item ? 'default' : 'outline'}
              onClick={() => setTab(item)}
            >
              {tabLabel(item)}
            </Button>
          ))}
        </div>

        {tab === 'general' && general ? (
          <form
            onSubmit={(event) => void saveGeneral(event)}
            className="max-w-2xl space-y-3 rounded-md border border-slate-200 bg-white p-4"
          >
            <input
              name="companyName"
              defaultValue={general.companyName}
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              placeholder="Company name"
            />
            <input
              name="logoUrl"
              defaultValue={general.logoUrl ?? ''}
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              placeholder="Logo URL"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                name="timezone"
                defaultValue={general.timezone}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="UTC"
              />
              <input
                name="locale"
                defaultValue={general.locale}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="en-US"
              />
            </div>
            <Button type="submit">Save</Button>
          </form>
        ) : null}

        {tab === 'ai' && ai ? (
          <form
            onSubmit={(event) => void saveAI(event)}
            className="max-w-2xl space-y-3 rounded-md border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Provider status: {ai.enabled ? 'Enabled' : 'Disabled'}</span>
              <span>{ai.hasApiKey ? 'API key configured' : 'No API key stored'}</span>
            </div>
            <select
              name="provider"
              defaultValue={ai.provider}
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
            >
              <option value="fake">Fake</option>
              <option value="openai">OpenAI</option>
            </select>
            <input
              name="model"
              defaultValue={ai.model}
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              placeholder="Model"
            />
            <input
              name="apiKey"
              type="password"
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              placeholder="New API key, leave blank to keep current"
            />
            <div className="grid gap-3 md:grid-cols-3">
              <input
                name="temperature"
                defaultValue={ai.temperature}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm"
              />
              <input
                name="maxTokens"
                defaultValue={ai.maxTokens}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm"
              />
              <select
                name="enabled"
                defaultValue={String(ai.enabled)}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm"
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="outline" onClick={() => void test('ai')}>
                Test connection
              </Button>
            </div>
          </form>
        ) : null}

        {tab === 'email' && email ? (
          <form
            onSubmit={(event) => void saveEmail(event)}
            className="max-w-2xl space-y-3 rounded-md border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Provider status: {email.enabled ? 'Enabled' : 'Disabled'}</span>
              <span>{email.hasApiKey ? 'API key configured' : 'No API key stored'}</span>
            </div>
            <select
              name="provider"
              defaultValue={email.provider}
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
            >
              <option value="fake">Fake</option>
              <option value="resend">Resend</option>
            </select>
            <input
              name="apiKey"
              type="password"
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              placeholder="New API key, leave blank to keep current"
            />
            <input
              name="domain"
              defaultValue={email.domain ?? ''}
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              placeholder="Sending domain"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                name="fromName"
                defaultValue={email.fromName}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="From name"
              />
              <input
                name="fromEmail"
                defaultValue={email.fromEmail}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="from@example.com"
              />
            </div>
            <input
              name="replyTo"
              defaultValue={email.replyTo ?? ''}
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              placeholder="reply-to@example.com"
            />
            <select
              name="enabled"
              defaultValue={String(email.enabled)}
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="outline" onClick={() => void test('email')}>
                Test connection
              </Button>
            </div>
          </form>
        ) : null}
      </main>
    </AppShell>
  );
}
