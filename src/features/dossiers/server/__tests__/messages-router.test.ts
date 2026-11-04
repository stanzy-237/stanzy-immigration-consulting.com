import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const notify = vi.hoisted(() => ({ notifyClient: vi.fn(), notifyConsultants: vi.fn() }));
vi.mock('@/features/dossiers/server/dossier-notify', () => notify);
const notifications = vi.hoisted(() => ({ notifyLater: vi.fn(), forgetComment: vi.fn(), notify: vi.fn() }));
vi.mock('@/features/notifications/server/notify', () => notifications);
const storage = vi.hoisted(() => ({ objectSize: vi.fn(), deleteObjects: vi.fn(async () => {}) }));
vi.mock('@/server/storage/r2', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/storage/r2')>()),
  ...storage,
}));
vi.stubEnv('DOSSIER_FILES_KEY', 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=');

beforeEach(() => vi.clearAllMocks());

type Row = Record<string, unknown> & { id: string };

/**
 * Seam: `dossiers.messages` through a server-side caller, over an in-memory
 * stand-in for the dossier, message, file and notification tables. R2 and
 * the emails are stubbed; the access rules run for real.
 */
function fakeDatabase() {
  const accounts: Row[] = [
    { id: 'acc_stanzy', name: 'Stanzy', email: 'stanzy@example.com', locale: 'fr', role: 'CONSULTANT' },
    { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr', role: 'MEMBER' },
    { id: 'acc_2', name: 'Bob Other', email: 'bob@example.com', locale: 'fr', role: 'MEMBER' },
  ];
  const dossiers: Row[] = [
    { id: 'dos_1', accountId: 'acc_1', service: 'ACCOMPAGNEMENT', stage: 'ita', state: 'OPEN' },
    { id: 'dos_closed', accountId: 'acc_1', service: 'EDE', stage: 'compte', state: 'CLOSED' },
  ];
  const messages: Row[] = [];
  const files: Row[] = [];
  const removedNotifications: unknown[] = [];
  let seq = 0;
  let clock = Date.parse('2026-11-04T09:00:00Z');

  const account = (id: unknown) => accounts.find((a) => a.id === id)!;
  const full = (message: Row) => ({
    ...message,
    author: account(message.authorId),
    files: files.filter((f) => f.messageId === message.id),
    _count: {
      files: files.filter((f) => f.messageId === message.id).length,
      replies: messages.filter((m) => m.parentId === message.id).length,
    },
  });

  const db = {
    dossier: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const dossier = dossiers.find((d) => d.id === where.id);
        return dossier ? { ...dossier, account: account(dossier.accountId) } : null;
      },
    },
    dossierMessage: {
      findMany: async ({ where }: { where: { dossierId: string } }) =>
        messages.filter((m) => m.dossierId === where.dossierId).map(full),
      findFirst: async ({ where }: { where: { id: string; dossierId: string } }) =>
        messages.find((m) => m.id === where.id && m.dossierId === where.dossierId) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) => {
        const message = messages.find((m) => m.id === where.id);
        return message ? full(message) : null;
      },
      create: async ({ data }: { data: Row & { files: { create: Row[] } } }) => {
        const { files: attached, ...rest } = data;
        const row = { ...rest, id: `msg_${++seq}`, editedAt: null, deletedAt: null, createdAt: new Date((clock += 1000)) };
        messages.push(row);
        for (const file of attached.create) files.push({ ...file, id: `file_${++seq}`, messageId: row.id });
        return { id: row.id };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        Object.assign(messages.find((m) => m.id === where.id)!, data);
      },
      delete: async ({ where }: { where: { id: string } }) => {
        messages.splice(
          messages.findIndex((m) => m.id === where.id),
          1,
        );
        for (let i = files.length - 1; i >= 0; i--) if (files[i]!.messageId === where.id) files.splice(i, 1);
      },
      count: async ({ where }: { where: { parentId: string } }) =>
        messages.filter((m) => m.parentId === where.parentId).length,
    },
    dossierMessageFile: {
      findMany: async ({ where }: { where: { messageId: string } }) => files.filter((f) => f.messageId === where.messageId),
      deleteMany: async ({ where }: { where: { messageId: string } }) => {
        for (let i = files.length - 1; i >= 0; i--) if (files[i]!.messageId === where.messageId) files.splice(i, 1);
      },
    },
    notification: {
      deleteMany: async ({ where }: { where: unknown }) => {
        removedNotifications.push(where);
      },
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db: db as unknown as TRPCContext['prisma'], messages, files, removedNotifications };
}

const consultant = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' });
const client = sessionFor({ id: 'acc_1' });
const stranger = sessionFor({ id: 'acc_2', name: 'Bob Other' });
const callerFor = (db: TRPCContext['prisma'], session: CurrentSession) =>
  createCaller({ prisma: db, session, headers: new Headers() } as unknown as TRPCContext);

const file = (name: string) => ({
  objectKey: `dossiers/dos_1/messages/${name}.bin`,
  key: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
  iv: 'AAAAAAAAAAAAAAAA',
  fileName: `${name}.pdf`,
  contentType: 'application/pdf' as const,
  size: 1000,
});

