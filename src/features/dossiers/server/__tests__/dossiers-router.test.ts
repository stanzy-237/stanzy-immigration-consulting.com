import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const notifyClient = vi.hoisted(() => vi.fn());
vi.mock('@/features/dossiers/server/dossier-notify', () => ({ notifyClient }));

/**
 * Seam: the `dossiers` tRPC router through a server-side caller, over an
 * in-memory stand-in for the account, dossier and dossier_event tables. The
 * Client emails are replaced by a spy.
 */
type AccountRow = {
  id: string;
  name: string;
  email: string;
  locale: string;
  role: 'MEMBER' | 'PARTNER' | 'CONSULTANT';
  status: 'USER' | 'LEAD' | 'CLIENT';
};
type DossierRow = {
  id: string;
  accountId: string;
  service: string;
  stage: string;
  startStage: string;
  state: 'OPEN' | 'CLOSED';
  closedAt: Date | null;
  closedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};
type EventRow = {
  id: string;
  dossierId: string;
  kind: string;
  fromStage: string | null;
  toStage: string;
  note: string | null;
  actorId: string;
  createdAt: Date;
};

function fakeDatabase(accounts: AccountRow[]) {
  const dossiers: DossierRow[] = [];
  const events: EventRow[] = [];
  let clock = Date.parse('2026-10-31T09:00:00Z');
  const tick = () => new Date((clock += 1000));
  const matches = (row: Record<string, unknown>, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([key, value]) => row[key] === value);

  const account = {
    async findUnique({ where }: { where: { id: string } }) {
      return accounts.find((a) => a.id === where.id) ?? null;
    },
    async findUniqueOrThrow({ where }: { where: { id: string } }) {
      const row = accounts.find((a) => a.id === where.id);
      if (!row) throw new Error('not found');
      return row;
    },
    async updateMany({ where, data }: { where: Partial<AccountRow>; data: Partial<AccountRow> }) {
      const hit = accounts.filter((a) => matches(a, where));
      for (const a of hit) Object.assign(a, data);
      return { count: hit.length };
    },
    async findMany({ where }: { where: { role: string; OR: { name?: { contains: string }; email?: { contains: string } }[] } }) {
      const q = (where.OR[0]!.name!.contains).toLowerCase();
      return accounts.filter(
        (a) => a.role === where.role && (a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)),
      );
    },
  };

  const withRelations = (d: DossierRow) => ({
    ...d,
    account: accounts.find((a) => a.id === d.accountId)!,
    events: events
      .filter((e) => e.dossierId === d.id)
      .map((e) => ({ ...e, actor: { name: accounts.find((a) => a.id === e.actorId)?.name ?? '' } })),
  });

  const dossier = {
    async create({ data }: { data: Omit<DossierRow, 'id' | 'state' | 'closedAt' | 'closedReason' | 'createdAt' | 'updatedAt'> & { events: { create: Omit<EventRow, 'id' | 'dossierId' | 'createdAt' | 'fromStage' | 'note'> } } }) {
      const { events: nested, ...columns } = data;
      const now = tick();
      const row: DossierRow = { ...columns, id: `dos_${dossiers.length + 1}`, state: 'OPEN', closedAt: null, closedReason: null, createdAt: now, updatedAt: now };
      dossiers.push(row);
      events.push({ ...nested.create, id: `ev_${events.length + 1}`, dossierId: row.id, fromStage: null, note: null, createdAt: now });
      return { id: row.id };
    },
    async findUnique({ where }: { where: { id: string } }) {
      const row = dossiers.find((d) => d.id === where.id);
      return row ? withRelations(row) : null;
    },
    async findMany({ where = {} }: { where?: Partial<DossierRow> }) {
      return dossiers.filter((d) => matches(d, where)).map(withRelations);
    },
    async updateMany({ where, data }: { where: Partial<DossierRow>; data: Partial<DossierRow> }) {
      const hit = dossiers.filter((d) => matches(d, where));
      for (const d of hit) Object.assign(d, data, { updatedAt: tick() });
      return { count: hit.length };
    },
  };

  const dossierEvent = {
    async create({ data }: { data: Omit<EventRow, 'id' | 'createdAt' | 'note'> & { note?: string } }) {
      events.push({ note: null, ...data, id: `ev_${events.length + 1}`, createdAt: tick() });
    },
  };

  const prisma = { account, dossier, dossierEvent } as Record<string, unknown>;
  prisma.$transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(prisma);
  return { prisma: prisma as unknown as TRPCContext['prisma'], accounts, dossiers, events };
}

