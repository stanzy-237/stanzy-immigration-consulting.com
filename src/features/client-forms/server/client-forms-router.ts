import type { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';

import {
  checkHistory,
  documentRef,
  EMPTY_FAMILY,
  EMPTY_HISTORY,
  familyMissing,
  isFormKind,
  saveFormInput,
  type Family,
  type PersonalHistory,
} from '@/features/client-forms/lib/form-schema';
import { documentFor, writable } from '@/features/dossiers/server/dossier-access';
import type { TRPCContext } from '@/server/trpc/context';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

type Db = TRPCContext['prisma'];

const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });

/** The Document's form kind, or NOT_A_FORM for a Document that is a file to upload. */
async function formKindOf(db: Db, documentId: string) {
  const row = await db.dossierDocument.findUniqueOrThrow({ where: { id: documentId }, select: { kind: true } });
  if (!isFormKind(row.kind)) throw refuse('NOT_A_FORM');
  return row.kind;
}

/**
 * « Renseignements du client » filled in here, the way IRCC asks (#79): the
 * Historique personnel et adresses, period by period with no gap over the
 * last 10 years (or since 18), and the Renseignements sur la famille. The
 * Dossier's Client fills them in, the consultant reads and corrects them;
 * each save records whether anything is missing.
 */
export const clientFormsRouter = createTRPCRouter({
  get: protectedProcedure.input(documentRef).query(async ({ ctx, input }) => {
    const document = await documentFor(ctx.prisma, ctx.session, input.documentId);
    const kind = await formKindOf(ctx.prisma, document.id);
    const form = await ctx.prisma.clientForm.findUnique({
      where: { documentId: document.id },
      select: { data: true, complete: true, updatedAt: true, updatedBy: { select: { name: true } } },
    });
    const empty = kind === 'personalHistory' ? EMPTY_HISTORY : EMPTY_FAMILY;
    return {
      document: { id: document.id, title: document.title, dossierId: document.dossier.id },
      kind,
      data: (form?.data ?? empty) as unknown as PersonalHistory | Family,
      complete: form?.complete ?? false,
      updatedAt: form?.updatedAt ?? null,
      updatedBy: form?.updatedBy.name ?? null,
      editable: document.dossier.state === 'OPEN',
    };
  }),

  /** Saves the form whole; the Document stops being « Manquant » once nothing is missing. */
  save: protectedProcedure.input(saveFormInput).mutation(async ({ ctx, input }) => {
    const document = await documentFor(ctx.prisma, ctx.session, input.documentId);
    writable(document.dossier);
    const kind = await formKindOf(ctx.prisma, document.id);
    if (kind !== input.kind) throw refuse('FORM_KIND_MISMATCH');
    const complete =
      input.kind === 'personalHistory'
        ? checkHistory(input.data, new Date()).complete
        : familyMissing(input.data).length === 0;
    const data = input.data as unknown as Prisma.InputJsonValue;
    await ctx.prisma.$transaction(async (tx) => {
      await tx.clientForm.upsert({
        where: { documentId: document.id },
        create: { documentId: document.id, kind, data, complete, updatedById: ctx.session.account.id },
        update: { data, complete, updatedById: ctx.session.account.id },
      });
      if (complete) await tx.dossierDocument.update({ where: { id: document.id }, data: { missing: false } });
    });
    return { complete };
  }),
});
