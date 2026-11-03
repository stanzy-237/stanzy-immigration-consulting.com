// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { NotificationBell } from '@/features/shared/components/notification-bell';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/**
 * Seam: the bell as a signed-in Client uses it, over stubbed `notifications`
 * procedures that record what the bell sends.
 */
const now = new Date();
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const items = [
  {
    id: 'n1',
    kind: 'MESSAGE_POSTED',
    count: 1,
    params: {},
    readAt: null,
    updatedAt: minutesAgo(5),
    actor: { name: 'Nouping', role: 'CONSULTANT' },
    dossier: { id: 'dos_1', service: 'ACCOMPAGNEMENT' },
    document: { id: 'doc_1', title: 'Relevé N2' },
    comment: { id: 'com_1', body: 'Le scan est flou.' },
    invoice: null,
  },
  {
    id: 'n2',
    kind: 'INVOICE_SENT',
    count: 1,
    params: {},
    readAt: null,
    updatedAt: minutesAgo(60),
    actor: { name: 'Nouping', role: 'CONSULTANT' },
    dossier: { id: 'dos_1', service: 'ACCOMPAGNEMENT' },
    document: null,
    comment: null,
    invoice: { id: 'inv_1', number: 'STZ-2026-0001', currency: 'XAF', total: 150000 },
  },
];

const api = vi.hoisted(() => ({ markRead: vi.fn(), markAllRead: vi.fn(), unread: 2 }));
beforeEach(() => {
  vi.resetAllMocks();
  api.unread = 2;
});

function bell() {
  const { wrap } = createTestTRPC({
    'notifications.unreadCount': () => api.unread,
    'notifications.list': () => ({ items, next: null }),
    'notifications.markRead': (input) => {
      api.unread -= 1;
      return api.markRead(input);
    },
    'notifications.markAllRead': (input) => {
      api.unread = 0;
      return api.markAllRead(input);
    },
  });
  return render(withIntl(wrap(<NotificationBell audience="client" />)));
}

describe('NotificationBell', () => {
  it('shows the unread count, then the latest notifications in words', async () => {
    const { container } = bell();
    const trigger = await screen.findByRole('button', { name: 'Notifications : 2 non lues' });
    expect(within(trigger).getByText('2')).toBeInTheDocument();

    fireEvent.click(trigger);
    const message = await screen.findByRole('link', { name: /Stanzy a écrit sur « Relevé N2 »/ });
    expect(message).toHaveAttribute('href', '/fr/mon-espace/dossiers/dos_1?document=doc_1&message=com_1#documents');
    expect(within(message).getByText('Le scan est flou.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nouvelle facture STZ-2026-0001 : 150 000 FCFA/ })).toHaveAttribute(
      'href',
      '/fr/mon-espace/dossiers/dos_1#factures',
    );
    expect(await axe(container)).toHaveNoViolations();
  }, 30_000);

  it('marks a notification read when followed, and the count drops at once', async () => {
    bell();
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications : 2 non lues' }));
    fireEvent.click(await screen.findByRole('link', { name: /Stanzy a écrit/ }));
    await waitFor(() => expect(api.markRead).toHaveBeenCalledWith({ id: 'n1' }));
    expect(await screen.findByRole('button', { name: 'Notifications : 1 non lue' })).toBeInTheDocument();
  });

  it('marks everything read', async () => {
    bell();
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications : 2 non lues' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tout marquer comme lu' }));
    await waitFor(() => expect(api.markAllRead).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });
});