const CONSULTANT: AccountRow = { id: 'acc_stanzy', name: 'Stanzy', email: 'stanzy@example.com', locale: 'fr', role: 'CONSULTANT', status: 'USER' };
const PARTNER: AccountRow = { id: 'acc_partner', name: 'Paul Partner', email: 'paul@example.com', locale: 'fr', role: 'PARTNER', status: 'USER' };
const aminata = (status: AccountRow['status'] = 'USER'): AccountRow => ({ id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr', role: 'MEMBER', status });

const asConsultant = sessionFor({ id: CONSULTANT.id, name: CONSULTANT.name, role: 'CONSULTANT' });
const asAminata = sessionFor();

function callerAs(db: ReturnType<typeof fakeDatabase>, session: CurrentSession | null) {
  return createCaller({ prisma: db.prisma, headers: new Headers(), session });
}

beforeEach(() => notifyClient.mockClear());

describe('opening a Dossier', () => {
  it('opens at the chosen stage, makes a User a Client and emails them', async () => {
    const db = fakeDatabase([CONSULTANT, aminata('USER')]);
    const { id } = await callerAs(db, asConsultant).dossiers.dashboard.open({
      accountId: 'acc_1',
      service: 'ACCOMPAGNEMENT',
      startStage: 'profil-ee',
    });

    expect(db.dossiers).toMatchObject([{ id, stage: 'profil-ee', startStage: 'profil-ee', state: 'OPEN' }]);
    expect(db.events).toMatchObject([{ kind: 'OPENED', toStage: 'profil-ee', actorId: CONSULTANT.id }]);
    expect(db.accounts.find((a) => a.id === 'acc_1')!.status).toBe('CLIENT');
    expect(notifyClient).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'aminata@example.com' }),
      'ACCOMPAGNEMENT',
      { kind: 'opened', stage: 'profil-ee' },
    );
  });

  it('keeps a Client a Client when they open a second Dossier', async () => {
    const db = fakeDatabase([CONSULTANT, aminata('CLIENT')]);
    await callerAs(db, asConsultant).dossiers.dashboard.open({ accountId: 'acc_1', service: 'EDE', startStage: 'verification' });
    expect(db.accounts.find((a) => a.id === 'acc_1')!.status).toBe('CLIENT');
  });

  it('refuses a stage of another service', async () => {
    const db = fakeDatabase([CONSULTANT, aminata()]);
    await expect(
      callerAs(db, asConsultant).dossiers.dashboard.open({ accountId: 'acc_1', service: 'EDE', startStage: 'copr' }),
    ).rejects.toMatchObject({ message: 'DOSSIER_INVALID_STAGE' });
    expect(db.dossiers).toHaveLength(0);
  });

  it('refuses a Partner', async () => {
    const db = fakeDatabase([CONSULTANT, PARTNER]);
    await expect(
      callerAs(db, asConsultant).dossiers.dashboard.open({ accountId: PARTNER.id, service: 'EDE', startStage: 'verification' }),
    ).rejects.toMatchObject({ message: 'DOSSIER_ACCOUNT_NOT_ELIGIBLE' });
  });

  it('is for the consultant only', async () => {
    const db = fakeDatabase([CONSULTANT, aminata()]);
    await expect(
      callerAs(db, asAminata).dossiers.dashboard.open({ accountId: 'acc_1', service: 'EDE', startStage: 'verification' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('moving a Dossier', () => {
  async function opened(startStage = 'verification') {
    const db = fakeDatabase([CONSULTANT, aminata()]);
    const caller = callerAs(db, asConsultant);
    const { id } = await caller.dossiers.dashboard.open({ accountId: 'acc_1', service: 'EDE', startStage });
    notifyClient.mockClear();
    return { db, caller, id };
  }

  it('advances one stage, records it and emails the Client', async () => {
    const { db, caller, id } = await opened();
    expect(await caller.dossiers.dashboard.advance({ id, from: 'verification' })).toEqual({ stage: 'compte' });
    expect(db.dossiers[0]!.stage).toBe('compte');
    expect(db.events.at(-1)).toMatchObject({ kind: 'ADVANCED', fromStage: 'verification', toStage: 'compte' });
    expect(notifyClient).toHaveBeenCalledWith(expect.anything(), 'EDE', { kind: 'stageChanged', stage: 'compte' });
  });

  it('refuses a move from a stage the Dossier has already left', async () => {
    const { caller, id } = await opened();
    await caller.dossiers.dashboard.advance({ id, from: 'verification' });
    await expect(caller.dossiers.dashboard.advance({ id, from: 'verification' })).rejects.toMatchObject({
      message: 'DOSSIER_STAGE_CHANGED',
    });
  });

  it('moves back, even before the stage it opened at', async () => {
    const { db, caller, id } = await opened('compte');
    await caller.dossiers.dashboard.moveBack({ id, from: 'compte' });
    expect(db.dossiers[0]!.stage).toBe('verification');
    await expect(caller.dossiers.dashboard.moveBack({ id, from: 'verification' })).rejects.toMatchObject({
      message: 'DOSSIER_FIRST_STAGE',
    });
  });

  it('stops at the last stage', async () => {
    const { caller, id } = await opened('rapport');
    await expect(caller.dossiers.dashboard.advance({ id, from: 'rapport' })).rejects.toMatchObject({
      message: 'DOSSIER_LAST_STAGE',
    });
  });

  it('closes with a reason, for good', async () => {
    const { db, caller, id } = await opened();
    await caller.dossiers.dashboard.close({ id, reason: 'Le Client a abandonné.' });
    expect(db.dossiers[0]).toMatchObject({ state: 'CLOSED', closedReason: 'Le Client a abandonné.' });
    expect(notifyClient).toHaveBeenCalledWith(expect.anything(), 'EDE', { kind: 'closed', reason: 'Le Client a abandonné.' });
    await expect(caller.dossiers.dashboard.advance({ id, from: 'verification' })).rejects.toMatchObject({
      message: 'DOSSIER_CLOSED',
    });
    await expect(caller.dossiers.dashboard.close({ id, reason: 'Encore' })).rejects.toMatchObject({
      message: 'DOSSIER_CLOSED',
    });
  });
});

describe('« Mon espace »', () => {
  it('lists only the signed-in Account’s own Dossiers', async () => {
    const db = fakeDatabase([CONSULTANT, aminata(), { ...aminata(), id: 'acc_2', email: 'other@example.com' }]);
    const consultant = callerAs(db, asConsultant);
    await consultant.dossiers.dashboard.open({ accountId: 'acc_1', service: 'EDE', startStage: 'verification' });
    await consultant.dossiers.dashboard.open({ accountId: 'acc_2', service: 'VERIFICATION', startStage: 'evaluation' });

    const mine = await callerAs(db, asAminata).dossiers.mine();
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ service: 'EDE', stage: 'verification' });
  });

  it('needs a session', async () => {
    const db = fakeDatabase([]);
    await expect(callerAs(db, null).dossiers.mine()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
