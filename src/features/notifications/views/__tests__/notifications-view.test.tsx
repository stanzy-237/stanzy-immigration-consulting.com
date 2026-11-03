// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { PAGE_SIZE } from '@/features/notifications/lib/notification-schema';
import { NotificationsView } from '@/features/notifications/views/notifications-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: the full page as the consultant reads it, the first page in the cache as the route prefetches it. */
const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60_000 - 60_000);
const notification = (id: string, updatedAt: Date, readAt: Date | null, extra: Record<string, unknown> = {}) => ({
  id,
  kind: 'VERSION_UPLOADED',
  count: 3,
  params: {},
  readAt,
  updatedAt,
  actor: { name: 'Aminata Diallo', role: 'MEMBER' },
  dossier: { id: 'dos_1', service: 'ACCOMPAGNEMENT' },
  document: { id: 'doc_1', title: 'Licence' },
  comment: null,
  invoice: null,
  ...extra,
});
const all = [
  notification('n1', new Date(now.getTime() - 60_000), null),
  notification('n2', daysAgo(1), daysAgo(1), {
    kind: 'PROOF_RECEIVED',
    document: null,
    invoice: { id: 'inv_1', number: 'STZ-2026-0004', currency: 'XAF', total: 1 },
  }),
];

function page() {
  const { trpc, queryClient, wrap } = createTestTRPC({
    'notifications.unreadCount': () => 1,
    'notifications.list': ({ filter }) => ({
      items: filter === 'UNREAD' ? all.filter((n) => !n.readAt) : all,
      next: null,
    }),
  });
  queryClient.setQueryData(trpc.notifications.list.infiniteQueryKey({ filter: 'ALL', limit: PAGE_SIZE }), {
    pages: [{ items: all, next: null }],
    pageParams: [null],
  } as never);
  return render(withIntl(wrap(<NotificationsView audience="consultant" />)));
}

describe('NotificationsView', () => {
  it('groups by day, in words, each leading to its item', async () => {
    page();
    const today = await screen.findByRole('region', { name: 'Aujourd’hui' });
    expect(
      within(today).getByRole('link', { name: /Aminata Diallo a téléversé 3 nouvelles versions de « Licence »/ }),
    ).toHaveAttribute('href', '/dossiers/dos_1?document=doc_1#documents');
    const yesterday = screen.getByRole('region', { name: 'Hier' });
    expect(
      within(yesterday).getByRole('link', { name: /preuve de paiement pour la facture STZ-2026-0004/ }),
    ).toHaveAttribute('href', '/factures/inv_1');
  });

  it('shows only the unread ones on demand', async () => {
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Non lues (1)' }));
    expect(await screen.findByRole('link', { name: /Licence/ })).toBeInTheDocument();
    expect(screen.queryByText(/STZ-2026-0004/)).not.toBeInTheDocument();
  });
});
