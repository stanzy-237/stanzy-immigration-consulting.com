import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const notify = vi.hoisted(() => ({ notifyClient: vi.fn(), notifyConsultants: vi.fn() }));
vi.mock('@/features/dossiers/server/dossier-notify', () => notify);

const files = vi.hoisted(() => ({
  ENCRYPTED_FILE_MAX_BYTES: 25 * 1024 * 1024 + 16,
  storedSize: vi.fn(),
  sealKey: vi.fn(async (key: string) => `wrapped:${key}`),
  deleteFiles: vi.fn(),
}));
vi.mock('@/features/dossiers/server/dossier-files', () => files);
vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }));

/**
 * Seam: `dossiers.documents` through a server-side caller, over an in-memory
 * stand-in for the dossier, section, document, version and comment tables.
 * Vercel Blob and the emails are stubbed; the access rules and the Finale lock
 * run for real.
 */
type Row = Record<string, unknown> & { id: string };

function fakeDatabase() {
  const accounts: Row[] = [
    { id: 'acc_stanzy', name: 'Stanzy', email: 'stanzy@example.com', locale: 'fr', role: 'CONSULTANT' },
    { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr', role: 'MEMBER' },
    { id: 'acc_2', name: 'Bob Other', email: 'bob@example.com', locale: 'fr', role: 'MEMBER' },
  ];
  const tables: Record<string, Row[]> = {
    dossier: [
      { id: 'dos_1', accountId: 'acc_1', service: 'ACCOMPAGNEMENT', stage: 'ita', state: 'OPEN' },
      { id: 'dos_closed', accountId: 'acc_1', service: 'EDE', stage: 'compte', state: 'CLOSED' },
    ],
    dossierSection: [
      { id: 'sec_1', dossierId: 'dos_1', title: 'Diplômes – Requérant principal', position: 1 },
      { id: 'sec_closed', dossierId: 'dos_closed', title: 'Diplômes', position: 1 },
    ],
    dossierDocument: [
      { id: 'doc_closed', sectionId: 'sec_closed', title: 'Licence', addedById: 'acc_1', finalVersionId: null },
    ],
    documentVersion: [],
    documentComment: [],
  };
  let seq = 0;
  let clock = Date.parse('2026-10-31T09:00:00Z');
  const matches = (row: Row, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([key, value]) => row[key] === value);
  const byId = (table: string, id: unknown) => tables[table]!.find((row) => row.id === id) ?? null;

  const withDossier = (dossier: Row | null) =>
    dossier && { ...dossier, account: accounts.find((a) => a.id === dossier.accountId) };
  const withSection = (section: Row | null) =>
    section && { ...section, dossier: withDossier(byId('dossier', section.dossierId)) };
  const person = (id: unknown) => {
    const a = accounts.find((row) => row.id === id)!;
    return { name: a.name, role: a.role };
  };
  const fullDocument = (doc: Row) => ({
    ...doc,
    section: withSection(byId('dossierSection', doc.sectionId)),
    addedBy: person(doc.addedById),
    versions: tables
      .documentVersion!.filter((v) => v.documentId === doc.id)
      .sort((a, b) => (a.number as number) - (b.number as number))
      .map((v) => ({ ...v, uploadedBy: person(v.uploadedById) })),
    comments: tables
      .documentComment!.filter((c) => c.documentId === doc.id)
      .map((c) => ({ ...c, author: person(c.authorId) })),
  });

  const table = (name: string, shape: (row: Row) => unknown = (row) => row) => ({
    async findUnique({ where }: { where: { id: string } }) {
      const row = byId(name, where.id);
      return row ? shape(row) : null;
    },
    async findFirst({ where, orderBy }: { where: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }) {
      const rows = tables[name]!.filter((row) => matches(row, where));
      const [key, dir] = Object.entries(orderBy ?? {})[0] ?? [];
      if (key) rows.sort((a, b) => ((a[key] as number) - (b[key] as number)) * (dir === 'desc' ? -1 : 1));
      return rows[0] ?? null;
    },
    async findMany({ where }: { where: Record<string, unknown> }) {
      return tables[name]!.filter((row) => matches(row, where)).map(shape);
    },
    async count({ where }: { where: Record<string, unknown> }) {
      return tables[name]!.filter((row) => matches(row, where)).length;
    },
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = { finalVersionId: null, ...data, id: `${name}_${++seq}`, createdAt: new Date((clock += 1000)) };
      tables[name]!.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      return Object.assign(byId(name, where.id)!, data);
    },
    async delete({ where }: { where: { id: string } }) {
      tables[name] = tables[name]!.filter((row) => row.id !== where.id);
      if (name === 'dossierDocument') {
        tables.documentVersion = tables.documentVersion!.filter((v) => v.documentId !== where.id);
      }
    },
  });

  const prisma = {
    dossier: table('dossier', (row) => withDossier(row)),
    dossierSection: {
      ...table('dossierSection', (row) => withSection(row)),
      async findMany({ where }: { where: { dossierId: string } }) {
        return tables
          .dossierSection!.filter((s) => s.dossierId === where.dossierId)
          .map((s) => ({
            ...s,
            documents: tables.dossierDocument!.filter((d) => d.sectionId === s.id).map(fullDocument),
          }));
      },
    },
    dossierDocument: table('dossierDocument', fullDocument),
    documentVersion: table('documentVersion'),
    documentComment: table('documentComment'),
  };
  return { prisma: prisma as unknown as TRPCContext['prisma'], tables };
}

