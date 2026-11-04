import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { encryptFile, wrapKey } from '@/features/dossiers/lib/file-crypto';
import { jpegOf } from '@/features/pdf-tools/lib/__tests__/fixtures';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const emails = vi.hoisted(() => ({ notifyContractSent: vi.fn(), notifyContractSigned: vi.fn() }));
vi.mock('@/features/contracts/server/contract-notify', () => emails);
const notifications = vi.hoisted(() => ({ notifyLater: vi.fn(), forgetComment: vi.fn(), notify: vi.fn() }));
vi.mock('@/features/notifications/server/notify', () => notifications);

/** The private bucket, in memory. */
const bucket = vi.hoisted(() => new Map<string, ArrayBuffer>());
const storage = vi.hoisted(() => ({
  readObject: vi.fn(async (_bucket: string, key: string) => {
    const object = bucket.get(key);
    if (!object) throw new Error('STORAGE_READ_FAILED 404');
    return object;
  }),
  writeObject: vi.fn(async (_bucket: string, key: string, body: ArrayBuffer) => {
    bucket.set(key, body);
  }),
  deleteObjects: vi.fn(),
}));
vi.mock('@/server/storage/r2', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/storage/r2')>()),
  ...storage,
}));
const MASTER = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
vi.stubEnv('DOSSIER_FILES_KEY', MASTER);
vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }));

const SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

type Row = Record<string, unknown> & { id: string };

/**
 * Seam: `contracts` through a server-side caller, over an in-memory stand-in
 * for the dossier, template, counter, Contrat and signing-asset tables, with
 * R2 in memory, the real encryption and the real PDFs on the letterhead.
 */
function fakeDatabase() {
  const accounts: Row[] = [
    { id: 'acc_stanzy', name: 'Stanzy', email: 'stanzy@example.com', locale: 'fr', role: 'CONSULTANT' },
    { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr', role: 'MEMBER' },
    { id: 'acc_2', name: 'Bob Other', email: 'bob@example.com', locale: 'fr', role: 'MEMBER' },
  ];
  const dossiers: Row[] = [{ id: 'dos_1', accountId: 'acc_1', service: 'ACCOMPAGNEMENT', stage: 'ita', state: 'OPEN' }];
  const templates: Row[] = [];
  const contracts: Row[] = [];
  const assets: Row[] = [];
  const counters = new Map<number, number>();
  let seq = 0;

  const dossierOf = (id: unknown) => {
    const dossier = dossiers.find((row) => row.id === id);
    return dossier ? { ...dossier, account: accounts.find((a) => a.id === dossier.accountId) } : null;
  };
  const matches = (row: Row, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && 'in' in value) return (value.in as unknown[]).includes(row[key]);
      if (value && typeof value === 'object' && 'not' in value) return row[key] !== value.not;
      return (row[key] ?? null) === value;
    });
  const withDossier = (row: Row) => ({ ...row, dossier: dossierOf(row.dossierId) });

  const db = {
    dossier: { findUnique: async ({ where }: { where: { id: string } }) => dossierOf(where.id) },
    contractTemplate: {
      findUnique: async ({ where }: { where: { service_locale: { service: string; locale: string } } }) =>
        templates.find((t) => t.service === where.service_locale.service && t.locale === where.service_locale.locale) ??
        null,
      findMany: async () => templates,
      upsert: async ({ where, create, update }: { where: { service_locale: Record<string, string> }; create: Row; update: Row }) => {
        const found = templates.find(
          (t) => t.service === where.service_locale.service && t.locale === where.service_locale.locale,
        );
        if (found) Object.assign(found, update);
        else templates.push({ ...create, id: `tpl_${++seq}` });
        return { id: found?.id ?? `tpl_${seq}` };
      },
    },
    contractCounter: {
      upsert: async ({ where }: { where: { year: number } }) => {
        counters.set(where.year, (counters.get(where.year) ?? 0) + 1);
        return { year: where.year, last: counters.get(where.year) };
      },
    },
    contract: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = contracts.find((c) => c.id === where.id);
        return row ? withDossier(row) : null;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => contracts.find((c) => matches(c, where)) ?? null,
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        contracts.filter((c) => matches(c, where)).map(withDossier),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { id: `ctr_${++seq}`, status: 'SENT', signedAt: null, ...data };
        contracts.push(row);
        return { id: row.id };
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const hit = contracts.filter((c) => matches(c, where));
        for (const row of hit) Object.assign(row, data);
        return { count: hit.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        Object.assign(contracts.find((c) => c.id === where.id)!, data);
      },
    },
    signingAsset: {
      findMany: async () => assets,
      findUnique: async ({ where }: { where: { kind: string } }) => assets.find((a) => a.kind === where.kind) ?? null,
    },
  };
  return { db, templates, contracts, assets, dossiers };
}

