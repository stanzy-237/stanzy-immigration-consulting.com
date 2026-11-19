import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import type { InterestAnswers } from '@/features/accompagnement/lib/interest-schema';
import { fillNote, handoffValues, noteDocSchema, type NoteDoc } from '@/features/document-services/lib/handoff';
import { handoffEmail } from '@/features/document-services/lib/handoff-email';
import { answersOf, requirementFilePrefix, requirementFileUrl } from '@/features/document-services/lib/requirements';
import { requestFor, requirementsOf } from '@/features/document-services/server/requirements';
import { encryptedFileInput } from '@/features/dossiers/lib/document-schema';
import { versionFileUrl } from '@/features/dossiers/lib/upload-version';
import { acceptEncryptedUpload, deleteFiles, openEncryptedFile } from '@/features/dossiers/server/dossier-files';
import { doualaDay } from '@/features/notifications/lib/douala-days';
import { appMailer } from '@/server/email/app-mailer';
import type { TRPCContext } from '@/server/trpc/context';
import { consultantProcedure, createTRPCRouter } from '@/server/trpc/trpc';

type Db = TRPCContext['prisma'];

const id = z.string().min(1);
const requestRef = z.object({ requestId: id });
const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });
const text = (max: number) => z.string().trim().max(max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The partner a service's hand-off goes to, and the note's template (#148). */
export const partnerInput = z.object({
  serviceId: id,
  partnerName: text(120),
  partnerPhone: text(30),
  partnerEmail: text(200).refine((value) => value === '' || EMAIL.test(value), { message: 'HANDOFF_EMAIL_INVALID' }),
  template: noteDocSchema.nullable(),
  /** What the partner is usually paid (#158), whole FCFA, the start of each request's; null clears it, absent leaves it. */
  partnerPrice: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
});

/** The largest PDF the email takes: what mail servers accept as an attachment, with room to spare. */
export const HANDOFF_EMAIL_MAX_BYTES = 20 * 1024 * 1024;
/** Where the PDF to email waits, encrypted, until it is sent (then it is deleted). */
export const handoffFilePrefix = (requestId: string): string => `${requirementFilePrefix(requestId)}handoff/`;

const EMPTY_NOTE: NoteDoc = { type: 'doc', content: [{ type: 'paragraph' }] };
const nameIn = (name: unknown, locale: string): string => {
  const names = (name ?? {}) as Record<string, string>;
  return names[locale] ?? names.fr ?? '';
};

/** The request's service and its hand-off, for the consultant. */
async function handoffOf(db: Db, requestId: string) {
  const row = await db.stanzyRequest.findUnique({
    where: { id: requestId },
    select: {
      handoffNote: true,
      handoffSentAt: true,
      handoffSentTo: true,
      service: {
        select: { id: true, name: true, partnerName: true, partnerPhone: true, partnerEmail: true, handoffTemplate: true },
      },
    },
  });
  if (!row?.service) throw refuse('HANDOFF_NO_SERVICE');
  return { ...row, service: row.service };
}

/**
 * The hand-off to a service's partner (#148), the consultant's only: the
 * partner and the note's template per service; per request, the note
 * (from the template, its placeholders filled in from the Client's
 * details), the pieces handed over to send with it, and the email.
 */
export const handoffRouter = createTRPCRouter({
  partner: consultantProcedure.input(z.object({ serviceId: id })).query(async ({ ctx, input }) => {
    const service = await ctx.prisma.documentService.findUnique({
      where: { id: input.serviceId },
      select: { partnerName: true, partnerPhone: true, partnerEmail: true, partnerPrice: true, handoffTemplate: true },
    });
    if (!service) throw new TRPCError({ code: 'NOT_FOUND' });
    return { ...service, handoffTemplate: service.handoffTemplate as NoteDoc | null };
  }),

  savePartner: consultantProcedure.input(partnerInput).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.prisma.documentService.updateMany({
      where: { id: input.serviceId },
      data: {
        partnerName: input.partnerName || null,
        partnerPhone: input.partnerPhone || null,
        partnerEmail: input.partnerEmail || null,
        ...(input.partnerPrice === undefined ? {} : { partnerPrice: input.partnerPrice }),
        handoffTemplate: input.template === null ? Prisma.DbNull : (input.template as Prisma.InputJsonObject),
      },
    });
    if (count === 0) throw new TRPCError({ code: 'NOT_FOUND' });
  }),

  /** The note as saved, else the template filled in; the pieces to send; the partner; when it last went. */
  get: consultantProcedure.input(requestRef).query(async ({ ctx, input }) => {
    const found = await requestFor(ctx.prisma, ctx.session, input.requestId);
    const { dossier } = found;
    const [handoff, summary, interest] = await Promise.all([
      handoffOf(ctx.prisma, input.requestId),
      requirementsOf(ctx.prisma, found),
      ctx.prisma.interestRequest.findFirst({
        where: { accountId: dossier.accountId },
        orderBy: { createdAt: 'desc' },
        select: { answers: true },
      }),
    ]);
    const { service } = handoff;
    const values = handoffValues({
      client: { name: dossier.account.name, email: dossier.account.email },
      service: nameIn(service.name, dossier.account.locale),
      today: doualaDay(new Date()),
      interest: (interest?.answers ?? null) as Pick<InterestAnswers, 'progress' | 'work'> | null,
      request: answersOf(found.request.answers),
    });
    const template = service.handoffTemplate as NoteDoc | null;

    // A piece the Dossier's Checklist document covers goes with its Finale, else its latest Version.
    const documentIds = summary.items.flatMap((item) => (item.state === 'inDossier' && item.document ? [item.document.id] : []));
    const versions = documentIds.length
      ? await ctx.prisma.documentVersion.findMany({
          where: { documentId: { in: documentIds } },
          orderBy: { number: 'desc' },
          select: { id: true, documentId: true, fileName: true, contentType: true, finalOf: { select: { id: true } } },
        })
      : [];
    const pieces = summary.items.flatMap((item) => {
      const label = { fr: item.fr, en: item.en };
      if (item.state === 'given') {
        return item.files.map((file) => ({
          id: file.id,
          label,
          fileName: file.fileName,
          contentType: file.contentType,
          url: requirementFileUrl(file.id),
        }));
      }
      const own = versions.filter((version) => version.documentId === item.document?.id);
      const version = own.find((one) => one.finalOf) ?? own[0];
      return version
        ? [{ id: version.id, label, fileName: version.fileName, contentType: version.contentType, url: versionFileUrl(version.id) }]
        : [];
    });

    return {
      service: { id: service.id, name: service.name as Record<string, string> },
      partner: { name: service.partnerName, phone: service.partnerPhone, email: service.partnerEmail },
      note: (handoff.handoffNote as NoteDoc | null) ?? (template ? fillNote(template, values) : EMPTY_NOTE),
      saved: handoff.handoffNote !== null,
      hasTemplate: template !== null,
      values,
      pieces,
      sentAt: handoff.handoffSentAt,
      sentTo: handoff.handoffSentTo,
    };
  }),

  saveNote: consultantProcedure.input(requestRef.extend({ note: noteDocSchema.nullable() })).mutation(async ({ ctx, input }) => {
    await requestFor(ctx.prisma, ctx.session, input.requestId);
    // Null starts again from the template.
    await ctx.prisma.stanzyRequest.update({
      where: { id: input.requestId },
      data: { handoffNote: input.note === null ? Prisma.DbNull : (input.note as Prisma.InputJsonObject) },
    });
  }),

  /** Emails the PDF the consultant put together to the service's partner, then forgets it. */
  email: consultantProcedure
    .input(requestRef.extend({ file: encryptedFileInput }))
    .mutation(async ({ ctx, input }) => {
      const found = await requestFor(ctx.prisma, ctx.session, input.requestId);
      const { service } = await handoffOf(ctx.prisma, input.requestId);
      if (!service.partnerEmail) throw refuse('HANDOFF_NO_PARTNER_EMAIL');
      if (input.file.contentType !== 'application/pdf') throw refuse('DOCUMENT_FILE_TYPE');
      if (input.file.size > HANDOFF_EMAIL_MAX_BYTES) throw refuse('HANDOFF_TOO_LARGE');
      const wrappedKey = await acceptEncryptedUpload(input.file, handoffFilePrefix(input.requestId));
      try {
        const pdf = await openEncryptedFile({
          objectKey: input.file.objectKey,
          wrappedKey,
          iv: input.file.iv,
          fileName: input.file.fileName,
          contentType: input.file.contentType,
        });
        await appMailer.send(
          handoffEmail({
            to: service.partnerEmail,
            partner: service.partnerName,
            client: found.dossier.account.name,
            service: nameIn(service.name, 'fr'),
            pdf: Buffer.from(pdf),
            fileName: input.file.fileName,
          }),
        );
      } finally {
        await deleteFiles([input.file.objectKey]);
      }
      const sentAt = new Date();
      await ctx.prisma.stanzyRequest.update({
        where: { id: input.requestId },
        data: { handoffSentAt: sentAt, handoffSentTo: service.partnerEmail },
      });
      return { sentAt, sentTo: service.partnerEmail };
    }),
});
