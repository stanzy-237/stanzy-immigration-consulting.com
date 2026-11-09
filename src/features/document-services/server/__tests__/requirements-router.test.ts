import { describe, expect, it, vi } from 'vitest';

import { STARTER_SERVICES } from '@/features/document-services/data/starter-services';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const storage = vi.hoisted(() => ({ objectSize: vi.fn(), deleteObjects: vi.fn(async () => undefined) }));
vi.mock('@/server/storage/r2', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/storage/r2')>()),
  ...storage,
}));
const notifications = vi.hoisted(() => ({ notifyLater: vi.fn() }));
vi.mock('@/features/notifications/server/notify', () => notifications);
vi.stubEnv('DOSSIER_FILES_KEY', 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=');

type Row = Record<string, unknown> & { id: string };

const pof = STARTER_SERVICES.find((service) => service.slug === 'preuve-de-fonds-sans-fonds')!;

/**
 * Seam: `documentServices.requirements` through a server-side caller, over
 * an in-memory stand-in for one Stanzy request, its Dossier and Documents,
 * and the files handed over; R2 stubbed.
 */
function fakeDatabase(status = 'REQUESTED', service = 'ACCOMPAGNEMENT') {
  const request: Row = {
    id: 'stz_1',
    status,
    answers: null,
    createdAt: new Date('2026-11-07T10:00:00Z'),
    document: { id: 'doc_bank', title: 'Lettre de la banque', section: { dossierId: 'dos_1' } },
    service: { slug: pof.slug, name: pof.name, prerequisites: pof.prerequisites, questionnaire: pof.questionnaire },
  };
  const dossier = {
    id: 'dos_1',
    service,
    stage: 'DOCUMENTS',
    state: 'OPEN',
    accountId: 'acc_1',
    account: { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr' },
  };
  // The Dossier's photo has a Version: it covers the « Photo » prerequisite.
  const documents = [{ id: 'doc_photo', kind: 'photo', title: 'Photo' }];
  const files: Row[] = [];
  let seq = 0;
  const db = {
    stanzyRequest: {
      findUnique: async ({ where }: { where: { id: string } }) => (where.id === request.id ? request : null),
      findMany: async () => [{ id: request.id }],
      update: async ({ data }: { data: Row }) => Object.assign(request, data),
    },
    dossier: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === dossier.id ? dossier : null) },
    dossierDocument: {
      findMany: async ({ where }: { where: { kind: { in: string[] } } }) => documents.filter((d) => where.kind.in.includes(d.kind)),
    },
    requirementFile: {
      findMany: async ({ where }: { where: { requestId: string } }) => files.filter((f) => f.requestId === where.requestId),
      findUnique: async ({ where }: { where: { id: string } }) => files.find((f) => f.id === where.id) ?? null,
      create: async ({ data }: { data: Row }) => {
        const row = { ...data, id: `req_file_${++seq}`, createdAt: new Date() };
        files.push(row);
        return { id: row.id };
      },
      delete: async ({ where }: { where: { id: string } }) => files.splice(files.findIndex((f) => f.id === where.id), 1)[0],
    },
  };
  return { db: db as unknown as TRPCContext['prisma'], request, dossier, files };
}

const consultant = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' });
const client = sessionFor({ id: 'acc_1', name: 'Aminata Diallo' });
const stranger = sessionFor({ id: 'acc_2', name: 'Bob Other' });
const callerFor = (db: TRPCContext['prisma'], session: CurrentSession) =>
  createCaller({ prisma: db, session, headers: new Headers() } as unknown as TRPCContext).documentServices.requirements;

const upload = (prerequisite: string) => ({
  requestId: 'stz_1',
  prerequisite,
  objectKey: 'requirements/stz_1/9a2b.bin',
  key: 'ZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTA=',
  iv: 'AAAAAAAAAAAAAAAA',
  fileName: 'plan.jpg',
  contentType: 'image/jpeg' as const,
  size: 1000,
});

