'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@crm/ui';
import { apiRequest, type AuthState } from '@/lib/api';

type ConversationStatus = 'OPEN' | 'CLOSED' | 'ARCHIVED';

interface InboundMessage {
  id: string;
  fromAddress: string;
  toAddress: string;
  subject: string | null;
  textBody: string | null;
  receivedAt: string;
  readAt: string | null;
}

interface Conversation {
  id: string;
  subject: string | null;
  status: ConversationStatus;
  unreadCount: number;
  lastMessageAt: string;
  person: { displayName: string };
  outreach: { name: string } | null;
  delivery: { id: string } | null;
  generatedMessage: { subject: string } | null;
  messages: InboundMessage[];
}

interface InboxResponse {
  items: Conversation[];
  total: number;
  counters: {
    open: number;
    closed: number;
    archived: number;
    unread: number;
  };
}

interface DeliveryListResponse {
  items: Array<{
    id: string;
    status: string;
    generatedMessage: {
      subject: string;
      outreach: { name: string };
    };
  }>;
}

const statuses: Array<ConversationStatus | 'ALL'> = ['OPEN', 'CLOSED', 'ARCHIVED', 'ALL'];

export default function InboxPage() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [status, setStatus] = useState<ConversationStatus | 'ALL'>('OPEN');
  const [inbox, setInbox] = useState<InboxResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<Conversation | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryListResponse['items']>([]);
  const [deliveryId, setDeliveryId] = useState('');
  const [simulateText, setSimulateText] = useState('Thanks, I am interested.');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const workspaceId = auth?.activeWorkspaceId;

  useEffect(() => {
    apiRequest<AuthState>('/auth/me').then(setAuth).catch(setRequestError);
  }, []);

  const loadInbox = useCallback(
    async (activeWorkspaceId = workspaceId) => {
      if (!activeWorkspaceId) {
        return;
      }
      setError('');
      const query = status === 'ALL' ? '' : `?status=${status}`;
      const response = await apiRequest<InboxResponse>(
        `/workspaces/${activeWorkspaceId}/inbox${query}`,
      );
      setInbox(response);
      if (response.items.length === 0) {
        setSelectedId(null);
        setThread(null);
      }
    },
    [status, workspaceId],
  );

  useEffect(() => {
    if (!workspaceId || !selectedId) {
      setThread(null);
      return;
    }
    void apiRequest<Conversation>(`/workspaces/${workspaceId}/inbox/${selectedId}`)
      .then(setThread)
      .catch(setRequestError);
  }, [workspaceId, selectedId]);

  const selected = useMemo(
    () => inbox?.items.find((item) => item.id === selectedId) ?? inbox?.items[0] ?? null,
    [inbox, selectedId],
  );

  useEffect(() => {
    if (!selectedId && selected) {
      setSelectedId(selected.id);
    }
  }, [selected, selectedId]);

  useEffect(() => {
    if (!workspaceId) {
      return;
    }
    void loadInbox(workspaceId);
    void apiRequest<DeliveryListResponse>(
      `/workspaces/${workspaceId}/deliveries?status=SENT&pageSize=100`,
    )
      .then((response) => {
        setDeliveries(response.items);
        setDeliveryId((current) => current || response.items[0]?.id || '');
      })
      .catch(() => setDeliveries([]));
  }, [loadInbox, workspaceId]);

  async function markRead(read: boolean) {
    if (!workspaceId || !selectedId) {
      return;
    }
    setBusy(true);
    try {
      await apiRequest<Conversation>(
        `/workspaces/${workspaceId}/inbox/${selectedId}/${read ? 'read' : 'unread'}`,
        { method: 'POST' },
      );
      await loadInbox(workspaceId);
      setThread(await apiRequest<Conversation>(`/workspaces/${workspaceId}/inbox/${selectedId}`));
    } catch (requestError) {
      setRequestError(requestError);
    } finally {
      setBusy(false);
    }
  }

  async function setConversationStatus(nextStatus: ConversationStatus) {
    if (!workspaceId || !selectedId) {
      return;
    }
    setBusy(true);
    try {
      await apiRequest<Conversation>(`/workspaces/${workspaceId}/inbox/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadInbox(workspaceId);
      setThread(await apiRequest<Conversation>(`/workspaces/${workspaceId}/inbox/${selectedId}`));
    } catch (requestError) {
      setRequestError(requestError);
    } finally {
      setBusy(false);
    }
  }

  async function simulateInbound() {
    if (!workspaceId || !deliveryId) {
      return;
    }
    setBusy(true);
    try {
      await apiRequest<{ accepted: boolean }>(`/workspaces/${workspaceId}/inbox/fake`, {
        method: 'POST',
        body: JSON.stringify({ deliveryId, textBody: simulateText }),
      });
      await loadInbox(workspaceId);
    } catch (requestError) {
      setRequestError(requestError);
    } finally {
      setBusy(false);
    }
  }

  function setRequestError(requestError: unknown) {
    setError(requestError instanceof Error ? requestError.message : 'Request failed.');
  }

  if (!auth) {
    return <main className="text-sm text-slate-600">Loading</main>;
  }
  if (!workspaceId) {
    return <main className="text-sm text-slate-600">Select a workspace.</main>;
  }

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Inbox</h1>
          <p className="text-sm text-slate-600">
            {inbox?.counters.unread ?? 0} unread - {inbox?.counters.open ?? 0} open -{' '}
            {inbox?.total ?? 0} shown
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statuses.map((item) => (
            <Button
              key={item}
              type="button"
              variant={status === item ? 'default' : 'outline'}
              onClick={() => {
                setStatus(item);
                setSelectedId(null);
              }}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
            Conversations
          </div>
          <div className="divide-y divide-slate-100">
            {inbox?.items.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${
                  selectedId === conversation.id ? 'bg-slate-100' : ''
                }`}
                onClick={() => setSelectedId(conversation.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-slate-950">
                    {conversation.person.displayName}
                  </p>
                  {conversation.unreadCount > 0 ? (
                    <span className="rounded-full bg-slate-950 px-2 py-0.5 text-xs text-white">
                      {conversation.unreadCount}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm text-slate-700">
                  {conversation.subject ?? conversation.generatedMessage?.subject ?? 'No subject'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {conversation.status} - {new Date(conversation.lastMessageAt).toLocaleString()}
                </p>
              </button>
            ))}
            {inbox?.items.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-500">No conversations.</p>
            ) : null}
          </div>
        </aside>

        <section className="min-h-[520px] rounded-md border border-slate-200 bg-white">
          {thread ? (
            <div className="flex min-h-[520px] flex-col">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      {thread.subject ?? thread.generatedMessage?.subject ?? 'No subject'}
                    </h2>
                    <p className="text-sm text-slate-600">
                      {thread.person.displayName}
                      {thread.outreach ? ` - ${thread.outreach.name}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void markRead(true)}
                    >
                      Mark read
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void markRead(false)}
                    >
                      Mark unread
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void setConversationStatus('OPEN')}
                    >
                      Open
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void setConversationStatus('CLOSED')}
                    >
                      Close
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void setConversationStatus('ARCHIVED')}
                    >
                      Archive
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-4 overflow-auto px-5 py-4">
                {thread.messages.map((message) => (
                  <article
                    key={message.id}
                    className="rounded-md border border-slate-200 px-4 py-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {message.fromAddress} to {message.toAddress}
                      </span>
                      <span>{new Date(message.receivedAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                      {message.textBody ?? 'No text body available.'}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-5 py-8 text-sm text-slate-500">Select a conversation.</div>
          )}
        </section>
      </section>

      <section className="rounded-md border border-slate-200 bg-white px-4 py-4">
        <h2 className="text-sm font-semibold text-slate-950">Fake inbound simulation</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
          <select
            className="h-9 rounded-md border border-slate-300 px-3 text-sm"
            value={deliveryId}
            onChange={(event) => setDeliveryId(event.target.value)}
          >
            <option value="">Select sent delivery</option>
            {deliveries.map((delivery) => (
              <option key={delivery.id} value={delivery.id}>
                {delivery.generatedMessage.outreach.name} - {delivery.generatedMessage.subject}
              </option>
            ))}
          </select>
          <input
            className="h-9 rounded-md border border-slate-300 px-3 text-sm"
            value={simulateText}
            onChange={(event) => setSimulateText(event.target.value)}
          />
          <Button
            type="button"
            disabled={busy || !deliveryId}
            onClick={() => void simulateInbound()}
          >
            Simulate
          </Button>
        </div>
      </section>
    </main>
  );
}
