import { describe, expect, it, vi } from 'vitest';

import { remindersDue, remindUnsigned } from '@/features/signatures/server/sign-reminders';
import type { TRPCContext } from '@/server/trpc/context';

/**
 * Seam: the reminder round over an in-memory stand-in for the
 * signature_request, contract and notification tables, with the clock and
 * the mailer passed in.
 */
type Row = Record<string, unknown> & { id: string; reminders: number };

const client = { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr' };
const openDossier = { id: 'dos_1', service: 'ACCOMPAGNEMENT', state: 'OPEN', account: client };

function fakeDatabase(requests: Row[], contracts: Row[]) {
  const notifications: Record<string, unknown>[] = [];
  const dossierOf = (row: Row) => (row.dossier ?? openDossier) as typeof openDossier;
  // updateMany only where the counter is still what was read: the claim.
  const claim = (rows: Row[]) =>
    async function updateMany({ where, data }: { where: { id: string; reminders: number }; data: { reminders: number } }) {
      const row = rows.find((r) => r.id === where.id && r.reminders === where.reminders);
      if (row) row.reminders = data.reminders;
      return { count: row ? 1 : 0 };
    };
  const prisma = {
    signatureRequest: {
      async findMany() {
        return requests
          .filter((r) => r.status === 'PENDING' && r.reminders < 2 && dossierOf(r).state === 'OPEN')
          .map((r) => ({
            ...r,
            document: { id: 'doc_1', title: 'Lettre explicative', section: { dossier: dossierOf(r) } },
          }));
      },
      updateMany: claim(requests),
    },
    contract: {
      async findMany() {
        return contracts
          .filter((c) => c.status === 'SENT' && c.reminders < 2 && dossierOf(c).state === 'OPEN')
          .map((c) => ({ ...c, dossier: dossierOf(c) }));
      },
      updateMany: claim(contracts),
    },
    notification: {
      async findFirst() {
        return null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        notifications.push(data);
        return { id: `n_${notifications.length}` };
      },
    },
  };
  return { prisma: prisma as unknown as TRPCContext['prisma'], notifications };
}

// 07:15 in Douala on 10 November 2026.
const NOW = new Date('2026-11-10T06:15:00Z');
const at = (day: string) => new Date(`${day}T09:00:00Z`);
const request = (id: string, sent: string, extra: Record<string, unknown> = {}): Row => ({
  id,
  status: 'PENDING',
  createdAt: at(sent),
  reminders: 0,
  ...extra,
});
const contract = (id: string, sent: string, extra: Record<string, unknown> = {}): Row => ({
  id,
  number: 'CTR-2026-0001',
  title: 'Contrat d’accompagnement',
  parentId: null,
  status: 'SENT',
  sentAt: at(sent),
  reminders: 0,
  ...extra,
});

const run = (db: ReturnType<typeof fakeDatabase>, mailer = { send: vi.fn() }, now = NOW) =>
  remindUnsigned({ db: db.prisma, mailer, siteUrl: 'https://stanzy.test', now });

describe('remindersDue', () => {
  it('counts the reminders due 3 and 7 days after sending, by Douala day', () => {
    expect(remindersDue(at('2026-11-08'), '2026-11-10')).toBe(0);
    expect(remindersDue(at('2026-11-07'), '2026-11-10')).toBe(1);
    expect(remindersDue(at('2026-11-03'), '2026-11-10')).toBe(2);
    // 23:30 UTC is already the next day in Douala.
    expect(remindersDue(new Date('2026-11-06T23:30:00Z'), '2026-11-10')).toBe(1);
  });
});

describe('reminders of Demandes de signature', () => {
  it('reminds the Client 3 days after, by bell and email, once', async () => {
    const db = fakeDatabase([request('sig_1', '2026-11-07'), request('sig_2', '2026-11-08')], []);
    const mailer = { send: vi.fn() };
    expect(await run(db, mailer)).toEqual({ signatureReminders: 1, contractReminders: 0 });
    expect(db.notifications).toEqual([
      expect.objectContaining({
        kind: 'SIGNATURE_REMINDER',
        recipientId: 'acc_1',
        actorId: null,
        documentId: 'doc_1',
        params: { requestId: 'sig_1' },
      }),
    ]);
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'aminata@example.com',
        subject: 'Rappel : un document à signer dans votre dossier Accompagnement Entrée Express',
        text: expect.stringContaining('https://stanzy.test/fr/mon-espace/dossiers/dos_1/signer/sig_1'),
      }),
    );

    expect(await run(db)).toEqual({ signatureReminders: 0, contractReminders: 0 });
    expect(db.notifications).toHaveLength(1);
  });

  it('reminds again at 7 days, then never', async () => {
    const db = fakeDatabase([request('sig_1', '2026-11-03', { reminders: 1 })], []);
    expect(await run(db)).toMatchObject({ signatureReminders: 1 });
    expect(await run(db, undefined, new Date('2026-11-30T06:15:00Z'))).toMatchObject({ signatureReminders: 0 });
    expect(db.notifications).toHaveLength(1);
  });

  it('sends only the latest reminder when a run was missed', async () => {
    const requests = [request('sig_1', '2026-11-01')];
    const db = fakeDatabase(requests, []);
    expect(await run(db)).toMatchObject({ signatureReminders: 1 });
    expect(requests[0]!.reminders).toBe(2);
  });

  it('leaves signed and cancelled Demandes, and closed Dossiers', async () => {
    const db = fakeDatabase(
      [
        request('sig_1', '2026-11-03', { status: 'SIGNED' }),
        request('sig_2', '2026-11-03', { status: 'CANCELLED' }),
        request('sig_3', '2026-11-03', { dossier: { ...openDossier, state: 'CLOSED' } }),
      ],
      [],
    );
    expect(await run(db)).toEqual({ signatureReminders: 0, contractReminders: 0 });
    expect(db.notifications).toEqual([]);
  });

  it('sends nothing when another run claimed the reminder first', async () => {
    const requests = [request('sig_1', '2026-11-07')];
    const db = fakeDatabase(requests, []);
    const findMany = db.prisma.signatureRequest.findMany.bind(db.prisma.signatureRequest);
    vi.spyOn(db.prisma.signatureRequest, 'findMany').mockImplementation((async () => {
      const rows = await findMany();
      requests[0]!.reminders = 1;
      return rows;
    }) as never);
    expect(await run(db)).toMatchObject({ signatureReminders: 0 });
    expect(db.notifications).toEqual([]);
  });
});