describe('what the Client hands over for a service', () => {
  it('lists the questions and files still due, a Checklist document of the Dossier covering its kind', async () => {
    const { db } = fakeDatabase();
    const page = await callerFor(db, client).get({ requestId: 'stz_1' });
    expect(page.editable).toBe(true);
    expect(page.questionsLeft).toEqual(['niu', 'contacts', 'donation', 'ubaAccount']);
    expect(page.items.map((item) => [item.key, item.state])).toEqual([
      ['photo', 'inDossier'],
      ['signature', 'missing'],
      ['plan-de-localisation', 'missing'],
      ['bulletin-de-paie', 'missing'],
    ]);
    expect(page.complete).toBe(false);
  });

  it('is shared with the consultant, and no one else', async () => {
    const { db } = fakeDatabase();
    await expect(callerFor(db, consultant).get({ requestId: 'stz_1' })).resolves.toMatchObject({ dossier: { client: 'Aminata Diallo' } });
    await expect(callerFor(db, stranger).get({ requestId: 'stz_1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('saves the answers, a donor only with a gift, and then asks the donor’s photo', async () => {
    const { db, request } = fakeDatabase();
    const answers = {
      niu: 'M012345678901A',
      contacts: [{ name: 'Paul Mbarga', phone: '690000000' }],
      donation: false,
      donor: { name: 'Marie Ngo', email: 'marie@example.cm', phone: '690000001' },
      ubaAccount: true,
    };
    await callerFor(db, client).saveAnswers({ requestId: 'stz_1', answers });
    expect(request.answers).toMatchObject({ donation: false, donor: null, ubaAccount: true });
    await callerFor(db, client).saveAnswers({ requestId: 'stz_1', answers: { ...answers, donation: true } });
    const page = await callerFor(db, client).get({ requestId: 'stz_1' });
    expect(page.questionsLeft).toEqual([]);
    expect(page.items.at(-1)).toMatchObject({ key: 'photo-donateur', state: 'missing' });
  });

  it('records a file for one of the service’s prerequisites, under the request’s folder', async () => {
    storage.objectSize.mockResolvedValue(1016);
    const { db, files } = fakeDatabase();
    await callerFor(db, client).addFile(upload('plan-de-localisation'));
    expect(files).toEqual([
      expect.objectContaining({ requestId: 'stz_1', key: 'plan-de-localisation', fileName: 'plan.jpg', uploadedById: 'acc_1' }),
    ]);
    // Sealed with the master key, never stored as sent.
    expect(files[0]!.wrappedKey).not.toBe(upload('x').key);
    await expect(callerFor(db, client).addFile(upload('autre'))).rejects.toMatchObject({ message: 'REQUIREMENTS_UNKNOWN' });
  });

  it('removes a file handed over, and from R2', async () => {
    storage.objectSize.mockResolvedValue(1016);
    const { db, files } = fakeDatabase();
    const { id } = await callerFor(db, client).addFile(upload('signature'));
    await callerFor(db, client).removeFile({ id });
    expect(files).toEqual([]);
    expect(storage.deleteObjects).toHaveBeenCalledWith('private', ['requirements/stz_1/9a2b.bin']);
  });

  it('reads, without changes, once the request is no longer under way', async () => {
    const { db } = fakeDatabase('DECLINED');
    expect((await callerFor(db, client).get({ requestId: 'stz_1' })).editable).toBe(false);
    await expect(callerFor(db, client).addFile(upload('signature'))).rejects.toMatchObject({ message: 'REQUIREMENTS_CLOSED' });
  });

  it('refuses a file stored outside the request’s folder', async () => {
    const { db } = fakeDatabase();
    await expect(
      callerFor(db, client).addFile({ ...upload('signature'), objectKey: 'requirements/stz_other/9a2b.bin' }),
    ).rejects.toMatchObject({ message: 'DOCUMENT_FILE_INVALID' });
  });
});

/** Answers every question and hands over every missing file. */
async function handOverEverything(db: TRPCContext['prisma']) {
  storage.objectSize.mockResolvedValue(1016);
  const answers = { niu: 'M012345678901A', contacts: [{ name: 'Paul Mbarga', phone: '690000000' }], donation: false, donor: null, ubaAccount: true };
  await callerFor(db, client).saveAnswers({ requestId: 'stz_1', answers });
  for (const key of ['signature', 'plan-de-localisation', 'bulletin-de-paie']) await callerFor(db, client).addFile(upload(key));
}

describe('« Suivant », then the consultant’s confirmation', () => {
  it('refuses « Suivant » while something is left to hand over', async () => {
    const { db, request } = fakeDatabase();
    await expect(callerFor(db, client).submit({ requestId: 'stz_1' })).rejects.toMatchObject({ message: 'REQUIREMENTS_INCOMPLETE' });
    expect(request.submittedAt ?? null).toBeNull();
  });

  it('takes « Suivant » once everything is handed over, and tells the consultant', async () => {
    const { db, request } = fakeDatabase();
    await handOverEverything(db);
    await callerFor(db, client).submit({ requestId: 'stz_1' });
    expect(request.submittedAt).toBeInstanceOf(Date);
    expect((await callerFor(db, client).get({ requestId: 'stz_1' })).handOver).toBe('SUBMITTED');
    expect(notifications.notifyLater).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ kind: 'REQUIREMENTS_SUBMITTED', actorId: 'acc_1', recipients: 'CONSULTANTS', target: { dossierId: 'dos_1' } }),
    );
  });

  it('is confirmed by the consultant only, which tells the Client and locks the pieces for them', async () => {
    const { db, request } = fakeDatabase();
    await handOverEverything(db);
    await expect(callerFor(db, client).confirm({ requestId: 'stz_1' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await callerFor(db, consultant).confirm({ requestId: 'stz_1' });
    expect(request.confirmedAt).toBeInstanceOf(Date);
    expect(notifications.notifyLater).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ kind: 'REQUIREMENTS_CONFIRMED', actorId: 'acc_stanzy', recipients: ['acc_1'], target: { dossierId: 'dos_1' } }),
    );
    const page = await callerFor(db, client).get({ requestId: 'stz_1' });
    expect(page).toMatchObject({ handOver: 'CONFIRMED', editable: false });
    await expect(callerFor(db, client).addFile(upload('signature'))).rejects.toMatchObject({ message: 'REQUIREMENTS_CLOSED' });
    // The consultant can still fix what was handed over.
    expect((await callerFor(db, consultant).get({ requestId: 'stz_1' })).editable).toBe(true);
  });

  it('takes « Suivant » from the Client only', async () => {
    const { db } = fakeDatabase();
    await handOverEverything(db);
    await expect(callerFor(db, consultant).submit({ requestId: 'stz_1' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('confirms only what is complete', async () => {
    const { db, request } = fakeDatabase();
    await expect(callerFor(db, consultant).confirm({ requestId: 'stz_1' })).rejects.toMatchObject({ message: 'REQUIREMENTS_INCOMPLETE' });
    expect(request.confirmedAt ?? null).toBeNull();
  });

  it('goes back to the pieces when the Client removes one after « Suivant »', async () => {
    const { db, files } = fakeDatabase();
    await handOverEverything(db);
    await callerFor(db, client).submit({ requestId: 'stz_1' });
    await callerFor(db, client).removeFile({ id: files[0]!.id });
    expect((await callerFor(db, client).get({ requestId: 'stz_1' })).handOver).toBe('OPEN');
  });
});

describe('the Client’s services under way', () => {
  it('lists each, with what is left to hand over and where it stands', async () => {
    const { db } = fakeDatabase();
    expect(await callerFor(db, client).mine()).toEqual([
      expect.objectContaining({
        id: 'stz_1',
        dossierId: 'dos_1',
        service: { slug: pof.slug, name: pof.name },
        document: 'Lettre de la banque',
        hasRequirements: true,
        complete: false,
        handOver: 'OPEN',
      }),
    ]);
  });
});

describe('the services under way, for the consultant', () => {
  it('lists every one with its Client and its service, for the consultant only', async () => {
    const { db } = fakeDatabase();
    const services = createCaller({ prisma: db, session: consultant, headers: new Headers() } as unknown as TRPCContext)
      .documentServices.dashboard;
    expect(await services.underWay()).toEqual([
      expect.objectContaining({
        id: 'stz_1',
        client: 'Aminata Diallo',
        service: { slug: pof.slug, name: pof.name },
        handOver: 'OPEN',
      }),
    ]);
    const asClient = createCaller({ prisma: db, session: client, headers: new Headers() } as unknown as TRPCContext);
    await expect(asClient.documentServices.dashboard.underWay()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