let data: ReturnType<typeof fakeDatabase>;

async function uploadAssets() {
  for (const kind of ['SIGNATURE', 'STAMP']) {
    const { ciphertext, key, iv } = await encryptFile(jpegOf(40, 20).slice().buffer as ArrayBuffer);
    bucket.set(`signing/${kind}.bin`, ciphertext);
    data.assets.push({ id: kind, kind, contentType: 'image/jpeg', objectKey: `signing/${kind}.bin`, wrappedKey: await wrapKey(key, MASTER), iv });
  }
}

function as(session: CurrentSession) {
  return createCaller({
    prisma: data.db as unknown as TRPCContext['prisma'],
    headers: new Headers({ 'x-forwarded-for': '41.202.219.70', 'user-agent': 'Mozilla/5.0 (Android)' }),
    session,
  }).contracts;
}

const consultant = () => as(sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' }));
const client = () => as(sessionFor({ id: 'acc_1', name: 'Aminata Diallo' }));
const stranger = () => as(sessionFor({ id: 'acc_2', name: 'Bob Other' }));

const TEMPLATE = {
  service: 'ACCOMPAGNEMENT' as const,
  locale: 'fr' as const,
  title: 'Contrat de service {numero}',
  body: '# Objet\nEntre {client} et Stanzy, pour {service}.\n\n# Prix\nLe prix est de {prix}, payé ainsi : {echeancier}.',
};
const SEND = { dossierId: 'dos_1', locale: 'fr' as const, amount: 500_000, currency: 'XAF' as const, schedule: '50 % à la signature' };

beforeEach(() => {
  vi.clearAllMocks();
  bucket.clear();
  data = fakeDatabase();
});

async function ready() {
  await consultant().templates.save(TEMPLATE);
  await uploadAssets();
}

describe('sending a Contrat', () => {
  it('fills the template, numbers it for the year, and sends it signed and stamped', async () => {
    await ready();
    const { id, number } = await consultant().send(SEND);
    expect(number).toBe(`CTR-${new Date().getUTCFullYear()}-0001`);

    const contract = data.contracts.find((c) => c.id === id)!;
    expect(contract.title).toBe(`Contrat de service ${number}`);
    expect(contract.body).toContain('Entre Aminata Diallo et Stanzy, pour Accompagnement Entrée Express.');
    expect(contract.body).toContain('Le prix est de 500 000 FCFA, payé ainsi : 50 % à la signature.');
    expect(contract).toMatchObject({ amount: 500_000, currency: 'XAF', status: 'SENT', sentById: 'acc_stanzy' });
    expect((contract.fields as { kind: string }[]).map((f) => f.kind)).toEqual(['SIGNATURE', 'NAME', 'DATE']);
    // Stored encrypted.
    expect(new TextDecoder().decode(new Uint8Array(bucket.get(contract.objectKey as string)!).slice(0, 5))).not.toBe('%PDF-');

    expect(emails.notifyContractSent).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'aminata@example.com' }),
      expect.objectContaining({ number, amendment: false, dossierId: 'dos_1' }),
    );
    expect(notifications.notifyLater).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'CONTRACT_SENT', recipients: ['acc_1'], params: { contractId: id, number } }),
    );
  });

  it('needs the template and the signature and stamp', async () => {
    await expect(consultant().send(SEND)).rejects.toThrow('CONTRACT_TEMPLATE_MISSING');
    await consultant().templates.save(TEMPLATE);
    await expect(consultant().send(SEND)).rejects.toThrow('SIGNATURE_ASSETS_MISSING');
    await expect(consultant().send({ ...SEND, locale: 'en' })).rejects.toThrow('CONTRACT_TEMPLATE_MISSING');
  });

  it('sends one at a time: cancel to correct, an Avenant once signed', async () => {
    await ready();
    const first = await consultant().send(SEND);
    await expect(consultant().send(SEND)).rejects.toThrow('CONTRACT_ALREADY_SENT');
    await consultant().cancel({ id: first.id, reason: 'Mauvais prix' });
    const second = await consultant().send({ ...SEND, amount: 450_000 });
    // A cancelled number is never given again.
    expect(second.number).toMatch(/-0002$/);
    await client().sign({ id: second.id, name: 'Aminata Diallo', signature: SIGNATURE, accepted: true });
    await expect(consultant().send(SEND)).rejects.toThrow('CONTRACT_ALREADY_SIGNED');
  });

  it('is the consultant’s alone', async () => {
    await ready();
    await expect(client().send(SEND)).rejects.toThrow();
    await expect(client().templates.save(TEMPLATE)).rejects.toThrow();
  });
});