describe('Messages du dossier', () => {
  it('lets the Client write to the consultant, who is told by email and bell', async () => {
    const { db } = fakeDatabase();
    await callerFor(db, client).dossiers.messages.post({ dossierId: 'dos_1', body: 'Bonjour, une question.', files: [] });

    expect(notify.notifyConsultants).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'dos_1' }),
      'Aminata Diallo',
      { kind: 'clientMessage', excerpt: 'Bonjour, une question.' },
    );
    expect(notifications.notifyLater).toHaveBeenCalledWith(db, {
      kind: 'DOSSIER_MESSAGE',
      actorId: 'acc_1',
      recipients: 'CONSULTANTS',
      target: { dossierId: 'dos_1', messageId: 'msg_1' },
    });

    const list = await callerFor(db, consultant).dossiers.messages.list({ dossierId: 'dos_1' });
    expect(list.open).toBe(true);
    expect(list.messages).toEqual([
      expect.objectContaining({ body: 'Bonjour, une question.', author: expect.objectContaining({ name: 'Aminata Diallo' }) }),
    ]);
  });

  it('emails the Client when the consultant writes, the button on the messages', async () => {
    const { db } = fakeDatabase();
    await callerFor(db, consultant).dossiers.messages.post({ dossierId: 'dos_1', body: 'Voici la suite.', files: [] });
    expect(notify.notifyClient).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acc_1' }),
      'ACCOMPAGNEMENT',
      { kind: 'message', excerpt: 'Voici la suite.' },
      'dos_1',
      '#messages',
    );
  });

  it('keeps files that were really stored, a message being only files if need be', async () => {
    const { db, files } = fakeDatabase();
    storage.objectSize.mockResolvedValue(1016);
    await callerFor(db, client).dossiers.messages.post({ dossierId: 'dos_1', body: '', files: [file('releve')] });
    expect(files).toEqual([expect.objectContaining({ fileName: 'releve.pdf', wrappedKey: expect.any(String) })]);
    expect(notify.notifyConsultants).toHaveBeenCalledWith(expect.anything(), 'Aminata Diallo', {
      kind: 'clientMessage',
      excerpt: 'releve.pdf',
    });
  });

  it('refuses a file stored outside the Dossier’s folder, and an empty message', async () => {
    const caller = callerFor(fakeDatabase().db, client);
    await expect(
      caller.dossiers.messages.post({
        dossierId: 'dos_1',
        body: '',
        files: [{ ...file('x'), objectKey: 'dossiers/dos_9/messages/x.bin' }],
      }),
    ).rejects.toMatchObject({ message: 'DOCUMENT_FILE_INVALID' });
    await expect(caller.dossiers.messages.post({ dossierId: 'dos_1', body: '  ', files: [] })).rejects.toThrow();
  });

  it('keeps replies one level deep', async () => {
    const { db, messages } = fakeDatabase();
    const caller = callerFor(db, client);
    const first = await caller.dossiers.messages.post({ dossierId: 'dos_1', body: 'Question', files: [] });
    const reply = await callerFor(db, consultant).dossiers.messages.post({
      dossierId: 'dos_1',
      parentId: first.id,
      body: 'Réponse',
      files: [],
    });
    await caller.dossiers.messages.post({ dossierId: 'dos_1', parentId: reply.id, body: 'Merci', files: [] });
    expect(messages.map((m) => m.parentId)).toEqual([null, first.id, first.id]);
  });

  it('lets only its author edit a message, and its author or the consultant delete it', async () => {
    const { db, messages } = fakeDatabase();
    const { id } = await callerFor(db, client).dossiers.messages.post({ dossierId: 'dos_1', body: 'Texte', files: [] });
    await expect(callerFor(db, consultant).dossiers.messages.edit({ id, body: 'Autre' })).rejects.toMatchObject({
      message: 'COMMENT_NOT_YOURS',
    });
    await callerFor(db, client).dossiers.messages.edit({ id, body: 'Texte corrigé' });
    expect(messages[0]).toMatchObject({ body: 'Texte corrigé', editedAt: expect.any(Date) });
    await expect(callerFor(db, client).dossiers.messages.edit({ id, body: '' })).rejects.toMatchObject({
      message: 'MESSAGE_EMPTY',
    });

    await callerFor(db, consultant).dossiers.messages.delete({ id });
    expect(messages).toEqual([]);
  });

  it('keeps a deleted message with replies as « Message supprimé », its files gone', async () => {
    const { db, messages, files, removedNotifications } = fakeDatabase();
    storage.objectSize.mockResolvedValue(1016);
    const { id } = await callerFor(db, client).dossiers.messages.post({
      dossierId: 'dos_1',
      body: 'Avec fichier',
      files: [file('passeport')],
    });
    await callerFor(db, consultant).dossiers.messages.post({ dossierId: 'dos_1', parentId: id, body: 'Reçu', files: [] });

    await callerFor(db, client).dossiers.messages.delete({ id });
    expect(messages[0]).toMatchObject({ id, body: '', deletedAt: expect.any(Date) });
    expect(files).toEqual([]);
    expect(storage.deleteObjects).toHaveBeenCalledWith('private', ['dossiers/dos_1/messages/passeport.bin']);
    expect(removedNotifications).toEqual([{ messageId: id }]);

    const list = await callerFor(db, consultant).dossiers.messages.list({ dossierId: 'dos_1' });
    expect(list.messages[0]).toMatchObject({ body: '', files: [] });

    // Its last reply gone, it goes too.
    await callerFor(db, consultant).dossiers.messages.delete({ id: messages[1]!.id });
    expect(messages).toEqual([]);
  });

  it('is read only once the Dossier is closed, and out of reach for anyone else', async () => {
    const { db } = fakeDatabase();
    await expect(
      callerFor(db, client).dossiers.messages.post({ dossierId: 'dos_closed', body: 'Encore là ?', files: [] }),
    ).rejects.toMatchObject({ message: 'DOSSIER_CLOSED' });
    expect((await callerFor(db, client).dossiers.messages.list({ dossierId: 'dos_closed' })).open).toBe(false);
    await expect(callerFor(db, stranger).dossiers.messages.list({ dossierId: 'dos_1' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
