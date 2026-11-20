import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const notifications = vi.hoisted(() => ({ notifyLater: vi.fn() }));
vi.mock('@/features/notifications/server/notify', () => notifications);
vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }));

beforeEach(() => vi.clearAllMocks());

type Row = Record<string, unknown> & { id: string; createdAt: Date; status: string; accountId: string };

/** Seam: `reports` through a server-side caller, over an in-memory stand-in for the reports and their Accounts (#160). */
function fakeDatabase(seed: Partial<Row>[] = []) {
  const accounts = [
    { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', role: 'MEMBER' },
    { id: 'acc_stanzy', name: 'Stanzy', email: 'stanzy@example.com', role: 'CONSULTANT' },
  ];
  let seq = 0;
  const reports: Row[] = seed.map((row) => ({ id: `rep_${++seq}`, createdAt: new Date(), status: 'NEW', accountId: 'acc_1', rollbarIds: [], ...row }) as Row);
  const db = {
    problemReport: {
      count: async ({ where }: { where: { accountId: string; createdAt: { gte: Date } } }) =>
        reports.filter((report) => report.accountId === where.accountId && report.createdAt >= where.createdAt.gte).length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `rep_${++seq}`, createdAt: new Date(), status: 'NEW', ...data } as Row;
        reports.push(row);
        return { id: row.id };
      },
      findMany: async ({ where }: { where: { status?: string } }) =>
        reports
          .filter((report) => !where.status || report.status === where.status)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((report) => ({ ...report, account: accounts.find((account) => account.id === report.accountId) })),
      updateMany: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        const found = reports.filter((report) => report.id === where.id);
        for (const report of found) report.status = data.status;
        return { count: found.length };
      },
    },
  };
  return { db: db as unknown as TRPCContext['prisma'], reports };
}

const client = sessionFor();
const consultant = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' });
const callerFor = (db: TRPCContext['prisma'], session: CurrentSession | null, headers = new Headers()) =>
  createCaller({ prisma: db, session, headers } as unknown as TRPCContext).reports;

const UUID = '3f1c2a9e-7b4d-4e2a-9c1f-0a6b5d8e7f21';

describe('Signaler un problème (#160)', () => {
  it('keeps what happened, the page, the browser and the tab’s Rollbar items, and tells the consultant', async () => {
    const { db, reports } = fakeDatabase();
    const headers = new Headers({ 'user-agent': 'Mozilla/5.0 (iPhone)' });
    await callerFor(db, client, headers).create({ message: '  Le bouton Signer ne répond pas.  ', path: '/fr/mon-espace/dossiers/d_1', rollbarIds: [UUID] });

    expect(reports[0]).toMatchObject({
      accountId: 'acc_1',
      message: 'Le bouton Signer ne répond pas.',
      path: '/fr/mon-espace/dossiers/d_1',
      userAgent: 'Mozilla/5.0 (iPhone)',
      rollbarIds: [UUID],
    });
    expect(notifications.notifyLater).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ kind: 'PROBLEM_REPORTED', recipients: 'CONSULTANTS', params: { reportId: reports[0]!.id, client: 'Aminata Diallo' } }),
    );
  });

  it('refuses a visitor signed out, a message too short, a page with its query string and an id that isn’t Rollbar’s', async () => {
    const { db } = fakeDatabase();
    await expect(callerFor(db, null).create({ message: 'Rien ne marche ici.', path: '/fr' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(callerFor(db, client).create({ message: 'Bug', path: '/fr' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(callerFor(db, client).create({ message: 'Rien ne marche ici.', path: '/fr/reinitialiser?token=abc' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(callerFor(db, client).create({ message: 'Rien ne marche ici.', path: '/fr', rollbarIds: ['not-a-uuid'] })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('takes five reports an hour from one Account, then says to wait', async () => {
    const { db } = fakeDatabase(Array.from({ length: 5 }, () => ({})));
    await expect(callerFor(db, client).create({ message: 'Encore un problème.', path: '/fr' })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      message: 'REPORT_LIMIT',
    });
  });
});

describe('the Signalements list (#160)', () => {
  it('shows the consultant the open reports first, newest first, with who sent them', async () => {
    const hour = 60 * 60 * 1000;
    const { db } = fakeDatabase([
      { id: 'old_open', createdAt: new Date(Date.now() - 3 * hour), status: 'IN_PROGRESS' },
      { id: 'new_done', createdAt: new Date(Date.now() - hour), status: 'RESOLVED' },
      { id: 'new_open', createdAt: new Date(), status: 'NEW' },
    ]);
    const list = await callerFor(db, consultant).list({});
    expect(list.map((report) => report.id)).toEqual(['new_open', 'old_open', 'new_done']);
    expect(list[0]!.account).toMatchObject({ name: 'Aminata Diallo' });
    expect((await callerFor(db, consultant).list({ status: 'RESOLVED' })).map((report) => report.id)).toEqual(['new_done']);
  });

  it('lets the consultant flag a report, and no one else see or flag them', async () => {
    const { db, reports } = fakeDatabase([{ id: 'rep_a' }]);
    await callerFor(db, consultant).setStatus({ id: 'rep_a', status: 'IN_PROGRESS' });
    expect(reports[0]!.status).toBe('IN_PROGRESS');
    await expect(callerFor(db, consultant).setStatus({ id: 'missing', status: 'RESOLVED' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(callerFor(db, client).list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(callerFor(db, client).setStatus({ id: 'rep_a', status: 'IGNORED' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