describe('reminders of Contrats', () => {
  it('reminds the Client of a Contrat still unsigned, the button on it', async () => {
    const db = fakeDatabase([], [contract('ctr_1', '2026-11-07')]);
    const mailer = { send: vi.fn() };
    expect(await run(db, mailer)).toEqual({ signatureReminders: 0, contractReminders: 1 });
    expect(db.notifications).toEqual([
      expect.objectContaining({
        kind: 'CONTRACT_REMINDER',
        recipientId: 'acc_1',
        dossierId: 'dos_1',
        params: { contractId: 'ctr_1', number: 'CTR-2026-0001' },
      }),
    ]);
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Rappel : CTR-2026-0001 à signer',
        text: expect.stringContaining('https://stanzy.test/fr/mon-espace/dossiers/dos_1/contrats/ctr_1'),
      }),
    );
  });

  it('leaves signed and cancelled Contrats', async () => {
    const db = fakeDatabase(
      [],
      [contract('ctr_1', '2026-11-03', { status: 'SIGNED' }), contract('ctr_2', '2026-11-03', { status: 'CANCELLED' })],
    );
    expect(await run(db)).toEqual({ signatureReminders: 0, contractReminders: 0 });
  });

  it('keeps the bell even when the email fails', async () => {
    const db = fakeDatabase([], [contract('ctr_1', '2026-11-07')]);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await run(db, { send: vi.fn().mockRejectedValue(new Error('Resend down')) })).toMatchObject({
      contractReminders: 1,
    });
    expect(db.notifications).toHaveLength(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
