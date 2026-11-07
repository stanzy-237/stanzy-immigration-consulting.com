import { describe, expect, it } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

type Row = Record<string, unknown>;

/** Seam: `clientForms` through a server-side caller, over one Dossier's Documents and their forms. */
function fakeDatabase(state: 'OPEN' | 'CLOSED' = 'OPEN') {
  const dossier = {
    id: 'dos_1',
    service: 'ACCOMPAGNEMENT',
    stage: 'ita',
    state,
    accountId: 'acc_1',
    account: { id: 'acc_1', name: 'Aminata Diallo', email: 'a@x.com', locale: 'fr' },
  };
  const documents: Row[] = [
    { id: 'doc_history', title: 'Historique personnel', kind: 'personalHistory', missing: true },
    { id: 'doc_family', title: 'Renseignements sur la famille', kind: 'familyInformation', missing: true },
    { id: 'doc_passport', title: 'Passeport', kind: 'passport', missing: false },
  ];
  const forms: Row[] = [];
  const db = {
    dossierDocument: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const document = documents.find((d) => d.id === where.id);
        return document ? { ...document, section: { dossier } } : null;
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => documents.find((d) => d.id === where.id)!,
      update: async ({ where, data }: { where: { id: string }; data: Row }) =>
        Object.assign(documents.find((d) => d.id === where.id)!, data),
    },
    clientForm: {
      findUnique: async ({ where }: { where: { documentId: string } }) => {
        const form = forms.find((f) => f.documentId === where.documentId);
        return form ? { ...form, updatedBy: { name: 'Aminata Diallo' } } : null;
      },
      upsert: async ({ where, create, update }: { where: { documentId: string }; create: Row; update: Row }) => {
        const form = forms.find((f) => f.documentId === where.documentId);
        if (form) Object.assign(form, update, { updatedAt: new Date() });
        else forms.push({ ...create, updatedAt: new Date() });
      },
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db: db as unknown as TRPCContext['prisma'], documents, forms };
}

const client = sessionFor({ id: 'acc_1', name: 'Aminata Diallo' });
const stranger = sessionFor({ id: 'acc_2', name: 'Bob Other' });
const consultant = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' });
const formsFor = (db: TRPCContext['prisma'], session: CurrentSession) =>
  createCaller({ prisma: db, session, headers: new Headers() } as unknown as TRPCContext).clientForms;

const covered = { from: '2010-01', to: null };
const history = {
  birthDate: '1994-04-02',
  activities: [{ ...covered, id: 'a', kind: 'work' as const, title: 'Comptable', city: 'Douala', country: 'Cameroun', status: 'Citoyenne' }],
  addresses: [{ ...covered, id: 'b', line: 'Rue 1', city: 'Douala', province: 'Littoral', postalCode: '', country: 'Cameroun' }],
};

describe('the Renseignements du client forms', () => {
  it('start empty, and save whole; a complete one is no longer « Manquant »', async () => {
    const { db, documents } = fakeDatabase();
    expect(await formsFor(db, client).get({ documentId: 'doc_history' })).toMatchObject({
      kind: 'personalHistory',
      data: { birthDate: null, activities: [], addresses: [] },
      complete: false,
      editable: true,
    });
    await expect(formsFor(db, client).save({ documentId: 'doc_history', kind: 'personalHistory', data: history })).resolves.toEqual({
      complete: true,
    });
    expect(documents[0]).toMatchObject({ missing: false });
    expect(await formsFor(db, consultant).get({ documentId: 'doc_history' })).toMatchObject({ complete: true, data: history });
  });

  it('keeps an incomplete one « Manquant »', async () => {
    const { db, documents } = fakeDatabase();
    await formsFor(db, client).save({ documentId: 'doc_history', kind: 'personalHistory', data: { ...history, addresses: [] } });
    expect(documents[0]).toMatchObject({ missing: true });
  });

  it('refuses a Document that is a file, the wrong form, another Account, and a closed Dossier', async () => {
    const { db } = fakeDatabase();
    await expect(formsFor(db, client).get({ documentId: 'doc_passport' })).rejects.toMatchObject({ message: 'NOT_A_FORM' });
    await expect(
      formsFor(db, client).save({ documentId: 'doc_family', kind: 'personalHistory', data: history }),
    ).rejects.toMatchObject({ message: 'FORM_KIND_MISMATCH' });
    await expect(formsFor(db, stranger).get({ documentId: 'doc_history' })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const closed = fakeDatabase('CLOSED');
    await expect(
      formsFor(closed.db, client).save({ documentId: 'doc_history', kind: 'personalHistory', data: history }),
    ).rejects.toMatchObject({ message: 'DOSSIER_CLOSED' });
  });
});
