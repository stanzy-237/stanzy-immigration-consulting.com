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
  it('opens the Dossier’s messages', () => {
    const n = item({ kind: 'DOSSIER_MESSAGE' });
    expect(notificationHref(n, 'client', 'fr')).toBe('/fr/mon-espace/dossiers/dos_1#messages');
    expect(notificationHref(n, 'consultant', 'fr')).toBe('/dossiers/dos_1#messages');
  });

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

  it('opens a document to sign on its fields, and shows the consultant the signed Document', () => {
    const requested = item({
      kind: 'SIGNATURE_REQUESTED',
      document: { id: 'doc_1', title: 'Lettre explicative' },
      params: { requestId: 'sig_1' },
    });
    expect(notificationHref(requested, 'client', 'fr')).toBe('/fr/mon-espace/dossiers/dos_1/signer/sig_1');
    const signed = item({ kind: 'DOCUMENT_SIGNED', document: { id: 'doc_1', title: 'Lettre explicative' } });
    expect(notificationHref(signed, 'consultant', 'fr')).toBe('/dossiers/dos_1?document=doc_1#documents');
  });

  it('opens a reminder on what is left to sign', () => {
    const request = item({
      kind: 'SIGNATURE_REMINDER',
      document: { id: 'doc_1', title: 'Lettre explicative' },
      params: { requestId: 'sig_1' },
    });
    expect(notificationHref(request, 'client', 'fr')).toBe('/fr/mon-espace/dossiers/dos_1/signer/sig_1');
    const contract = item({ kind: 'CONTRACT_REMINDER', params: { contractId: 'ctr_1' } });
    expect(notificationHref(contract, 'client', 'en')).toBe('/en/mon-espace/dossiers/dos_1/contrats/ctr_1');
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
