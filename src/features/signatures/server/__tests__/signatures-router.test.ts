import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { encryptFile, toBase64, wrapKey } from '@/features/dossiers/lib/file-crypto';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const notify = vi.hoisted(() => ({ notifyClient: vi.fn(), notifyConsultants: vi.fn() }));
vi.mock('@/features/dossiers/server/dossier-notify', () => notify);
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

/** A 1 × 1 transparent PNG, as the signature pad sends it. */
const SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const SIGN_FIELD = { kind: 'SIGNATURE' as const, page: 0, x: 0.1, y: 0.8, width: 0.3, height: 0.07 };

type Row = Record<string, unknown> & { id: string };

/**
 * Seam: `signatures` through a server-side caller, over an in-memory stand-in
 * for the dossier, document, version and Demande tables, with R2 in memory
 * and the real encryption and PDF signing.
 */
function fakeDatabase() {
  const accounts: Row[] = [
    { id: 'acc_stanzy', name: 'Stanzy', email: 'stanzy@example.com', locale: 'fr', role: 'CONSULTANT' },
    { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr', role: 'MEMBER' },
    { id: 'acc_2', name: 'Bob Other', email: 'bob@example.com', locale: 'fr', role: 'MEMBER' },
  ];
  const dossiers: Row[] = [
    { id: 'dos_1', accountId: 'acc_1', service: 'ACCOMPAGNEMENT', stage: 'ita', state: 'OPEN' },
  ];
  const documents: Row[] = [{ id: 'doc_1', sectionId: 'sec_1', title: 'Lettre explicative' }];
  const versions: Row[] = [];
  const requests: Row[] = [];
  const assets: Row[] = [];
  let seq = 0;

  const dossierOf = (id: unknown) => {
    const dossier = dossiers.find((row) => row.id === id)!;
    return { ...dossier, account: accounts.find((a) => a.id === dossier.accountId) };
  };
  const documentOf = (id: unknown) => {
    const document = documents.find((row) => row.id === id)!;
    return { ...document, section: { title: 'Lettres', dossier: dossierOf('dos_1') } };
  };
  const requestOf = (row: Row) => ({
    ...row,
    version: versions.find((v) => v.id === row.versionId),
    document: documentOf(row.documentId),
  });
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => row[key] === value);

  const db = {
    dossier: { findUnique: async ({ where }: { where: { id: string } }) => (dossiers.some((d) => d.id === where.id) ? dossierOf(where.id) : null) },
    documentVersion: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const version = versions.find((v) => v.id === where.id);
        return version ? { ...version, document: documentOf(version.documentId) } : null;
      },
      findFirst: async ({ where }: { where: { documentId: string } }) =>
        versions.filter((v) => v.documentId === where.documentId).sort((a, b) => (b.number as number) - (a.number as number))[0] ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { id: `ver_${++seq}`, ...data };
        versions.push(row);
        return { id: row.id, number: row.number };
      },
    },
    signatureRequest: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = requests.find((r) => r.id === where.id);
        return row ? requestOf(row) : null;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => requests.filter((r) => matches(r, where)).map(requestOf),
      count: async ({ where }: { where: Record<string, unknown> }) => requests.filter((r) => matches(r, where)).length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `sig_${++seq}`, status: 'PENDING', createdAt: new Date(), signedAt: null, signedName: null, ...data };
        requests.push(row);
        return { id: row.id };
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const hit = requests.filter((r) => matches(r, where));
        for (const row of hit) Object.assign(row, data);
        return { count: hit.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        Object.assign(requests.find((r) => r.id === where.id)!, data);
      },
    },
    signingAsset: {
      findMany: async () => assets,
      findUnique: async ({ where }: { where: { kind: string } }) => assets.find((a) => a.kind === where.kind) ?? null,
    },
  };
  return { db, versions, requests, assets, dossiers };
}

let data: ReturnType<typeof fakeDatabase>;

