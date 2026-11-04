import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { doualaDay, READ_KEPT_MS, runDailyJobs } from '@/features/notifications/server/daily-jobs';
import type { TRPCContext } from '@/server/trpc/context';

/**
 * Seam: the daily round over an in-memory stand-in for the invoice, account,
 * notification and cron_run tables, with the clock and the mailer passed in.
 */
type Row = Record<string, unknown> & { id: string };

const client = { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr' };
const dossier = { id: 'dos_1', service: 'ACCOMPAGNEMENT', account: client };

function fakeDatabase(invoices: Row[], accounts: Row[] = []) {
  const notifications: Row[] = [];
  const runs = new Set<string>();
  let seq = 0;
  const people: Row[] = [
    { id: 'acc_stanzy', role: 'CONSULTANT', createdAt: new Date('2020-01-01') },
    { ...client, role: 'MEMBER', createdAt: new Date('2025-01-01') },
    ...accounts,
  ];
  const prisma = {
    invoice: {
      async findMany() {
        return invoices
          .filter((i) => i.status === 'SENT' && i.dueDate && !i.overdueRemindedAt)
          .map((i) => ({ ...i, lines: [{ quantity: 1, unitAmount: 90000 }], dossier }));
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        Object.assign(
          invoices.find((i) => i.id === where.id)!,
          data,
        );
      },
    },
    account: {
      async findMany({ where }: { where: { role: string } }) {
        return people.filter((p) => p.role === where.role);
      },
      async count({ where }: { where: { role: string; createdAt: { gte: Date; lt: Date } } }) {
        return people.filter(
          (p) =>
            p.role === where.role &&
            (p.createdAt as Date) >= where.createdAt.gte &&
            (p.createdAt as Date) < where.createdAt.lt,
        ).length;
      },
    },
    notification: {
      async findFirst() {
        return null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const row = { readAt: null, ...data, id: `n_${++seq}` };
        notifications.push(row);
        return row;
      },
      async deleteMany({ where }: { where: { readAt: { lt: Date } } }) {
        const old = notifications.filter((n) => n.readAt && (n.readAt as Date) < where.readAt.lt);
        for (const n of old) notifications.splice(notifications.indexOf(n), 1);
        return { count: old.length };
      },
    },
    pdfToolFile: {
      async findMany() {
        return [];
      },
    },
    meetingRecording: {
      async findMany() {
        return [];
      },
    },
    cronRun: {
      async create({ data }: { data: { job: string; day: string } }) {
        const key = `${data.job}/${data.day}`;
        if (runs.has(key)) {
          throw new Prisma.PrismaClientKnownRequestError('taken', { code: 'P2002', clientVersion: 'test' });
        }
        runs.add(key);
      },
    },
  };
  return { prisma: prisma as unknown as TRPCContext['prisma'], notifications, invoices };
}

// 07:15 in Douala on 3 November 2026.
const NOW = new Date('2026-11-03T06:15:00Z');
const invoice = (id: string, dueDate: string, extra: Record<string, unknown> = {}): Row => ({
  id,
  number: `STZ-2026-000${id.slice(-1)}`,
  currency: 'XAF',
  status: 'SENT',
  dueDate: new Date(`${dueDate}T00:00:00Z`),
  dueSoonRemindedAt: null,
  overdueRemindedAt: null,
  ...extra,
});

const run = (db: ReturnType<typeof fakeDatabase>, mailer = { send: vi.fn() }, now = NOW) =>
  runDailyJobs({ db: db.prisma, mailer, siteUrl: 'https://stanzy.test', now });

describe('Facture reminders', () => {
  it('reminds the Client 3 days before the due date, once', async () => {
    const db = fakeDatabase([invoice('inv_1', '2026-11-06'), invoice('inv_2', '2026-11-07')]);
    const mailer = { send: vi.fn() };
    expect(await run(db, mailer)).toMatchObject({ dueSoon: 1, overdue: 0 });
    expect(db.notifications).toEqual([
      expect.objectContaining({ kind: 'INVOICE_DUE_SOON', recipientId: 'acc_1', invoiceId: 'inv_1', actorId: null }),
    ]);
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'aminata@example.com',
        subject: 'Rappel : facture STZ-2026-0001 à régler avant le 6 novembre 2026',
      }),
    );

    expect(await run(db)).toMatchObject({ dueSoon: 0 });
    expect(db.notifications).toHaveLength(1);
  });

  it('on the day after the due date, tells the Client and the consultant, once', async () => {
    const db = fakeDatabase([invoice('inv_1', '2026-11-02', { dueSoonRemindedAt: new Date('2026-10-30') })]);
    expect(await run(db)).toMatchObject({ overdue: 1 });
    expect(db.notifications.map((n) => [n.kind, n.recipientId])).toEqual([
      ['INVOICE_OVERDUE', 'acc_1'],
      ['INVOICE_LATE', 'acc_stanzy'],
    ]);
    expect(db.notifications[1]).toMatchObject({ params: { client: 'Aminata Diallo' } });
    expect(await run(db)).toMatchObject({ overdue: 0 });
  });

  it('leaves a Facture with a proof, paid or cancelled, and one due later', async () => {
    const db = fakeDatabase([
      invoice('inv_1', '2026-11-02', { status: 'PROOF_RECEIVED' }),
      invoice('inv_2', '2026-11-02', { status: 'PAID' }),
      invoice('inv_3', '2026-11-02', { status: 'CANCELLED' }),
      invoice('inv_4', '2026-11-20'),
    ]);
    expect(await run(db)).toMatchObject({ dueSoon: 0, overdue: 0 });
    expect(db.notifications).toEqual([]);
  });

  it('keeps going when an email fails', async () => {
    const db = fakeDatabase([invoice('inv_1', '2026-11-06')]);
    const mailer = { send: vi.fn().mockRejectedValue(new Error('Resend down')) };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await run(db, mailer)).toMatchObject({ dueSoon: 1 });
  });
});

