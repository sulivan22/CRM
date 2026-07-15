'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@crm/ui';
import { AppShell } from '@/components/app-shell';
import { apiRequest, type AuthState } from '@/lib/api';

type Organization = { id: string; name: string };
type Tag = { id: string; name: string; color: string | null };
type Channel = { id: string; type: string; value: string; isPrimary: boolean };
type Person = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  countryCode: string | null;
  languageCode: string | null;
  followerCount: number | null;
  organization: Organization | null;
  channels: Channel[];
  tags: { tag: Tag }[];
  updatedAt: string;
};
type ImportJob = {
  id: string;
  status: string;
  totalRows: number;
  processedRows: number;
  succeededRows: number;
  failedRows: number;
};

const channelTypes = [
  'EMAIL',
  'LINKEDIN',
  'X',
  'INSTAGRAM',
  'TIKTOK',
  'YOUTUBE',
  'WEBSITE',
  'PHONE',
  'OTHER',
];

function formString(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export default function PeoplePage() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [message, setMessage] = useState('');
  const [importJob, setImportJob] = useState<ImportJob | null>(null);

  const workspaceId = auth?.activeWorkspaceId;
  const selected = people.find((person) => person.id === selectedId) ?? people[0] ?? null;

  const loadPeople = useCallback(
    async (activeWorkspaceId: string) => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (tagFilter) params.set('tagId', tagFilter);
      if (orgFilter) params.set('organizationId', orgFilter);
      const suffix = params.toString();
      const next = await apiRequest<Person[]>(
        `/workspaces/${activeWorkspaceId}/people${suffix ? `?${suffix}` : ''}`,
      );
      setPeople(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    },
    [orgFilter, search, tagFilter],
  );

  const loadWorkspaceData = useCallback(
    async (activeWorkspaceId: string) => {
      const [nextOrganizations, nextTags] = await Promise.all([
        apiRequest<Organization[]>(`/workspaces/${activeWorkspaceId}/organizations`),
        apiRequest<Tag[]>(`/workspaces/${activeWorkspaceId}/tags`),
      ]);
      setOrganizations(nextOrganizations);
      setTags(nextTags);
      await loadPeople(activeWorkspaceId);
    },
    [loadPeople],
  );

  useEffect(() => {
    apiRequest<AuthState>('/auth/me')
      .then(setAuth)
      .catch(() => setMessage('Unable to load session.'));
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    void loadWorkspaceData(workspaceId);
  }, [loadWorkspaceData, workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    const timeout = window.setTimeout(() => void loadPeople(workspaceId), 250);
    return () => window.clearTimeout(timeout);
  }, [loadPeople, workspaceId]);

  async function createPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    const form = new FormData(event.currentTarget);
    const displayName = formString(form, 'displayName');
    const email = formString(form, 'email');
    if (!displayName) return;
    await apiRequest<Person>(`/workspaces/${workspaceId}/people`, {
      method: 'POST',
      body: JSON.stringify({
        displayName,
        jobTitle: formString(form, 'jobTitle') || undefined,
        organizationId: formString(form, 'organizationId') || undefined,
        channels: email ? [{ type: 'EMAIL', value: email, isPrimary: true }] : [],
      }),
    });
    event.currentTarget.reset();
    setMessage('Person created.');
    await loadPeople(workspaceId);
  }

  async function updateSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !selected) return;
    const form = new FormData(event.currentTarget);
    await apiRequest<Person>(`/workspaces/${workspaceId}/people/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        displayName: formString(form, 'displayName'),
        jobTitle: formString(form, 'jobTitle') || undefined,
        organizationId: formString(form, 'organizationId') || null,
        countryCode: formString(form, 'countryCode') || undefined,
        languageCode: formString(form, 'languageCode') || undefined,
        followerCount: Number(formString(form, 'followerCount')) || undefined,
      }),
    });
    setMessage('Person updated.');
    await loadPeople(workspaceId);
  }

  async function addChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !selected) return;
    const form = new FormData(event.currentTarget);
    await apiRequest<Person>(`/workspaces/${workspaceId}/people/${selected.id}/channels`, {
      method: 'POST',
      body: JSON.stringify({
        type: formString(form, 'type') || 'EMAIL',
        value: formString(form, 'value'),
      }),
    });
    event.currentTarget.reset();
    await loadPeople(workspaceId);
  }

  async function assignTag(tagId: string) {
    if (!workspaceId || !selected || !tagId) return;
    await apiRequest<Person>(`/workspaces/${workspaceId}/people/${selected.id}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagId }),
    });
    await loadPeople(workspaceId);
  }

  async function importCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    const form = new FormData(event.currentTarget);
    const response = await apiRequest<ImportJob>(`/workspaces/${workspaceId}/imports/people`, {
      method: 'POST',
      body: form,
    });
    setImportJob(response);
    setMessage(`Import queued: ${response.totalRows} rows.`);
  }

  async function refreshImport() {
    if (!workspaceId || !importJob) return;
    const response = await apiRequest<ImportJob>(
      `/workspaces/${workspaceId}/imports/${importJob.id}`,
    );
    setImportJob(response);
    await loadPeople(workspaceId);
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">People</h2>
            <p className="text-sm text-slate-600">
              {people.length} active contacts in this workspace
            </p>
          </div>
          {message ? (
            <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              {message}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
              <input
                className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Search people, orgs, channels"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                value={orgFilter}
                onChange={(event) => setOrgFilter(event.target.value)}
              >
                <option value="">All organizations</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
              >
                <option value="">All tags</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>

            <form
              onSubmit={(event) => void createPerson(event)}
              className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto]"
            >
              <input
                name="displayName"
                className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Name"
              />
              <input
                name="email"
                className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Email"
              />
              <select
                name="organizationId"
                className="h-9 rounded-md border border-slate-300 px-3 text-sm"
              >
                <option value="">No organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <Button type="submit">New</Button>
            </form>

            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Channels</th>
                    <th className="px-4 py-3">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr
                      key={person.id}
                      className={`cursor-pointer border-b border-slate-100 ${selected?.id === person.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                      onClick={() => setSelectedId(person.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-950">{person.displayName}</p>
                        <p className="text-xs text-slate-500">{person.jobTitle ?? 'No title'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {person.organization?.name ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {person.channels.map((channel) => channel.type).join(', ') || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {person.tags.map(({ tag }) => (
                            <span
                              key={tag.id}
                              className="rounded border border-slate-200 px-2 py-0.5 text-xs"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-4">
            <form
              onSubmit={(event) => void importCsv(event)}
              className="space-y-3 rounded-md border border-slate-200 bg-white p-4"
            >
              <h3 className="text-sm font-semibold text-slate-950">CSV import</h3>
              <input
                name="file"
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input name="overwriteExisting" type="checkbox" value="true" />
                Update matched people
              </label>
              <Button type="submit" variant="outline" className="w-full">
                Import
              </Button>
              {importJob ? (
                <div className="space-y-2 text-sm text-slate-700">
                  <p>
                    {importJob.status}: {importJob.processedRows}/{importJob.totalRows}
                  </p>
                  <p>
                    {importJob.succeededRows} succeeded, {importJob.failedRows} failed
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => void refreshImport()}
                  >
                    Refresh
                  </Button>
                </div>
              ) : null}
            </form>

            {selected ? (
              <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
                <form onSubmit={(event) => void updateSelected(event)} className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-950">Details</h3>
                  <input
                    name="displayName"
                    defaultValue={selected.displayName}
                    className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                  />
                  <input
                    name="jobTitle"
                    defaultValue={selected.jobTitle ?? ''}
                    className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                    placeholder="Job title"
                  />
                  <select
                    name="organizationId"
                    defaultValue={selected.organization?.id ?? ''}
                    className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                  >
                    <option value="">No organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      name="countryCode"
                      defaultValue={selected.countryCode ?? ''}
                      className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                      placeholder="US"
                    />
                    <input
                      name="languageCode"
                      defaultValue={selected.languageCode ?? ''}
                      className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                      placeholder="en"
                    />
                    <input
                      name="followerCount"
                      defaultValue={selected.followerCount ?? ''}
                      className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                      placeholder="Followers"
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Save
                  </Button>
                </form>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-950">Channels</h3>
                  {selected.channels.map((channel) => (
                    <p key={channel.id} className="text-sm text-slate-700">
                      {channel.type}: {channel.value}
                    </p>
                  ))}
                  <form
                    onSubmit={(event) => void addChannel(event)}
                    className="grid grid-cols-[120px_minmax(0,1fr)] gap-2"
                  >
                    <select
                      name="type"
                      className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                    >
                      {channelTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <input
                      name="value"
                      className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                      placeholder="Value"
                    />
                    <Button type="submit" variant="outline" className="col-span-2">
                      Add channel
                    </Button>
                  </form>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-950">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700"
                        onClick={() => void assignTag(tag.id)}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
