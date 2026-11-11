import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const notify = vi.hoisted(() => ({ notifyClient: vi.fn(), notifyConsultants: vi.fn() }));
vi.mock('@/features/dossiers/server/dossier-notify', () => notify);
const notifications = vi.hoisted(() => ({ notifyLater: vi.fn(), forgetComment: vi.fn(), notify: vi.fn() }));
vi.mock('@/features/notifications/server/notify', () => notifications);

const storage = vi.hoisted(() => ({
  objectSize: vi.fn(),
  deleteObjects: vi.fn(),
  presignUpload: vi.fn(),
  readObject: vi.fn(),
}));
vi.mock('@/server/storage/r2', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/storage/r2')>()),
  ...storage,
}));
// A real master key: the routers wrap each file's key with it.
vi.stubEnv('DOSSIER_FILES_KEY', 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=');
vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }));

/**
 * Seam: `dossiers.documents` through a server-side caller, over an in-memory
 * stand-in for the dossier, section, document, version and comment tables.
 * R2 and the emails are stubbed; the access rules and the Finale lock
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
      { id: 'dos_ede', accountId: 'acc_1', service: 'EDE', stage: 'compte', state: 'OPEN' },
    ],
    dossierSection: [
      { id: 'sec_1', dossierId: 'dos_1', title: 'Diplômes – Requérant principal', position: 1 },
      { id: 'sec_closed', dossierId: 'dos_closed', title: 'Diplômes', position: 1 },
      { id: 'sec_ede', dossierId: 'dos_ede', title: 'Diplômes', position: 1 },
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
      .map((c) => ({ ...c, author: { id: c.authorId, ...person(c.authorId) } })),
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

  const prisma: Record<string, unknown> = {
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
    documentComment: {
      ...table('documentComment'),
      async findUnique({ where }: { where: { id: string } }) {
        const row = byId('documentComment', where.id);
        const replies = tables.documentComment!.filter((c) => c.parentId === where.id).length;
        return row ? { ...row, _count: { replies } } : null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const row: Row = {
          editedAt: null,
          deletedAt: null,
          ...data,
          id: `com_${++seq}`,
          createdAt: new Date((clock += 1000)),
        };
        tables.documentComment!.push(row);
        return row;
      },
    },
  };
  // No Demande d'intérêt (#81): « Stanzy s'en charge » isn't offered.
  prisma.interestRequest = { findFirst: async () => null };
  prisma.$transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(prisma);
  return { prisma: prisma as unknown as TRPCContext['prisma'], tables };
}

const asConsultant = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' });
const asAminata = sessionFor();
const asBob = sessionFor({ id: 'acc_2', name: 'Bob Other', email: 'bob@example.com' });

const OBJECT = 'dossiers/dos_1/5f1c.bin';
// A real 256-bit key, base64.
const KEY = 'ZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTA=';
const IV = 'B'.repeat(16);

let db: ReturnType<typeof fakeDatabase>;
const as = (session: CurrentSession) =>
  createCaller({ prisma: db.prisma, headers: new Headers(), session }).dossiers.documents;

const version = (documentId: string, extra: Record<string, unknown> = {}) => ({
  documentId,
  objectKey: OBJECT,
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
  storage.objectSize.mockResolvedValue(1016);
});

describe('the Client’s documents', () => {
  it('uploads Versions to a Document numbered in order, and the consultant is told', async () => {
    const { id } = await as(asConsultant).addDocument({ sectionId: 'sec_1', title: 'Relevé N2' });
    expect(await as(asAminata).addVersion(version(id))).toMatchObject({ number: 1 });
    expect(await as(asAminata).addVersion(version(id))).toMatchObject({ number: 2 });

    const saved = db.tables.documentVersion![0]!;
    expect(saved).toMatchObject({ objectKey: OBJECT, uploadedById: 'acc_1' });
    expect(saved.wrappedKey).not.toContain(KEY);
    expect(notify.notifyConsultants).toHaveBeenCalledWith(expect.objectContaining({ id: 'dos_1' }), 'Aminata Diallo', {
      kind: 'clientUpload',
      document: 'Relevé N2',
    });

    const { sections, open, locked } = await as(asAminata).sections({ dossierId: 'dos_1' });
    expect({ open, locked }).toEqual({ open: true, locked: false });
    expect(sections[0]!.documents[0]!.addedBy).toEqual({ name: 'Stanzy', role: 'CONSULTANT' });
  });

  it('hides another Account’s Dossier as if it didn’t exist', async () => {
    await expect(as(asBob).sections({ dossierId: 'dos_1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('leaves the Sections, the Documents, deletions and Finales to the consultant', async () => {
    await expect(as(asAminata).addDocument({ sectionId: 'sec_1', title: 'Relevé N2' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(as(asAminata).addSection({ dossierId: 'dos_1', title: 'Preuve de fonds' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(as(asAminata).deleteDocument({ id: 'doc_closed' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(as(asAminata).setFinal({ documentId: 'doc_closed', versionId: null })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('refuses a file outside the Dossier’s folder or not the size announced', async () => {
    const { id } = await as(asConsultant).addDocument({ sectionId: 'sec_1', title: 'Relevé N2' });
    for (const elsewhere of ['dossiers/dos_closed/5f1c.bin', 'dossiers/dos_1/../dos_closed/5f1c.bin']) {
      await expect(as(asAminata).addVersion(version(id, { objectKey: elsewhere }))).rejects.toMatchObject({
        message: 'DOCUMENT_FILE_INVALID',
      });
    }
    storage.objectSize.mockResolvedValue(5000);
    await expect(as(asAminata).addVersion(version(id))).rejects.toMatchObject({ message: 'DOCUMENT_FILE_INVALID' });
    expect(storage.deleteObjects).toHaveBeenCalledWith('private', [OBJECT]);
    storage.objectSize.mockResolvedValue(null);
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

describe('the Client’s concerns about a Section (#149)', () => {
  it('lets the Client write them, and the consultant read them', async () => {
    await as(asAminata).setSectionConcerns({ id: 'sec_1', concerns: '  Mon diplôme porte mon nom de jeune fille.  ' });
    const seen = await as(asConsultant).sections({ dossierId: 'dos_1' });
    expect(seen.concerns).toBe(true);
    expect(seen.sections[0]).toMatchObject({
      concerns: 'Mon diplôme porte mon nom de jeune fille.',
      concernsUpdatedAt: expect.any(Date),
    });

    await as(asAminata).setSectionConcerns({ id: 'sec_1', concerns: '   ' });
    expect((await as(asAminata).sections({ dossierId: 'dos_1' })).sections[0]).toMatchObject({ concerns: null });
  });

  it('keeps them the Client’s own, on an open Accompagnement Dossier', async () => {
    await expect(as(asConsultant).setSectionConcerns({ id: 'sec_1', concerns: 'x' })).rejects.toMatchObject({
      message: 'CONCERNS_CLIENT_ONLY',
    });
    await expect(as(asBob).setSectionConcerns({ id: 'sec_1', concerns: 'x' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(as(asAminata).setSectionConcerns({ id: 'sec_closed', concerns: 'x' })).rejects.toMatchObject({
      message: 'DOSSIER_CLOSED',
    });
    await expect(as(asAminata).setSectionConcerns({ id: 'sec_ede', concerns: 'x' })).rejects.toMatchObject({
      message: 'CONCERNS_NOT_OFFERED',
    });
    expect((await as(asAminata).sections({ dossierId: 'dos_ede' })).concerns).toBe(false);
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
    const { id } = await as(asConsultant).addDocument({ sectionId: 'sec_1', title: 'Licence' });
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
    const { id } = await as(asConsultant).addDocument({ sectionId: 'sec_1', title: 'Doublon' });
    await as(asAminata).addVersion(version(id));
    await as(asConsultant).deleteDocument({ id });
    expect(db.tables.dossierDocument!.some((d) => d.id === id)).toBe(false);
    expect(storage.deleteObjects).toHaveBeenCalledWith('private', [OBJECT]);
  });
});

describe('the conversation on a Document', () => {
  async function conversation() {
    const { id } = await as(asConsultant).addDocument({ sectionId: 'sec_1', title: 'Relevé N2' });
    const { id: question } = await as(asConsultant).comment({ documentId: id, body: 'Le scan est flou.' });
    return { documentId: id, question };
  }
  const commentsOf = async (documentId: string) =>
    (await as(asAminata).sections({ dossierId: 'dos_1' })).sections[0]!.documents.find((d) => d.id === documentId)!
      .comments;

  it('threads replies one level deep, and emails the other side', async () => {
    const { documentId, question } = await conversation();
    const { id: answer } = await as(asAminata).comment({ documentId, parentId: question, body: 'Je le refais.' });
    await as(asConsultant).comment({ documentId, parentId: answer, body: 'Merci !' });

    expect((await commentsOf(documentId)).map((c) => [c.body, c.parentId])).toEqual([
      ['Le scan est flou.', null],
      ['Je le refais.', question],
      ['Merci !', question],
    ]);
    expect(notify.notifyConsultants).toHaveBeenCalledWith(expect.anything(), 'Aminata Diallo', {
      kind: 'clientComment',
      document: 'Relevé N2',
      excerpt: 'Je le refais.',
    });
    expect(notifications.notifyLater).toHaveBeenCalledWith(expect.anything(), {
      kind: 'MESSAGE_POSTED',
      actorId: 'acc_1',
      recipients: 'CONSULTANTS',
      target: { dossierId: 'dos_1', documentId, commentId: answer },
    });
  });

  it('lets only the author edit, and shows the edit', async () => {
    const { documentId, question } = await conversation();
    await expect(as(asAminata).editComment({ id: question, body: 'Changé' })).rejects.toMatchObject({
      message: 'COMMENT_NOT_YOURS',
    });
    await as(asConsultant).editComment({ id: question, body: 'Le scan du relevé est flou.' });
    expect((await commentsOf(documentId))[0]).toMatchObject({
      body: 'Le scan du relevé est flou.',
      editedAt: expect.any(Date),
    });
  });

  it('keeps a deleted message with replies as an empty placeholder, then clears it with its last reply', async () => {
    const { documentId, question } = await conversation();
    const { id: answer } = await as(asAminata).comment({ documentId, parentId: question, body: 'Je le refais.' });

    await expect(as(asAminata).deleteComment({ id: question })).rejects.toMatchObject({ message: 'COMMENT_NOT_YOURS' });
    await as(asConsultant).deleteComment({ id: question });
    expect(notifications.forgetComment).toHaveBeenCalledWith(expect.anything(), question);
    expect((await commentsOf(documentId))[0]).toMatchObject({ id: question, body: '', deletedAt: expect.any(Date) });
    await expect(as(asConsultant).editComment({ id: question, body: 'Revenu' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    await as(asAminata).deleteComment({ id: answer });
    expect(await commentsOf(documentId)).toEqual([]);
  });

  it('won’t reply across Documents', async () => {
    const { question } = await conversation();
    const other = await as(asConsultant).addDocument({ sectionId: 'sec_1', title: 'Licence' });
    await expect(
      as(asAminata).comment({ documentId: other.id, parentId: question, body: 'Ici ?' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
