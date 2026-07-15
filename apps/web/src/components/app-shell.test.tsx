import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

const fetchMock = vi.fn();

describe('AppShell', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true
    });
  });

  it('renders authenticated shell and switches workspace', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            user: { id: 'user-id', email: 'dev@example.com', displayName: 'Dev' },
            activeWorkspaceId: 'workspace-1',
            memberships: [
              {
                id: 'membership-1',
                role: 'OWNER',
                status: 'ACTIVE',
                workspace: { id: 'workspace-1', name: 'One', slug: 'one', status: 'ACTIVE' }
              },
              {
                id: 'membership-2',
                role: 'MEMBER',
                status: 'ACTIVE',
                workspace: { id: 'workspace-2', name: 'Two', slug: 'two', status: 'ACTIVE' }
              }
            ]
          })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            user: { id: 'user-id', email: 'dev@example.com', displayName: 'Dev' },
            activeWorkspaceId: 'workspace-2',
            memberships: []
          })
      });

    render(<AppShell />);

    expect(await screen.findByText('Dev')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/active workspace/i), {
      target: { value: 'workspace-2' }
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/switch-workspace'),
        expect.objectContaining({ credentials: 'include' })
      );
    });
  });
});
