import { describe, expect, it, vi, beforeEach } from 'vitest';

import { STARTER_SERVICES } from '@/features/document-services/data/starter-services';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const mailer = vi.hoisted(() => ({ appMailer: { send: vi.fn() } }));
vi.mock('@/server/email/app-mailer', () => mailer);
vi.mock('@/features/notifications/server/notify', () => ({ notifyLater: vi.fn() }));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }));
const accept = vi.hoisted(() => ({
  acceptStanzyRequest: vi.fn(async () => ({ contract: { id: 'ctr_1', number: 'C-1' }, invoiceId: 'inv_1' })),
}));
vi.mock('@/features/accompagnement/server/stanzy-accept', () => accept);

beforeEach(() => vi.clearAllMocks());

type Row = Record<string, unknown> & { id: string };

const pof = STARTER_SERVICES.find((service) => service.slug === 'preuve-de-fonds')!;
const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';

/**
 * Seam: `documentServices.orders` through a server-side caller, over an
 * in-memory stand-in for the catalogue, the orders, the accounts and the
 * Dossiers they open; taking the request on is stubbed (its own tests).
 */
function fakeDatabase() {
  const services: Row[] = [{ ...pof, id: 'svc_pof', active: true, price: 500, shareToken: TOKEN }];
  const orders: Row[] = [];
  const accounts: Row[] = [
    { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr', role: 'MEMBER', status: 'USER' },
    { id: 'acc_stanzy', name: 'Stanzy', email: 'stanzy@example.com', locale: 'fr', role: 'CONSULTANT', status: 'USER' },
  ];
  const dossiers: Row[] = [];
  const documents: Row[] = [];
  const requests: Row[] = [];
  let seq = 0;
  const matches = (row: Row, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => row[key] === value);
  const db = {
    documentService: {
      findUnique: async ({ where }: { where: { id?: string; shareToken?: string } }) =>
        services.find((s) => (where.id ? s.id === where.id : s.shareToken === where.shareToken)) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(services.find((s) => s.id === where.id)!, data),
    },
    serviceOrder: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => [...orders].reverse().find((o) => matches(o, where)) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) => {
        const order = orders.find((o) => o.id === where.id);
        if (!order) return null;
        return {
          ...order,
          account: accounts.find((a) => a.id === order.accountId),
          service: services.find((s) => s.id === order.serviceId),
        };
      },
      findMany: async ({ where }: { where: { status: string } }) =>
        orders
          .filter((o) => o.status === where.status)
          .map((o) => ({ ...o, account: accounts.find((a) => a.id === o.accountId), service: services.find((s) => s.id === o.serviceId) })),
      create: async ({ data }: { data: Row }) => {
        const row = { status: 'SUBMITTED', createdAt: new Date(), dossierId: null, ...data, id: `ord_${++seq}` };
        orders.push(row);
        return { id: row.id };
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const found = orders.filter((o) => matches(o, where));
        for (const order of found) Object.assign(order, data);
        return { count: found.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(orders.find((o) => o.id === where.id)!, data),
    },
    account: {
      findMany: async ({ where }: { where: { role: string } }) => accounts.filter((a) => a.role === where.role),
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => accounts.find((a) => a.id === where.id)!,
      updateMany: async ({ where, data }: { where: { id: string; status: string }; data: Row }) => {
        const found = accounts.filter((a) => a.id === where.id && a.status === where.status);
        for (const account of found) Object.assign(account, data);
        return { count: found.length };
      },
    },
    dossier: {
      create: async ({ data }: { data: Row & { sections: { create: Row } } }) => {
        const { sections, ...rest } = data;
        delete rest.events;
        const row = { ...rest, id: `dos_${++seq}`, state: 'OPEN', sections: [{ ...sections.create, id: `sec_${++seq}` }] };
        dossiers.push(row);
        return { id: row.id, sections: row.sections };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const dossier = dossiers.find((d) => d.id === where.id);
        return dossier ? { ...dossier, account: accounts.find((a) => a.id === dossier.accountId) } : null;
      },
    },
    dossierDocument: {
      createMany: async ({ data }: { data: Row[] }) => {
        documents.push(...data);
        return { count: data.length };
      },
    },
    stanzyRequest: {
      create: async ({ data }: { data: Row }) => {
        const row = { ...data, id: `stz_${++seq}`, status: 'REQUESTED' };
        requests.push(row);
        return { id: row.id };
      },
    },
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn(db),
  };
  return { db: db as unknown as TRPCContext['prisma'], services, orders, accounts, dossiers, documents, requests };
}

const consultant = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' });
const client = sessionFor({ id: 'acc_1', name: 'Aminata Diallo' });
const callerFor = (db: TRPCContext['prisma'], session: CurrentSession | null) =>
  createCaller({ prisma: db, session, headers: new Headers() } as unknown as TRPCContext).documentServices.orders;

const order = { token: TOKEN, note: '7 000 000 FCFA', accepted: true as const };

describe('a service’s private link', () => {
  it('shows the service and its price to anyone with it, and nothing for an unknown or withdrawn one', async () => {
    const { db, services } = fakeDatabase();
    const offer = await callerFor(db, null).offer({ token: TOKEN });
    expect(offer).toMatchObject({ service: { slug: 'preuve-de-fonds', price: 500 }, order: null });
    expect(offer.service.prerequisites.map((item) => item.key)).toContain('signature');
    await expect(callerFor(db, null).offer({ token: 'z'.repeat(32) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    services[0]!.active = false;
    await expect(callerFor(db, null).offer({ token: TOKEN })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('is made once, and renewed on demand', async () => {
    const { db, services } = fakeDatabase();
    services[0]!.shareToken = null;
    const first = await callerFor(db, consultant).dashboard.shareLink({ id: 'svc_pof', renew: false });
    expect(first.url).toMatch(/\/fr\/services\/offre\/[A-Za-z0-9_-]{32}$/);
    expect(await callerFor(db, consultant).dashboard.shareLink({ id: 'svc_pof', renew: false })).toEqual(first);
    expect((await callerFor(db, consultant).dashboard.shareLink({ id: 'svc_pof', renew: true })).url).not.toBe(first.url);
    await expect(callerFor(db, client).dashboard.shareLink({ id: 'svc_pof', renew: false })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('ordering a service on its own', () => {
  it('takes one order at a time, and tells the consultant', async () => {
    const { db, orders } = fakeDatabase();
    await callerFor(db, client).order(order);
    expect(orders).toEqual([expect.objectContaining({ accountId: 'acc_1', serviceId: 'svc_pof', note: '7 000 000 FCFA', status: 'SUBMITTED' })]);
    expect(mailer.appMailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'stanzy@example.com' }));
    await expect(callerFor(db, client).order(order)).rejects.toMatchObject({ message: 'ORDER_PENDING' });
    expect((await callerFor(db, client).offer({ token: TOKEN })).order).toMatchObject({ status: 'SUBMITTED' });
    await expect(callerFor(db, null).order(order)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('approved, opens a Service documentaire Dossier with the service’s Documents and its request, and sends the contract', async () => {
    const { db, orders, accounts, dossiers, documents, requests } = fakeDatabase();
    const { id } = await callerFor(db, client).order(order);
    const approved = await callerFor(db, consultant).dashboard.approve({ id, locale: 'fr', amount: 350_000, schedule: '100 % à la signature' });
    expect(dossiers).toEqual([expect.objectContaining({ accountId: 'acc_1', service: 'SERVICE_DOCUMENTAIRE', stage: 'commande' })]);
    expect(documents.map((d) => d.kind)).toEqual(['bankLetter', 'bankStatements']);
    expect(requests).toEqual([expect.objectContaining({ documentId: documents[0]!.id, serviceId: 'svc_pof', requestedById: 'acc_1' })]);
    expect(orders[0]).toMatchObject({ status: 'APPROVED', dossierId: dossiers[0]!.id });
    expect(accounts[0]!.status).toBe('CLIENT');
    expect(accept.acceptStanzyRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: dossiers[0]!.id }),
      expect.objectContaining({ id: requests[0]!.id }),
      expect.objectContaining({ amount: 350_000, locale: 'fr' }),
    );
    expect(approved).toMatchObject({ dossierId: dossiers[0]!.id, invoiceId: 'inv_1' });
    await expect(
      callerFor(db, consultant).dashboard.approve({ id, locale: 'fr', amount: 1, schedule: 'x' }),
    ).rejects.toMatchObject({ message: 'ORDER_NOT_PENDING' });
  });

  it('turned down, tells the Client why, and they may order again', async () => {
    const { db, orders } = fakeDatabase();
    const { id } = await callerFor(db, client).order(order);
    await callerFor(db, consultant).dashboard.reject({ id, note: 'Pas encore extrait du bassin' });
    expect(orders[0]).toMatchObject({ status: 'REJECTED', rejectNote: 'Pas encore extrait du bassin' });
    expect(mailer.appMailer.send).toHaveBeenLastCalledWith(expect.objectContaining({ to: 'aminata@example.com' }));
    await expect(callerFor(db, client).order(order)).resolves.toMatchObject({ id: expect.any(String) });
  });
});
