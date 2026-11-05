import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { STARTER_SERVICES } from '@/features/document-services/data/starter-services';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

type Row = Record<string, unknown> & { id: string };

/**
 * Seam: `documentServices` through a server-side caller, over an in-memory
 * stand-in for the catalogue, the Demandes (where they live) and one
 * Dossier's Documents.
 */
function fakeDatabase(residence: 'CM' | 'CA' = 'CM') {
  const services: Row[] = [];
  const interests = [{ accountId: 'acc_1', residence }];
  const documents: Row[] = [
    { id: 'doc_police', title: 'Certificat de police', kind: 'policeCertificate', finalVersionId: null, dossierId: 'dos_1', open: [] },
    { id: 'doc_final', title: 'Passeport', kind: 'passport', finalVersionId: 'ver_1', dossierId: 'dos_1', open: [] },
  ];
  const dossiers = [{ id: 'dos_1', accountId: 'acc_1', state: 'OPEN' }];
  let seq = 0;
  const pick = (row: Row) => row;
  const db = {
    documentService: {
      findMany: async ({ where }: { where?: { active?: boolean } } = {}) =>
        services
          .filter((s) => where?.active === undefined || s.active === where.active)
          .sort((a, b) => (a.position as number) - (b.position as number))
          .map((s) => ({ ...s, _count: { requests: 0 } })),
      findFirst: async ({ where }: { where?: { slug?: string; active?: boolean } } = {}) => {
        if (!where?.slug) return [...services].sort((a, b) => (b.position as number) - (a.position as number))[0] ?? null;
        return services.find((s) => s.slug === where.slug && (where.active === undefined || s.active === where.active)) ?? null;
      },
      findUnique: async ({ where }: { where: { id: string } }) => services.find((s) => s.id === where.id) ?? null,
      create: async ({ data }: { data: Row }) => {
        if (services.some((s) => s.slug === data.slug)) {
          throw new Prisma.PrismaClientKnownRequestError('taken', { code: 'P2002', clientVersion: 'test' });
        }
        const row = { ...data, id: `svc_${++seq}` };
        services.push(row);
        return { id: row.id };
      },
      createMany: async ({ data }: { data: Row[] }) => {
        for (const row of data) services.push({ ...row, id: `svc_${++seq}` });
        return { count: data.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = services.find((s) => s.id === where.id);
        if (!row) throw new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: 'test' });
        Object.assign(row, data);
        return { id: row.id };
      },
    },
    interestRequest: {
      findFirst: async ({ where }: { where: { accountId: string } }) => interests.find((i) => i.accountId === where.accountId) ?? null,
    },
    dossierDocument: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const document = documents.find((d) => d.id === where.id);
        if (!document) return null;
        const dossier = dossiers.find((d) => d.id === document.dossierId)!;
        return { ...pick(document), section: { dossier }, stanzyRequests: document.open };
      },
    },
  };
  return { db: db as unknown as TRPCContext['prisma'], services, documents };
}

const consultant = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' });
const client = sessionFor({ id: 'acc_1', name: 'Aminata Diallo' });
const callerFor = (db: TRPCContext['prisma'], session: CurrentSession) =>
  createCaller({ prisma: db, session, headers: new Headers() } as unknown as TRPCContext).documentServices;

const police = { ...STARTER_SERVICES.find((s) => s.slug === 'certificat-de-police')!, active: true, price: 30_000 };

describe('the catalogue, in the Tableau de bord', () => {
  it('adds the starting services once, inactive and unpriced', async () => {
    const { db, services } = fakeDatabase();
    expect(await callerFor(db, consultant).dashboard.addStarters()).toEqual({ added: STARTER_SERVICES.length });
    expect(services.every((s) => s.active === false && s.price === 0)).toBe(true);
    expect(await callerFor(db, consultant).dashboard.addStarters()).toEqual({ added: 0 });
  });

  it('adds a service at the end and refuses an address already taken', async () => {
    const { db, services } = fakeDatabase();
    await callerFor(db, consultant).dashboard.save({ id: null, service: police });
    expect(services[0]).toMatchObject({ slug: 'certificat-de-police', position: 1, price: 30_000 });
    await expect(callerFor(db, consultant).dashboard.save({ id: null, service: police })).rejects.toMatchObject({
      message: 'SERVICE_SLUG_TAKEN',
    });
  });

  it('is the consultant’s alone', async () => {
    const { db } = fakeDatabase();
    await expect(callerFor(db, client).dashboard.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(callerFor(db, client).dashboard.save({ id: null, service: police })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('the catalogue, in « Mon espace »', () => {
  async function withServices(residence: 'CM' | 'CA' = 'CM') {
    const setup = fakeDatabase(residence);
    await callerFor(setup.db, consultant).dashboard.save({ id: null, service: police });
    await callerFor(setup.db, consultant).dashboard.save({ id: null, service: { ...police, slug: 'brouillon', active: false } });
    return setup;
  }

  it('shows a Client in Cameroon the active services with their prices', async () => {
    const { db } = await withServices();
    const { available, services } = await callerFor(db, client).list();
    expect(available).toBe(true);
    expect(services.map((s) => [s.slug, s.price])).toEqual([['certificat-de-police', 30_000]]);
  });

  it('shows nothing, prices included, to anyone living elsewhere', async () => {
    const { db } = await withServices('CA');
    expect(await callerFor(db, client).list()).toEqual({ available: false, services: [] });
    expect(await callerFor(db, client).get({ slug: 'certificat-de-police', documentId: null })).toEqual({
      available: false,
      service: null,
      document: null,
    });
  });

  it('gives a service’s page with the Document Stanzy could get, if it still can', async () => {
    const { db } = await withServices();
    const page = await callerFor(db, client).get({ slug: 'certificat-de-police', documentId: 'doc_police' });
    expect(page.service).toMatchObject({ slug: 'certificat-de-police', price: 30_000 });
    expect(page.document).toEqual({ id: 'doc_police', title: 'Certificat de police', kind: 'policeCertificate', dossierId: 'dos_1' });
    expect((await callerFor(db, client).get({ slug: 'certificat-de-police', documentId: 'doc_final' })).document).toBeNull();
    await expect(callerFor(db, client).get({ slug: 'brouillon', documentId: null })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