describe('signing a Contrat', () => {
  it('keeps the signed PDF with its Certificat, and emails it to both sides', async () => {
    await ready();
    const { id, number } = await consultant().send(SEND);
    await client().sign({ id, name: 'Aminata Diallo', signature: SIGNATURE, accepted: true });

    const contract = data.contracts.find((c) => c.id === id)!;
    expect(contract).toMatchObject({
      status: 'SIGNED',
      signedById: 'acc_1',
      signedName: 'Aminata Diallo',
      signedIp: '41.202.219.70',
      signedDevice: 'Mozilla/5.0 (Android)',
    });
    const { openEncryptedFile } = await import('@/features/dossiers/server/dossier-files');
    const sent = await PDFDocument.load(await openEncryptedFile({
        objectKey: contract.objectKey as string,
        wrappedKey: contract.wrappedKey as string,
        iv: contract.iv as string,
        fileName: 'x',
        contentType: 'application/pdf',
      }));
    const signed = await PDFDocument.load(
      await openEncryptedFile({
        objectKey: contract.signedObjectKey as string,
        wrappedKey: contract.signedWrappedKey as string,
        iv: contract.signedIv as string,
        fileName: 'x',
        contentType: 'application/pdf',
      }),
    );
    // The Certificat de signature, one more page.
    expect(signed.getPageCount()).toBe(sent.getPageCount() + 1);

    expect(emails.notifyContractSigned).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'aminata@example.com' }),
      expect.objectContaining({ number }),
      expect.any(Uint8Array),
    );
    expect(notifications.notifyLater).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'CONTRACT_SIGNED', recipients: 'CONSULTANTS' }),
    );
  });

  it('is signed once, by the Client holding the Dossier only', async () => {
    await ready();
    const { id } = await consultant().send(SEND);
    await expect(consultant().sign({ id, name: 'Stanzy', signature: SIGNATURE, accepted: true })).rejects.toThrow(
      'CONTRACT_NOT_YOURS',
    );
    await expect(stranger().get({ id })).rejects.toThrow('NOT_FOUND');
    await expect(client().get({ id })).resolves.toMatchObject({ canSign: true, signerName: 'Aminata Diallo' });
    await client().sign({ id, name: 'Aminata Diallo', signature: SIGNATURE, accepted: true });
    await expect(client().sign({ id, name: 'Aminata Diallo', signature: SIGNATURE, accepted: true })).rejects.toThrow(
      'CONTRACT_NOT_PENDING',
    );
  });

  it('can’t be signed once cancelled, and is gone for the Client', async () => {
    await ready();
    const { id } = await consultant().send(SEND);
    await consultant().cancel({ id });
    await expect(client().get({ id })).rejects.toThrow('NOT_FOUND');
    const mine = await client().forDossier({ dossierId: 'dos_1' });
    expect(mine.contracts).toHaveLength(0);
    expect((await consultant().forDossier({ dossierId: 'dos_1' })).contracts).toHaveLength(1);
  });
});

describe('Avenants', () => {
  it('follow a signed Contrat, numbered after it, and are signed the same way', async () => {
    await ready();
    const contract = await consultant().send(SEND);
    await expect(
      consultant().sendAmendment({ contractId: contract.id, title: 'Avenant : conjoint', body: 'Le conjoint est ajouté au dossier.' }),
    ).rejects.toThrow('CONTRACT_NOT_SIGNED');
    await client().sign({ id: contract.id, name: 'Aminata Diallo', signature: SIGNATURE, accepted: true });

    const first = await consultant().sendAmendment({
      contractId: contract.id,
      title: 'Avenant : conjoint',
      body: 'Le conjoint est ajouté au dossier.',
    });
    expect(first.number).toBe(`${contract.number}-A1`);
    await expect(
      consultant().sendAmendment({ contractId: contract.id, title: 'Autre avenant', body: 'Un autre changement à signer.' }),
    ).rejects.toThrow('AMENDMENT_ALREADY_SENT');
    await consultant().cancel({ id: first.id });
    const second = await consultant().sendAmendment({
      contractId: contract.id,
      title: 'Avenant : conjoint',
      body: 'Le conjoint est ajouté au dossier, corrigé.',
    });
    expect(second.number).toBe(`${contract.number}-A2`);
    await client().sign({ id: second.id, name: 'Aminata Diallo', signature: SIGNATURE, accepted: true });

    const { signed, contracts } = await client().forDossier({ dossierId: 'dos_1' });
    expect(signed).toBe(true);
    expect(contracts.map((c) => [c.number, c.status])).toEqual([
      [contract.number, 'SIGNED'],
      [second.number, 'SIGNED'],
    ]);
  });
});
