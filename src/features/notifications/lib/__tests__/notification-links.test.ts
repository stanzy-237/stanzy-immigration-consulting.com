import { describe, expect, it } from 'vitest';

import { actorName, notificationHref, type NotificationItem } from '@/features/notifications/lib/notification-links';

const item = (extra: Partial<NotificationItem>): NotificationItem =>
  ({
    id: 'n1',
    kind: 'MESSAGE_POSTED',
    count: 1,
    params: {},
    readAt: null,
    updatedAt: new Date(),
    actor: { name: 'Aminata Diallo', role: 'MEMBER' },
    dossier: { id: 'dos_1', service: 'ACCOMPAGNEMENT' },
    document: null,
    comment: null,
    invoice: null,
    ...extra,
  }) as NotificationItem;

describe('where a Notification leads', () => {
  it('opens the Document and highlights the message', () => {
    const n = item({ document: { id: 'doc_1', title: 'Relevé N2' }, comment: { id: 'com_9', body: 'Flou' } });
    expect(notificationHref(n, 'client', 'fr')).toBe(
      '/fr/mon-espace/dossiers/dos_1?document=doc_1&message=com_9#documents',
    );
    expect(notificationHref(n, 'consultant', 'fr')).toBe('/dossiers/dos_1?document=doc_1&message=com_9#documents');
  });

  it('sends a Facture to the Client’s invoices panel, and to its page for the consultant', () => {
    const n = item({
      kind: 'INVOICE_SENT',
      invoice: { id: 'inv_1', number: 'STZ-2026-0001', currency: 'XAF', total: 1 },
    });
    expect(notificationHref(n, 'client', 'en')).toBe('/en/mon-espace/dossiers/dos_1#factures');
    expect(notificationHref(n, 'consultant', 'fr')).toBe('/factures/inv_1');
  });

  it('lands a stage change on the stepper', () => {
    expect(notificationHref(item({ kind: 'DOSSIER_STAGE_CHANGED' }), 'client', 'fr')).toBe(
      '/fr/mon-espace/dossiers/dos_1#etapes',
    );
  });
});

describe('who did it', () => {
  it('calls the consultant « Stanzy »', () => {
    expect(actorName(item({ actor: { name: 'Nouping', role: 'CONSULTANT' } }), 'Quelqu’un')).toBe('Stanzy');
    expect(actorName(item({}), 'Quelqu’un')).toBe('Aminata Diallo');
    expect(actorName(item({ actor: null }), 'Quelqu’un')).toBe('Quelqu’un');
  });
});
