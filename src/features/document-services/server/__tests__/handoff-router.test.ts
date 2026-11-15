import { describe, expect, it, vi } from 'vitest';

import { STARTER_SERVICES } from '@/features/document-services/data/starter-services';
import type { NoteDoc } from '@/features/document-services/lib/handoff';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const files = vi.hoisted(() => ({
  acceptEncryptedUpload: vi.fn(async () => 'wrapped'),
  openEncryptedFile: vi.fn(async () => new Uint8Array([37, 80, 68, 70]).buffer),
  deleteFiles: vi.fn(async () => undefined),
}));
vi.mock('@/features/dossiers/server/dossier-files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/dossiers/server/dossier-files')>()),
  ...files,
}));
const mailer = vi.hoisted(() => ({ appMailer: { send: vi.fn(async () => undefined) } }));
vi.mock('@/server/email/app-mailer', () => mailer);

type Row = Record<string, unknown> & { id: string };

const pof = STARTER_SERVICES.find((service) => service.slug === 'preuve-de-fonds')!;
const template: NoteDoc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: '{client}, chez {entreprise} depuis le {date_premier_emploi}.' }] }],
};

/**
 * Seam: `documentServices.handoff` through a server-side caller, over an
 * in-memory stand-in for one request, its service, Dossier, Demande
 * d'intérêt and files; R2 and the mailer stubbed.
 */
function fakeDatabase() {
  const service: Row = {
    id: 'svc_pof',
    name: pof.name,
    partnerName: 'Banque Atlantique',
    partnerPhone: '+237 690 00 00 00',
    partnerEmail: 'dossiers@banque.cm',
    handoffTemplate: template,
  };
  const request: Row = {
    id: 'stz_1',
    status: 'ACCEPTED',
    answers: { niu: 'M012345678901A', contacts: [], donation: false, donor: null, ubaAccount: null },
    createdAt: new Date('2026-11-07T10:00:00Z'),
    handoffNote: null,
    handoffSentAt: null,
    handoffSentTo: null,
    document: { id: 'doc_bank', title: 'Lettre de la banque', section: { dossierId: 'dos_1' } },
    service: { ...pof, ...service },
  };
  const dossier = {
    id: 'dos_1',
    service: 'ACCOMPAGNEMENT',
    stage: 'DOCUMENTS',
    state: 'OPEN',
    accountId: 'acc_1',
    account: { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr' },
  };
  const handed: Row[] = [
    { id: 'file_plan', requestId: 'stz_1', key: 'plan-de-localisation', fileName: 'plan.jpg', contentType: 'image/jpeg', size: 10, createdAt: new Date() },
  ];
  const db = {
    stanzyRequest: {
      findUnique: async ({ where }: { where: { id: string } }) => (where.id === request.id ? request : null),
      update: async ({ data }: { data: Row }) => Object.assign(request, data),
    },
    documentService: {
      findUnique: async ({ where }: { where: { id: string } }) => (where.id === service.id ? service : null),
      updateMany: async ({ where, data }: { where: { id: string }; data: Row }) => {
        if (where.id !== service.id) return { count: 0 };
        Object.assign(service, data);
        return { count: 1 };
      },
    },
    dossier: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === dossier.id ? dossier : null) },
    // The Dossier's photo has a Version, its Finale: it covers the « Photo » prerequisite.
    dossierDocument: { findMany: async () => [{ id: 'doc_photo', kind: 'photo', title: 'Photo' }] },
    documentVersion: {
      findMany: async () => [
        { id: 'ver_2', documentId: 'doc_photo', fileName: 'photo-2.jpg', contentType: 'image/jpeg', finalOf: null },
        { id: 'ver_1', documentId: 'doc_photo', fileName: 'photo.jpg', contentType: 'image/jpeg', finalOf: { id: 'doc_photo' } },
      ],
    },
    requirementFile: { findMany: async () => handed },
    interestRequest: {
      findFirst: async () => ({
        answers: {
          progress: { citizenship: 'Camerounaise' },
          work: {
            phone: '+237 692 24 53 94',
            experiences: [{ title: 'Comptable', company: 'Brasseries du Cameroun', cnp: '11100', startOn: '2019-03-01', endOn: null }],
          },
        },
      }),
    },
  };
  return { db: db as unknown as TRPCContext['prisma'], request, service };
}

