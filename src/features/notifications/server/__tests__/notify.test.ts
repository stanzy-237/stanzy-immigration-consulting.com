import { describe, expect, it } from 'vitest';

import { GROUP_WINDOW_MS, notify, type NotificationEvent } from '@/features/notifications/server/notify';
import type { TRPCContext } from '@/server/trpc/context';

/**
 * Seam: `notify` over an in-memory stand-in for the account and notification
 * tables, with the clock passed in.
 */
type Row = Record<string, unknown> & { id: string };

function fakeDatabase() {
  const accounts = [
    { id: 'acc_stanzy', role: 'CONSULTANT' },
    { id: 'acc_assistant', role: 'CONSULTANT' },
    { id: 'acc_1', role: 'MEMBER' },
  ];
  const rows: Row[] = [];
  let seq = 0;
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, condition]) => {
      const value = row[key];
      if (condition && typeof condition === 'object' && 'gte' in condition) {
        return value instanceof Date && value >= (condition as { gte: Date }).gte;
      }
      return value === condition;
    });
  const prisma = {
    account: {
      async findMany({ where }: { where: { role: string } }) {
        return accounts.filter((a) => a.role === where.role);
      },
    },
    notification: {
      async findFirst({ where }: { where: Record<string, unknown> }) {
        return rows.filter((row) => matches(row, where)).at(-1) ?? null;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown> & { count: { increment: number } };
      }) {
        const row = rows.find((r) => r.id === where.id)!;
        const { count, ...rest } = data;
        Object.assign(row, rest, { count: (row.count as number) + count.increment });
      },
      async create({ data }: { data: Record<string, unknown> }) {
        rows.push({ readAt: null, count: 1, documentId: undefined, dossierId: undefined, ...data, id: `n_${++seq}` });
      },
    },
  };
  return { prisma: prisma as unknown as TRPCContext['prisma'], rows };
}

const at = (minutes: number) => new Date(Date.parse('2026-11-03T09:00:00Z') + minutes * 60_000);
const message = (commentId: string, documentId = 'doc_1'): NotificationEvent => ({
  kind: 'MESSAGE_POSTED',
  actorId: 'acc_1',
  recipients: 'CONSULTANTS',
  target: { dossierId: 'dos_1', documentId, commentId },
});

describe('who is notified', () => {
  it('reaches every consultant for a Client’s action, never the actor', async () => {
    const db = fakeDatabase();
    await notify(db.prisma, message('c1'), at(0));
    expect(db.rows.map((r) => r.recipientId)).toEqual(['acc_stanzy', 'acc_assistant']);

    await notify(db.prisma, { ...message('c2'), actorId: 'acc_stanzy', recipients: ['acc_stanzy', 'acc_1'] }, at(1));
    expect(db.rows.filter((r) => r.recipientId === 'acc_stanzy')).toHaveLength(1);
  });
});

describe('grouping repeats', () => {
  it('raises the count of the unread one on the same Document, pointing at the latest message', async () => {
    const db = fakeDatabase();
    await notify(db.prisma, { ...message('c1'), recipients: ['acc_stanzy'] }, at(0));
    await notify(db.prisma, { ...message('c2'), recipients: ['acc_stanzy'] }, at(10));
    await notify(db.prisma, { ...message('c3'), recipients: ['acc_stanzy'] }, at(25));
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ count: 3, commentId: 'c3', updatedAt: at(25) });
  });

  it('starts a new one once read, after 30 minutes, or on another Document', async () => {
    const db = fakeDatabase();
    const to = (event: NotificationEvent) => ({ ...event, recipients: ['acc_stanzy'] });
    await notify(db.prisma, to(message('c1')), at(0));
    db.rows[0]!.readAt = at(1);
    await notify(db.prisma, to(message('c2')), at(2));
    await notify(db.prisma, to(message('c3')), at(2 + GROUP_WINDOW_MS / 60_000 + 1));
    await notify(db.prisma, to(message('c4', 'doc_2')), at(40));
    expect(db.rows).toHaveLength(4);
  });

  it('groups added Documents by Dossier', async () => {
    const db = fakeDatabase();
    const added = (documentId: string): NotificationEvent => ({
      kind: 'DOCUMENT_ADDED',
      actorId: 'acc_1',
      recipients: ['acc_stanzy'],
      target: { dossierId: 'dos_1', documentId },
    });
    await notify(db.prisma, added('doc_1'), at(0));
    await notify(db.prisma, added('doc_2'), at(1));
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ count: 2, documentId: 'doc_2' });
  });

  it('never groups stage changes', async () => {
    const db = fakeDatabase();
    const stage = (to: string): NotificationEvent => ({
      kind: 'DOSSIER_STAGE_CHANGED',
      actorId: 'acc_stanzy',
      recipients: ['acc_1'],
      target: { dossierId: 'dos_1' },
      params: { stage: to },
    });
    await notify(db.prisma, stage('ita'), at(0));
    await notify(db.prisma, stage('depot'), at(1));
    expect(db.rows.map((r) => r.params)).toEqual([{ stage: 'ita' }, { stage: 'depot' }]);
  });
});
