'use client';

import React, { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@crm/ui';
import { AppShell } from '@/components/app-shell';
import { apiRequest, type AuthState } from '@/lib/api';

type Organization = { id: string; name: string };
type Tag = { id: string; name: string };
type Person = { id: string; displayName: string };

function formString(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export default function NewOutreachPage() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [resolved, setResolved] = useState<Person[]>([]);
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
    void Promise.all([
      apiRequest<Organization[]>(`/workspaces/${workspaceId}/organizations`).then(setOrganizations),
      apiRequest<Tag[]>(`/workspaces/${workspaceId}/tags`).then(setTags),
      apiRequest<Person[]>(`/workspaces/${workspaceId}/people`).then(setPeople),
    ]);
  }, [workspaceId]);

  function buildAudience(form: FormData) {
    const personIds = form
      .getAll('personIds')
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    const tagIds = form
      .getAll('tagIds')
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    const organizationIds = form
      .getAll('organizationIds')
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    const filters = {
      search: formString(form, 'search') || undefined,
      countryCode: formString(form, 'countryCode') || undefined,
      languageCode: formString(form, 'languageCode') || undefined,
      channelType: formString(form, 'channelType') || undefined,
      hasEmail: form.get('hasEmail') === 'true' || undefined,
      hasInstagram: form.get('hasInstagram') === 'true' || undefined,
    };
    return {
      personIds,
      tagIds,
      organizationIds,
      filters,
    };
  }

  async function resolveForm(formElement: HTMLFormElement) {
    if (!workspaceId) return;
    const audience = buildAudience(new FormData(formElement));
    const response = await apiRequest<Person[]>(
      `/workspaces/${workspaceId}/outreach/audience/resolve`,
      {
        method: 'POST',
        body: JSON.stringify({ audience }),
      },
    );
    setResolved(response);
    setMessage(`${response.length} recipients resolved.`);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    const form = new FormData(event.currentTarget);
    const response = await apiRequest<{ id: string }>(`/workspaces/${workspaceId}/outreach`, {
      method: 'POST',
      body: JSON.stringify({
        name: formString(form, 'name'),
        objective: formString(form, 'objective'),
        languageCode: formString(form, 'languageCode') || 'en',
        tone: formString(form, 'tone') || 'PROFESSIONAL',
        length: formString(form, 'length') || 'MEDIUM',
        additionalContext: formString(form, 'additionalContext') || undefined,
        audience: buildAudience(form),
      }),
    });
    window.location.href = `/app/outreach/${response.id}`;
  }

  return (
    <AppShell>
      <form
        onSubmit={(event) => void create(event)}
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">New outreach</h2>
            <p className="text-sm text-slate-600">
              Create a draft and generate one message per resolved person.
            </p>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold">Audience</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                name="personIds"
                multiple
                className="min-h-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.displayName}
                  </option>
                ))}
              </select>
              <select
                name="tagIds"
                multiple
                className="min-h-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <select
                name="organizationIds"
                multiple
                className="min-h-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <div className="grid gap-2">
                <input
                  name="search"
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                  placeholder="People search"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="countryCode"
                    className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                    placeholder="Country"
                  />
                  <input
                    name="languageCode"
                    className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                    placeholder="Language"
                  />
                </div>
                <select
                  name="channelType"
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                >
                  <option value="">Any channel</option>
                  <option value="EMAIL">Email</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="LINKEDIN">LinkedIn</option>
                </select>
                <label className="text-sm">
                  <input name="hasEmail" value="true" type="checkbox" /> Has email
                </label>
                <label className="text-sm">
                  <input name="hasInstagram" value="true" type="checkbox" /> Has Instagram
                </label>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={(event) => {
                if (event.currentTarget.form) {
                  void resolveForm(event.currentTarget.form);
                }
              }}
            >
              Resolve audience
            </Button>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold">Objective</h3>
            <div className="grid gap-3">
              <input
                name="name"
                className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Outreach name"
                required
              />
              <textarea
                name="objective"
                className="min-h-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Objective"
                required
              />
              <div className="grid gap-2 md:grid-cols-3">
                <input
                  name="languageCode"
                  defaultValue="en"
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                />
                <select
                  name="tone"
                  defaultValue="PROFESSIONAL"
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                >
                  <option>PROFESSIONAL</option>
                  <option>FRIENDLY</option>
                  <option>DIRECT</option>
                  <option>WARM</option>
                  <option>PERSUASIVE</option>
                </select>
                <select
                  name="length"
                  defaultValue="MEDIUM"
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                >
                  <option>SHORT</option>
                  <option>MEDIUM</option>
                  <option>LONG</option>
                </select>
              </div>
              <textarea
                name="additionalContext"
                className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Additional context"
              />
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold">Confirm</h3>
            <p className="mt-2 text-sm text-slate-600">
              {message || 'Resolve audience before creating.'}
            </p>
            <div className="mt-3 max-h-56 space-y-1 overflow-auto text-sm">
              {resolved.map((person) => (
                <p key={person.id}>{person.displayName}</p>
              ))}
            </div>
            <Button type="submit" className="mt-4 w-full" disabled={resolved.length === 0}>
              Create draft
            </Button>
          </div>
        </aside>
      </form>
    </AppShell>
  );
}
