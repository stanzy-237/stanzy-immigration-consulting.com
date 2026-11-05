import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_CHECKLIST_FORM } from '@/features/checklist/lib/checklist-form';
import { AREAS, DEFAULT_PROGRESS, type InterestAnswers } from '@/features/accompagnement/lib/interest-schema';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const mailer = vi.hoisted(() => ({ appMailer: { send: vi.fn() } }));
vi.mock('@/server/email/app-mailer', () => mailer);
const notifications = vi.hoisted(() => ({ notifyLater: vi.fn(), forgetComment: vi.fn(), notify: vi.fn() }));
vi.mock('@/features/notifications/server/notify', () => notifications);
vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }));

beforeEach(() => vi.clearAllMocks());

type Row = Record<string, unknown> & { id: string };

/**
 * Seam: `accompagnement` through a server-side caller, over an in-memory
 * stand-in for the account, Demande, Dossier, Document and Stanzy request
 * tables. The emails and Notifications are stubbed; the Niveau, the plan
 * from the Checklist and the access rules run for real.
 */
function fakeDatabase() {
  const accounts: Row[] = [
    { id: 'acc_stanzy', name: 'Stanzy', email: 'stanzy@example.com', locale: 'fr', role: 'CONSULTANT', status: 'USER' },
    { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr', role: 'MEMBER', status: 'USER' },
    { id: 'acc_2', name: 'Bob Other', email: 'bob@example.com', locale: 'fr', role: 'MEMBER', status: 'USER' },
  ];
  const interests: Row[] = [];
  const dossiers: Row[] = [];
  const sections: Row[] = [];
  const documents: Row[] = [];
  const stanzy: Row[] = [];
  let seq = 0;
  let clock = Date.parse('2026-11-04T09:00:00Z');
  const account = (id: unknown) => accounts.find((a) => a.id === id)!;
  const dossierRow = (id: unknown) => {
    const dossier = dossiers.find((d) => d.id === id);
    return dossier ? { ...dossier, account: account(dossier.accountId) } : null;
  };

  const db = {
    account: {
      findMany: async ({ where }: { where: { role: string } }) => accounts.filter((a) => a.role === where.role),
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => account(where.id),
      updateMany: async ({ where, data }: { where: { id: string; status: string }; data: Row }) => {
        const row = accounts.find((a) => a.id === where.id && a.status === where.status);
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      },
    },
    interestRequest: {
      findFirst: async ({ where }: { where: Row }) =>
        [...interests]
          .reverse()
          .find((i) => i.accountId === where.accountId && (!where.status || i.status === where.status)) ?? null,
      findMany: async ({ where }: { where: Row }) =>
        interests
          .filter((i) => (where.status ? i.status === where.status : true))
          .filter((i) => (where.accountId ? i.accountId === where.accountId && i.id !== (where.id as unknown as { not: string }).not : true))
          .map((i) => ({ ...i, account: account(i.accountId) })),
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = interests.find((i) => i.id === where.id);
        return row ? { ...row, account: account(row.accountId), decidedBy: null } : null;
      },
      create: async ({ data }: { data: Row }) => {
        const row = { status: 'SUBMITTED', levelOverride: null, dossierId: null, ...data, id: `int_${++seq}`, createdAt: new Date((clock += 1000)) };
        interests.push(row);
        return { id: row.id };
      },
      updateMany: async ({ where, data }: { where: { id: string; status: string }; data: Row }) => {
        const row = interests.find((i) => i.id === where.id && i.status === where.status);
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        Object.assign(interests.find((i) => i.id === where.id)!, data);
      },
    },
    dossier: {
      findFirst: async ({ where }: { where: Row }) =>
        dossiers.find((d) => d.accountId === where.accountId && d.service === where.service && d.state === where.state) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) => dossierRow(where.id),
      create: async ({ data }: { data: Row }) => {
        const id = `dos_${++seq}`;
        const { events: _events, ...rest } = data;
        dossiers.push({ ...rest, id, state: 'OPEN' });
        return { id };
      },
    },
    dossierSection: {
      createMany: async ({ data }: { data: Row[] }) => {
        sections.push(...data);
        return { count: data.length };
      },
    },
    dossierDocument: {
      createMany: async ({ data }: { data: Row[] }) => {
        for (const row of data) {
          const section = sections.find((sec) => sec.id === row.sectionId)!;
          documents.push({ ...row, sectionTitle: section.title, dossierId: section.dossierId });
        }
        return { count: data.length };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const document = documents.find((d) => d.id === where.id);
        if (!document) return null;
        return {
          ...document,
          section: { dossierId: document.dossierId },
          _count: { versions: (document.versions as number | undefined) ?? 0 },
          stanzyRequests: stanzy.filter((s) => s.documentId === document.id && s.status !== 'DECLINED'),
        };
      },
    },
    stanzyRequest: {
      createMany: async ({ data }: { data: Row[] }) => {
        for (const row of data) stanzy.push({ ...row, id: `stz_${++seq}`, status: 'REQUESTED' });
        return { count: data.length };
      },
      create: async ({ data }: { data: Row }) => {
        const row = { ...data, id: `stz_${++seq}`, status: 'REQUESTED' };
        stanzy.push(row);
        return { id: row.id };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = stanzy.find((s) => s.id === where.id);
        if (!row) return null;
        const document = documents.find((d) => d.id === row.documentId)!;
        return { ...row, document: { ...document, section: { dossierId: document.dossierId } } };
      },
      updateMany: async ({ where, data }: { where: { id: string; status: string }; data: Row }) => {
        const row = stanzy.find((s) => s.id === where.id && s.status === where.status);
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      },
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db: db as unknown as TRPCContext['prisma'], accounts, interests, dossiers, documents, stanzy };
}