const asConsultant = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' });
const asAminata = sessionFor();
const asBob = sessionFor({ id: 'acc_2', name: 'Bob Other', email: 'bob@example.com' });

const BLOB = 'https://store.public.blob.vercel-storage.com/dossiers/dos_1/doc-x1.bin';
const KEY = `${'A'.repeat(43)}=`;
const IV = 'B'.repeat(16);

let db: ReturnType<typeof fakeDatabase>;
const as = (session: CurrentSession) =>
  createCaller({ prisma: db.prisma, headers: new Headers(), session }).dossiers.documents;

const version = (documentId: string, extra: Record<string, unknown> = {}) => ({
  documentId,
  blobUrl: BLOB,
  key: KEY,
  iv: IV,
  fileName: 'releve-n2.pdf',
  contentType: 'application/pdf' as const,
  size: 1000,
  ...extra,
});

beforeEach(() => {
  db = fakeDatabase();
  vi.clearAllMocks();
  files.storedSize.mockResolvedValue(1016);
});

describe('the Client’s documents', () => {
  it('adds a Document, uploads Versions numbered in order, and the consultant is told', async () => {
    const { id } = await as(asAminata).addDocument({ sectionId: 'sec_1', title: 'Relevé N2' });
    expect(await as(asAminata).addVersion(version(id))).toMatchObject({ number: 1 });
    expect(await as(asAminata).addVersion(version(id))).toMatchObject({ number: 2 });

    expect(db.tables.documentVersion![0]).toMatchObject({ wrappedKey: `wrapped:${KEY}`, uploadedById: 'acc_1' });
    expect(notify.notifyConsultants).toHaveBeenCalledWith(expect.objectContaining({ id: 'dos_1' }), 'Aminata Diallo', {
      kind: 'clientUpload',
      document: 'Relevé N2',
    });

    const { sections, open, locked } = await as(asAminata).sections({ dossierId: 'dos_1' });
    expect({ open, locked }).toEqual({ open: true, locked: false });
    expect(sections[0]!.documents[0]!.addedBy).toEqual({ name: 'Aminata Diallo', role: 'MEMBER' });
  });

  it('hides another Account’s Dossier as if it didn’t exist', async () => {
    await expect(as(asBob).sections({ dossierId: 'dos_1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(as(asBob).addDocument({ sectionId: 'sec_1', title: 'Intrus' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('leaves the Sections, deletions and Finales to the consultant', async () => {
    await expect(as(asAminata).addSection({ dossierId: 'dos_1', title: 'Preuve de fonds' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(as(asAminata).deleteDocument({ id: 'doc_closed' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(as(asAminata).setFinal({ documentId: 'doc_closed', versionId: null })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('refuses a file outside the Dossier’s folder or not the size announced', async () => {
    const { id } = await as(asAminata).addDocument({ sectionId: 'sec_1', title: 'Relevé N2' });
    const elsewhere = BLOB.replace('dos_1', 'dos_closed');
    await expect(as(asAminata).addVersion(version(id, { blobUrl: elsewhere }))).rejects.toMatchObject({
      message: 'DOCUMENT_FILE_INVALID',
    });
    files.storedSize.mockResolvedValue(5000);
    await expect(as(asAminata).addVersion(version(id))).rejects.toMatchObject({ message: 'DOCUMENT_FILE_INVALID' });
    files.storedSize.mockResolvedValue(null);
    await expect(as(asAminata).addVersion(version(id))).rejects.toMatchObject({ message: 'DOCUMENT_FILE_INVALID' });
    expect(db.tables.documentVersion).toHaveLength(0);
  });

  it('keeps a closed Dossier readable but unchanged', async () => {
    await expect(as(asAminata).sections({ dossierId: 'dos_closed' })).resolves.toMatchObject({ open: false });
    await expect(as(asAminata).comment({ documentId: 'doc_closed', body: 'Bonjour' })).rejects.toMatchObject({
      message: 'DOSSIER_CLOSED',
    });
  });
});

describe('the consultant’s documents', () => {
  it('adds Sections at the end and deletes only empty ones', async () => {
    const { id } = await as(asConsultant).addSection({ dossierId: 'dos_1', title: 'Preuve de fonds' });
    expect(db.tables.dossierSection!.find((s) => s.id === id)).toMatchObject({ position: 2 });

    await as(asConsultant).addDocument({ sectionId: id, title: 'Relevé bancaire' });
    await expect(as(asConsultant).deleteSection({ id })).rejects.toMatchObject({
      message: 'DOSSIER_SECTION_NOT_EMPTY',
    });
  });

  it('marks a Finale until the Dossier moves past « Vérification et dépôt »', async () => {
    const { id } = await as(asAminata).addDocument({ sectionId: 'sec_1', title: 'Licence' });
    const v1 = await as(asAminata).addVersion(version(id));
    await as(asConsultant).setFinal({ documentId: id, versionId: v1.id });
    expect(db.tables.dossierDocument!.find((d) => d.id === id)).toMatchObject({ finalVersionId: v1.id });

    db.tables.dossier![0]!.stage = 'aor';
    await expect(as(asConsultant).setFinal({ documentId: id, versionId: null })).rejects.toMatchObject({
      message: 'DOSSIER_FINALES_LOCKED',
    });
    expect((await as(asConsultant).sections({ dossierId: 'dos_1' })).locked).toBe(true);
  });

  it('won’t mark another Document’s Version', async () => {
    const a = await as(asConsultant).addDocument({ sectionId: 'sec_1', title: 'Licence' });
    const b = await as(asConsultant).addDocument({ sectionId: 'sec_1', title: 'Master' });
    const v = await as(asConsultant).addVersion(version(a.id));
    await expect(as(asConsultant).setFinal({ documentId: b.id, versionId: v.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('emails the Client a comment and a new Version', async () => {
    const { id } = await as(asConsultant).addDocument({ sectionId: 'sec_1', title: 'Relevé N2' });
    await as(asConsultant).comment({ documentId: id, body: 'Le scan est flou, merci de le refaire.' });
    expect(notify.notifyClient).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'aminata@example.com' }),
      'ACCOMPAGNEMENT',
      { kind: 'comment', document: 'Relevé N2', excerpt: 'Le scan est flou, merci de le refaire.' },
      'dos_1',
    );
    await as(asConsultant).addVersion(version(id));
    expect(notify.notifyClient).toHaveBeenLastCalledWith(
      expect.anything(),
      'ACCOMPAGNEMENT',
      { kind: 'newVersion', document: 'Relevé N2' },
      'dos_1',
    );
    expect(notify.notifyConsultants).not.toHaveBeenCalled();
  });

  it('deletes a Document with its files', async () => {
    const { id } = await as(asAminata).addDocument({ sectionId: 'sec_1', title: 'Doublon' });
    await as(asAminata).addVersion(version(id));
    await as(asConsultant).deleteDocument({ id });
    expect(db.tables.dossierDocument!.some((d) => d.id === id)).toBe(false);
    expect(files.deleteFiles).toHaveBeenCalledWith([BLOB]);
  });
});