describe('the sign-ups summary', () => {
  it('counts yesterday’s new members (Douala time), once a day', async () => {
    const db = fakeDatabase(
      [],
      [
        { id: 'a', role: 'MEMBER', createdAt: new Date('2026-11-01T23:30:00Z') }, // 2 Nov 00:30 in Douala
        { id: 'b', role: 'MEMBER', createdAt: new Date('2026-11-02T18:00:00Z') },
        { id: 'c', role: 'MEMBER', createdAt: new Date('2026-11-02T23:30:00Z') }, // 3 Nov in Douala
        { id: 'd', role: 'PARTNER', createdAt: new Date('2026-11-02T10:00:00Z') }, // not a member: not counted
      ],
    );
    expect(await run(db)).toMatchObject({ signups: 2 });
    expect(db.notifications).toEqual([
      expect.objectContaining({
        kind: 'ACCOUNTS_SIGNED_UP',
        recipientId: 'acc_stanzy',
        params: { count: '2', day: '2026-11-02' },
      }),
    ]);
    expect(await run(db)).toMatchObject({ signups: null });
    expect(db.notifications).toHaveLength(1);
  });
});

describe('the clean-up', () => {
  it('deletes read notifications older than 6 months, never unread ones', async () => {
    const db = fakeDatabase([]);
    const old = new Date(NOW.getTime() - READ_KEPT_MS - 1000);
    db.notifications.push(
      { id: 'old-read', readAt: old },
      { id: 'recent-read', readAt: new Date(NOW.getTime() - 1000) },
      { id: 'old-unread', readAt: null, updatedAt: old },
    );
    expect(await run(db)).toMatchObject({ deleted: 1 });
    expect(db.notifications.map((n) => n.id)).toEqual(['recent-read', 'old-unread']);
  });
});

describe('days in Douala', () => {
  it('turns at midnight Douala time, an hour before UTC', () => {
    expect(doualaDay(new Date('2026-11-02T22:59:00Z'))).toBe('2026-11-02');
    expect(doualaDay(new Date('2026-11-02T23:01:00Z'))).toBe('2026-11-03');
  });
});