/** Stores `bytes` encrypted, as an upload would, and records it as a Version of the letter. */
async function addVersion(bytes: Uint8Array, contentType = 'application/pdf', id = 'ver_pdf'): Promise<string> {
  const { ciphertext, key, iv } = await encryptFile(bytes.slice().buffer as ArrayBuffer);
  const objectKey = `dossiers/dos_1/${id}.bin`;
  bucket.set(objectKey, ciphertext);
  data.versions.push({
    id,
    documentId: 'doc_1',
    number: data.versions.length + 1,
    fileName: 'lettre.pdf',
    contentType,
    size: bytes.byteLength,
    objectKey,
    wrappedKey: await wrapKey(key, MASTER),
    iv,
  });
  return id;
}

async function letter(pages = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let n = 0; n < pages; n++) doc.addPage([595, 842]);
  return doc.save();
}

function as(session: CurrentSession, ip = '41.202.219.70') {
  return createCaller({
    prisma: data.db as unknown as TRPCContext['prisma'],
    headers: new Headers({ 'x-forwarded-for': `${ip}, 10.0.0.1`, 'user-agent': 'Mozilla/5.0 (iPhone)' }),
    session,
  }).signatures;
}

const consultant = () => as(sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' }));
const client = () => as(sessionFor({ id: 'acc_1', name: 'Aminata Diallo' }));
const stranger = () => as(sessionFor({ id: 'acc_2', name: 'Bob Other' }));

beforeEach(() => {
  vi.clearAllMocks();
  bucket.clear();
  data = fakeDatabase();
});

describe('sending a PDF for signature', () => {
  it('fingerprints the PDF and tells the Client', async () => {
    const pdf = await letter();
    const versionId = await addVersion(pdf);
    const { id } = await consultant().create({ versionId, fields: [SIGN_FIELD] });

    const request = data.requests.find((r) => r.id === id)!;
    expect(request.status).toBe('PENDING');
    expect(request.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(notify.notifyClient).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'aminata@example.com' }),
      'ACCOMPAGNEMENT',
      { kind: 'signatureRequested', document: 'Lettre explicative' },
      'dos_1',
      // The email's button opens the document to sign.
      `/signer/${id}`,
    );
    expect(notifications.notifyLater).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'SIGNATURE_REQUESTED', recipients: ['acc_1'], params: { requestId: id } }),
    );
  });

  it('refuses an image, a field past the last page, and a second Demande while one waits', async () => {
    const photo = await addVersion(new Uint8Array([1, 2, 3]), 'image/jpeg', 'ver_photo');
    await expect(consultant().create({ versionId: photo, fields: [SIGN_FIELD] })).rejects.toThrow('SIGNATURE_PDF_ONLY');

    const versionId = await addVersion(await letter(1));
    await expect(consultant().create({ versionId, fields: [{ ...SIGN_FIELD, page: 1 }] })).rejects.toThrow(
      'SIGNATURE_FIELD_OUTSIDE',
    );
    await consultant().create({ versionId, fields: [SIGN_FIELD] });
    await expect(consultant().create({ versionId, fields: [SIGN_FIELD] })).rejects.toThrow('SIGNATURE_ALREADY_PENDING');
  });

  it('needs the signature and the stamp uploaded for a STAMP field', async () => {
    const versionId = await addVersion(await letter());
    const stamp = { kind: 'STAMP' as const, page: 0, x: 0.5, y: 0.8, width: 0.36, height: 0.12 };
    await expect(consultant().create({ versionId, fields: [SIGN_FIELD, stamp] })).rejects.toThrow(
      'SIGNATURE_ASSETS_MISSING',
    );
  });

  it('is the consultant’s alone', async () => {
    const versionId = await addVersion(await letter());
    await expect(client().create({ versionId, fields: [SIGN_FIELD] })).rejects.toThrow();
  });
});