const consultant = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' });
const user = (id = 'acc_1', name = 'Aminata Diallo') => sessionFor({ id, name, status: 'USER' });
const callerFor = (db: TRPCContext['prisma'], session: CurrentSession) =>
  createCaller({ prisma: db, session, headers: new Headers() } as unknown as TRPCContext);

const areas = Object.fromEntries(AREAS.map((area) => [area, { answer: 'have', note: '' }])) as InterestAnswers['areas'];
const answers = (extra: Partial<InterestAnswers> = {}): InterestAnswers => ({
  checklist: { ...DEFAULT_CHECKLIST_FORM, jobs: [{ title: 'Comptable', inCanada: false, selfEmployed: false }], countries: ['Cameroun'] },
  progress: { ...DEFAULT_PROGRESS, citizenship: 'Camerounaise', languageTest: 'tcf', ede: true },
  areas,
  ...extra,
});

describe('the Demande d’intérêt', () => {
  it('makes the User a Lead, works out the Niveau and tells the consultant', async () => {
    const { db, accounts, interests } = fakeDatabase();
    const { id } = await callerFor(db, user()).accompagnement.submit(answers());
    expect(interests[0]).toMatchObject({ id, status: 'SUBMITTED', level: 'B', residence: 'CM' });
    expect(accounts[1]).toMatchObject({ status: 'LEAD' });
    expect(mailer.appMailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'stanzy@example.com', subject: 'Nouvelle demande d’intérêt : Aminata Diallo' }),
    );
    expect(notifications.notifyLater).toHaveBeenCalledWith(db, {
      kind: 'INTEREST_SUBMITTED',
      actorId: 'acc_1',
      recipients: 'CONSULTANTS',
      target: {},
      params: { interestId: id, client: 'Aminata Diallo', level: 'B' },
    });
    expect((await callerFor(db, user()).accompagnement.mine()).latest).toMatchObject({ id, status: 'SUBMITTED' });
  });

  it('waits for one Demande at a time', async () => {
    const { db } = fakeDatabase();
    await callerFor(db, user()).accompagnement.submit(answers());
    await expect(callerFor(db, user()).accompagnement.submit(answers())).rejects.toMatchObject({ message: 'INTEREST_PENDING' });
  });

  it('opens the Dossier at the Niveau chosen, its Documents from the Checklist, the Client told', async () => {
    const { db, accounts, interests, dossiers, documents, stanzy } = fakeDatabase();
    const { id } = await callerFor(db, user()).accompagnement.submit(
      answers({ areas: { ...areas, funds: { answer: 'stanzy', note: 'Relevé de 4 mois' } } }),
    );
    vi.clearAllMocks();

    const dossier = await callerFor(db, consultant).accompagnement.dashboard.approve({ id, level: 'C' });
    expect(dossiers[0]).toMatchObject({ id: dossier.id, accountId: 'acc_1', service: 'ACCOMPAGNEMENT', stage: 'bassin', startStage: 'bassin' });
    expect(interests[0]).toMatchObject({ status: 'APPROVED', levelOverride: 'C', dossierId: dossier.id, decidedById: 'acc_stanzy' });
    expect(accounts[1]).toMatchObject({ status: 'CLIENT' });

    const bankLetter = documents.find((d) => d.kind === 'bankLetter')!;
    expect(bankLetter).toMatchObject({ need: 'mandatory', missing: true, clientNote: 'Relevé de 4 mois', addedById: 'acc_stanzy' });
    expect(documents.find((d) => d.kind === 'passport')).toMatchObject({ missing: false, clientNote: null });
    expect(stanzy).toEqual([expect.objectContaining({ documentId: bankLetter.id, requestedById: 'acc_1', status: 'REQUESTED' })]);

    expect(mailer.appMailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'aminata@example.com',
        subject: 'Votre demande d’accompagnement est acceptée',
        text: expect.stringContaining('« Dans le bassin »'),
      }),
    );
    expect(notifications.notifyLater).toHaveBeenCalledWith(db, expect.objectContaining({ kind: 'DOSSIER_OPENED', recipients: ['acc_1'] }));

    await expect(callerFor(db, consultant).accompagnement.dashboard.approve({ id, level: 'C' })).rejects.toMatchObject({
      message: 'INTEREST_NOT_PENDING',
    });
    // An Accompagnement under way: no new Demande.
    await expect(callerFor(db, user()).accompagnement.submit(answers())).rejects.toMatchObject({
      message: 'INTEREST_ALREADY_CLIENT',
    });
  });

  it('rejects with a reason; the User may send another', async () => {
    const { db, interests } = fakeDatabase();
    const { id } = await callerFor(db, user()).accompagnement.submit(answers());
    await callerFor(db, consultant).accompagnement.dashboard.reject({ id, reason: 'Profil trop jeune' });
    expect(interests[0]).toMatchObject({ status: 'REJECTED', rejectReason: 'Profil trop jeune' });
    expect(mailer.appMailer.send).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: 'aminata@example.com', text: expect.stringContaining('Motif : Profil trop jeune') }),
    );
    await expect(callerFor(db, user()).accompagnement.submit(answers())).resolves.toEqual({ id: expect.any(String) });
  });

  it('is decided by the consultant only', async () => {
    const { db } = fakeDatabase();
    const { id } = await callerFor(db, user()).accompagnement.submit(answers());
    await expect(callerFor(db, user()).accompagnement.dashboard.approve({ id, level: 'A' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('« Stanzy s’en charge »', () => {
  async function approved(residence: 'CM' | 'CA' = 'CM') {
    const setup = fakeDatabase();
    const { id } = await callerFor(setup.db, user()).accompagnement.submit(
      answers({
        progress: { ...answers().progress, residence },
        areas: { ...areas, police: { answer: 'missing', note: '' } },
      }),
    );
    await callerFor(setup.db, consultant).accompagnement.dashboard.approve({ id, level: 'B' });
    vi.clearAllMocks();
    return setup;
  }

  it('lets the Client in Cameroon ask for a missing Document, once, and tells the consultant', async () => {
    const { db, documents, stanzy } = await approved();
    const police = documents.find((d) => d.kind === 'policeCertificate')!;
    await callerFor(db, user()).accompagnement.stanzy.request({ documentId: police.id });
    expect(stanzy).toEqual([expect.objectContaining({ documentId: police.id, status: 'REQUESTED' })]);
    expect(notifications.notifyLater).toHaveBeenCalledWith(db, expect.objectContaining({ kind: 'STANZY_REQUESTED', recipients: 'CONSULTANTS' }));
    await expect(callerFor(db, user()).accompagnement.stanzy.request({ documentId: police.id })).rejects.toMatchObject({
      message: 'STANZY_ALREADY_ASKED',
    });

    const passport = documents.find((d) => d.kind === 'passport')!;
    await expect(callerFor(db, user()).accompagnement.stanzy.request({ documentId: passport.id })).rejects.toMatchObject({
      message: 'STANZY_NOT_MISSING',
    });
  });

  it('is for Cameroon only, and for the Client only', async () => {
    const { db, documents } = await approved('CA');
    const police = documents.find((d) => d.kind === 'policeCertificate')!;
    await expect(callerFor(db, user()).accompagnement.stanzy.request({ documentId: police.id })).rejects.toMatchObject({
      message: 'STANZY_CAMEROON_ONLY',
    });
    await expect(callerFor(db, consultant).accompagnement.stanzy.request({ documentId: police.id })).rejects.toMatchObject({
      message: 'STANZY_CLIENT_ONLY',
    });
    await expect(
      callerFor(db, user('acc_2', 'Bob Other')).accompagnement.stanzy.request({ documentId: police.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lets the consultant decline with a note; the Client is told and may ask again', async () => {
    const { db, documents, stanzy } = await approved();
    const police = documents.find((d) => d.kind === 'policeCertificate')!;
    const { id } = await callerFor(db, user()).accompagnement.stanzy.request({ documentId: police.id });
    await callerFor(db, consultant).accompagnement.stanzy.decline({ id, note: 'À demander au commissariat' });
    expect(stanzy[0]).toMatchObject({ status: 'DECLINED', declineNote: 'À demander au commissariat' });
    expect(mailer.appMailer.send).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: 'aminata@example.com', text: expect.stringContaining('À demander au commissariat') }),
    );
    await expect(callerFor(db, consultant).accompagnement.stanzy.decline({ id, note: '' })).rejects.toMatchObject({
      message: 'STANZY_NOT_PENDING',
    });
  });
});