const consultant = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' });
const client = sessionFor({ id: 'acc_1', name: 'Aminata Diallo' });
const callerFor = (db: TRPCContext['prisma'], session: CurrentSession) =>
  createCaller({ prisma: db, session, headers: new Headers() } as unknown as TRPCContext).documentServices.handoff;

const pdf = {
  objectKey: 'requirements/stz_1/handoff/9a2b.bin',
  key: 'ZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTA=',
  iv: 'AAAAAAAAAAAAAAAA',
  fileName: 'preuve-de-fonds-aminata.pdf',
  contentType: 'application/pdf' as const,
  size: 4,
};

describe('the hand-off to the partner (#148)', () => {
  it('starts the note from the service’s template, filled in, with the pieces handed over and the Dossier’s Finale', async () => {
    const { db } = fakeDatabase();
    const handoff = await callerFor(db, consultant).get({ requestId: 'stz_1' });
    expect(handoff.partner).toEqual({ name: 'Banque Atlantique', phone: '+237 690 00 00 00', email: 'dossiers@banque.cm' });
    expect(handoff.saved).toBe(false);
    expect(handoff.note.content![0]!.content![0]!.text).toBe('Aminata Diallo, chez Brasseries du Cameroun depuis le 01/03/2019.');
    expect(handoff.pieces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ver_1', fileName: 'photo.jpg', url: '/api/dossiers/files/ver_1' }),
        expect.objectContaining({ id: 'file_plan', fileName: 'plan.jpg', url: '/api/requirements/files/file_plan' }),
      ]),
    );
  });

  it('keeps the note as the consultant saves it, and starts again from the template on request', async () => {
    const { db, request } = fakeDatabase();
    const note: NoteDoc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Urgent.' }] }] };
    await callerFor(db, consultant).saveNote({ requestId: 'stz_1', note });
    expect(await callerFor(db, consultant).get({ requestId: 'stz_1' })).toMatchObject({ saved: true, note });
    await callerFor(db, consultant).saveNote({ requestId: 'stz_1', note: null });
    expect(request.handoffNote).not.toBe(note);
  });

  it('sets the partner and the template per service, refusing a wrong email', async () => {
    const { db, service } = fakeDatabase();
    await callerFor(db, consultant).savePartner({
      serviceId: 'svc_pof',
      partnerName: 'UBA',
      partnerPhone: '',
      partnerEmail: 'pof@uba.cm',
      template: null,
    });
    expect(service).toMatchObject({ partnerName: 'UBA', partnerPhone: null, partnerEmail: 'pof@uba.cm' });
    await expect(
      callerFor(db, consultant).savePartner({ serviceId: 'svc_pof', partnerName: '', partnerPhone: '', partnerEmail: 'uba', template: null }),
    ).rejects.toThrow();
  });

  it('emails the PDF to the partner, then forgets it', async () => {
    const { db, request } = fakeDatabase();
    const sent = await callerFor(db, consultant).email({ requestId: 'stz_1', file: pdf });
    expect(mailer.appMailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'dossiers@banque.cm',
        subject: 'Preuve de fonds (vous avez les fonds) – Aminata Diallo',
        attachments: [expect.objectContaining({ filename: 'preuve-de-fonds-aminata.pdf' })],
      }),
    );
    expect(files.deleteFiles).toHaveBeenCalledWith([pdf.objectKey]);
    expect(request).toMatchObject({ handoffSentTo: 'dossiers@banque.cm', handoffSentAt: sent.sentAt });
    await expect(callerFor(db, consultant).email({ requestId: 'stz_1', file: { ...pdf, size: 21 * 1024 * 1024 } })).rejects.toMatchObject({
      message: 'HANDOFF_TOO_LARGE',
    });
  });

  it('is the consultant’s only', async () => {
    const { db } = fakeDatabase();
    await expect(callerFor(db, client).get({ requestId: 'stz_1' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