describe('signing', () => {
  async function waiting(): Promise<string> {
    const versionId = await addVersion(await letter(2));
    return (await consultant().create({ versionId, fields: [SIGN_FIELD, { ...SIGN_FIELD, kind: 'DATE', page: 1 }] })).id;
  }

  it('makes the signed PDF the Document’s next Version, with no page added', async () => {
    const id = await waiting();
    await client().sign({ id, name: 'Aminata Diallo', signature: SIGNATURE, accepted: true });

    const request = data.requests.find((r) => r.id === id)!;
    expect(request).toMatchObject({
      status: 'SIGNED',
      signedById: 'acc_1',
      signedName: 'Aminata Diallo',
      signedIp: '41.202.219.70',
      signedDevice: 'Mozilla/5.0 (iPhone)',
    });
    const signed = data.versions.find((v) => v.id === request.signedVersionId)!;
    expect(signed).toMatchObject({ number: 2, fileName: 'lettre-signe.pdf', contentType: 'application/pdf' });

    // Stored encrypted: the bucket holds no PDF in clear.
    const stored = new Uint8Array(bucket.get(signed.objectKey as string)!);
    expect(new TextDecoder().decode(stored.slice(0, 5))).not.toBe('%PDF-');
    const { openEncryptedFile } = await import('@/features/dossiers/server/dossier-files');
    const pdf = await PDFDocument.load(await openEncryptedFile(signed as never));
    // Submitted to IRCC as it is: the evidence stays with the Demande, not on a Certificat page.
    expect(pdf.getPageCount()).toBe(2);

    expect(notify.notifyConsultants).toHaveBeenCalledWith(expect.anything(), 'Aminata Diallo', {
      kind: 'clientSigned',
      document: 'Lettre explicative',
    });
    expect(notifications.notifyLater).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'DOCUMENT_SIGNED', recipients: 'CONSULTANTS' }),
    );
  });

  it('is signed once', async () => {
    const id = await waiting();
    await client().sign({ id, name: 'Aminata Diallo', signature: SIGNATURE, accepted: true });
    await expect(client().sign({ id, name: 'Aminata Diallo', signature: SIGNATURE, accepted: true })).rejects.toThrow(
      'SIGNATURE_NOT_PENDING',
    );
    expect(data.versions).toHaveLength(2);
  });

  it('is only for the Client holding the Dossier', async () => {
    const id = await waiting();
    await expect(
      consultant().sign({ id, name: 'Stanzy', signature: SIGNATURE, accepted: true }),
    ).rejects.toThrow('SIGNATURE_NOT_YOURS');
    // Someone else's Demande doesn't exist, for them.
    await expect(stranger().get({ id })).rejects.toThrow('NOT_FOUND');
    await expect(stranger().sign({ id, name: 'Bob', signature: SIGNATURE, accepted: true })).rejects.toThrow(
      'NOT_FOUND',
    );
  });

  it('refuses a PDF changed since it was sent', async () => {
    const id = await waiting();
    const original = data.versions[0]!;
    const { ciphertext, key, iv } = await encryptFile((await letter(5)).slice().buffer as ArrayBuffer);
    bucket.set(original.objectKey as string, ciphertext);
    Object.assign(original, { wrappedKey: await wrapKey(key, MASTER), iv });
    await expect(client().sign({ id, name: 'Aminata Diallo', signature: SIGNATURE, accepted: true })).rejects.toThrow(
      'SIGNATURE_DOCUMENT_CHANGED',
    );
    expect(data.requests[0]!.status).toBe('PENDING');
  });

  it('needs « J’ai lu et j’accepte » and a drawn signature', async () => {
    const id = await waiting();
    await expect(
      client().sign({ id, name: 'Aminata Diallo', signature: SIGNATURE, accepted: false as true }),
    ).rejects.toThrow();
    await expect(
      client().sign({ id, name: 'Aminata Diallo', signature: `data:image/png;base64,${toBase64(new Uint8Array([1, 2]))}`, accepted: true }),
    ).rejects.toThrow('SIGNATURE_IMAGE_INVALID');
    expect(data.requests[0]!.status).toBe('PENDING');
  });

  it('can no longer be signed once cancelled, and is gone for the Client', async () => {
    const id = await waiting();
    await consultant().cancel({ id });
    await expect(client().get({ id })).rejects.toThrow('NOT_FOUND');
    await expect(consultant().get({ id })).resolves.toMatchObject({ status: 'CANCELLED', canSign: false });
  });

  it('reads as « to sign » for its Client only', async () => {
    const id = await waiting();
    await expect(client().get({ id })).resolves.toMatchObject({ canSign: true, fileName: 'lettre.pdf' });
    await expect(consultant().get({ id })).resolves.toMatchObject({ canSign: false });
  });
});
