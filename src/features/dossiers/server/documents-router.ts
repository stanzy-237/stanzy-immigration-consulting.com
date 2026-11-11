import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { after } from 'next/server';
import { z } from 'zod';

import { DOCUMENT_GUIDES } from '@/features/checklist/data/document-guides';
import type { DocumentId } from '@/features/checklist/lib/build-checklist';

import {
  addDocumentInput,
  addSectionInput,
  addVersionInput,
  commentInput,
  deleteCommentInput,
  editCommentInput,
  dossierFilePrefix,
  dossierRefInput,
  renameSectionInput,
  sectionConcernsInput,
  setFinalInput,
} from '@/features/dossiers/lib/document-schema';
import { excerptOf } from '@/features/dossiers/lib/dossier-emails';
import { finalesLocked } from '@/features/dossiers/lib/workflow';
import { acceptEncryptedUpload, deleteFiles } from '@/features/dossiers/server/dossier-files';
import { documentFor, dossierFor, isConsultant, sectionFor, writable } from '@/features/dossiers/server/dossier-access';
import { notifyClient, notifyConsultants } from '@/features/dossiers/server/dossier-notify';
import { livesInCameroon } from '@/features/accompagnement/server/residence';
import { forgetComment, notifyLater } from '@/features/notifications/server/notify';
import { routing, type Locale } from '@/i18n/routing';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { consultantProcedure, createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

const byId = z.object({ id: z.string().min(1) });

/** Sections take the Client's concerns in an Accompagnement Dossier (#149). */
const concernsOffered = (service: string): boolean => service === 'ACCOMPAGNEMENT';
const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

type Db = TRPCContext['prisma'];

const person = { select: { name: true, role: true } } as const;

type Titles = Record<Locale, string>;

/** A Checklist document's name in each language; null for one the consultant named. */
function titlesOf(kind: string | null): Titles | null {
  if (!kind || !(kind in DOCUMENT_GUIDES.fr)) return null;
  return Object.fromEntries(
    routing.locales.map((locale) => [locale, DOCUMENT_GUIDES[locale][kind as DocumentId].name]),
  ) as Titles;
}

/**
 * A Dossier's Sections IRCC, Documents, Versions and comments (GLOSSARY:
 * Section IRCC, Document, Version). The Client and the consultant both add
 * Documents, upload Versions and comment; the consultant alone shapes the
 * Sections, deletes Documents and picks the Finales. Files are encrypted
 * (ADR 0007): this router never hands out their address or key.
 */
export const documentsRouter = createTRPCRouter({
  /** Everything in the Dossier's Sections, with whether it can still change (`open`) and whether the Finales are `locked`. */
  sections: protectedProcedure.input(dossierRefInput).query(async ({ ctx, input }) => {
    const dossier = await dossierFor(ctx.prisma, ctx.session, input.dossierId);
    const sections = await ctx.prisma.dossierSection.findMany({
      where: { dossierId: dossier.id },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        title: true,
        titles: true,
        concerns: true,
        concernsUpdatedAt: true,
        documents: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            createdAt: true,
            finalVersionId: true,
            addedBy: person,
            // Made from the Demande d'intérêt (#81): its Checklist document, ★ need, « Manquant », the Client's note.
            kind: true,
            need: true,
            missing: true,
            clientNote: true,
            /** For a form Document (Historique personnel, Famille): whether it is filled in (#79). */
            clientForm: { select: { complete: true, updatedAt: true } },
            /** The latest « Stanzy s'en charge » request on it, if any. */
            stanzyRequests: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              // Whether a service gets it: the Client then sees « Voir le service » on the Document.
              select: { id: true, status: true, declineNote: true, service: { select: { id: true } } },
            },
            versions: {
              orderBy: { number: 'asc' },
              select: {
                id: true,
                number: true,
                fileName: true,
                contentType: true,
                size: true,
                createdAt: true,
                uploadedBy: person,
                /** The Demande de signature this Version is the signed PDF of (#96). */
                signedFor: { select: { id: true } },
              },
            },
            /** The Demande de signature waiting, if any (#96). */
            signatures: { where: { status: 'PENDING' }, select: { id: true, versionId: true }, take: 1 },
            comments: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                parentId: true,
                body: true,
                createdAt: true,
                editedAt: true,
                deletedAt: true,
                author: { select: { id: true, name: true, role: true } },
              },
            },
          },
        },
      },
    });
    return {
      /** Who is looking: their own comments can be edited, and what they add shows under their name at once. */
      viewer: { id: ctx.session.account.id, name: ctx.session.account.name, role: ctx.session.account.role },
      open: dossier.state === 'OPEN',
      locked: finalesLocked(dossier.service, dossier.stage),
      /** The Client may ask « Stanzy s'en charge » on a missing Document: in Cameroon only. */
      stanzy: !isConsultant(ctx.session) && (await livesInCameroon(ctx.prisma, dossier.accountId)),
      /** Whether each Section takes the Client's concerns (#149): Accompagnement Dossiers. */
      concerns: concernsOffered(dossier.service),
      // A deleted comment keeps its place in the conversation, not its words.
      // Made from the Checklist, a Section and its Documents are named in each language (`titles`).
      sections: sections.map((section) => ({
        ...section,
        titles: section.titles as Titles | null,
        documents: section.documents.map((document) => ({
          ...document,
          titles: titlesOf(document.kind),
          comments: document.comments.map((comment) => (comment.deletedAt ? { ...comment, body: '' } : comment)),
        })),
      })),
    };
  }),

  /** A Section at the end of the Dossier's list. */
  addSection: consultantProcedure.input(addSectionInput).mutation(async ({ ctx, input }) => {
    const dossier = await dossierFor(ctx.prisma, ctx.session, input.dossierId);
    writable(dossier);
    const last = await ctx.prisma.dossierSection.findFirst({
      where: { dossierId: dossier.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return ctx.prisma.dossierSection.create({
      data: { dossierId: dossier.id, title: input.title, position: (last?.position ?? 0) + 1 },
      select: { id: true },
    });
  }),

  renameSection: consultantProcedure.input(renameSectionInput).mutation(async ({ ctx, input }) => {
    const section = await sectionFor(ctx.prisma, ctx.session, input.id);
    writable(section.dossier);
    await ctx.prisma.dossierSection.update({ where: { id: section.id }, data: { title: input.title, titles: Prisma.DbNull } });
  }),

  /**
   * The Client's concerns about a Section (#149): what they think may be an
   * error or a problem for them there, for a later letter of explanation.
   * Theirs alone to write; the consultant reads them. Empty clears them.
   */
  setSectionConcerns: protectedProcedure.input(sectionConcernsInput).mutation(async ({ ctx, input }) => {
    const section = await sectionFor(ctx.prisma, ctx.session, input.id);
    if (isConsultant(ctx.session)) throw refuse('CONCERNS_CLIENT_ONLY');
    writable(section.dossier);
    if (!concernsOffered(section.dossier.service)) throw refuse('CONCERNS_NOT_OFFERED');
    const concerns = input.concerns || null;
    await ctx.prisma.dossierSection.update({
      where: { id: section.id },
      data: { concerns, concernsUpdatedAt: concerns ? new Date() : null },
    });
  }),

  /** Only an empty Section: DOSSIER_SECTION_NOT_EMPTY otherwise, so no file goes with it by accident. */
  deleteSection: consultantProcedure.input(byId).mutation(async ({ ctx, input }) => {
    const section = await sectionFor(ctx.prisma, ctx.session, input.id);
    writable(section.dossier);
    if ((await ctx.prisma.dossierDocument.count({ where: { sectionId: section.id } })) > 0) {
      throw refuse('DOSSIER_SECTION_NOT_EMPTY');
    }
    await ctx.prisma.dossierSection.delete({ where: { id: section.id } });
  }),

  /** The consultant only: Stanzy decides what a Dossier holds; the Client uploads Versions to it. */
  addDocument: consultantProcedure.input(addDocumentInput).mutation(async ({ ctx, input }) => {
    const section = await sectionFor(ctx.prisma, ctx.session, input.sectionId);
    writable(section.dossier);
    return ctx.prisma.dossierDocument.create({
      data: { sectionId: section.id, title: input.title, addedById: ctx.session.account.id },
      select: { id: true },
    });
  }),

  /** The consultant only; its Versions and comments go with it, and its files leave Blob. */
  deleteDocument: consultantProcedure.input(byId).mutation(async ({ ctx, input }) => {
    const document = await documentFor(ctx.prisma, ctx.session, input.id);
    writable(document.dossier);
    const versions = await ctx.prisma.documentVersion.findMany({
      where: { documentId: document.id },
      select: { objectKey: true },
    });
    await ctx.prisma.dossierDocument.delete({ where: { id: document.id } });
    after(() => deleteFiles(versions.map((version) => version.objectKey)));
  }),

  /**
   * Records a file the browser encrypted and sent to R2 as the Document's
   * next Version. Refuses DOCUMENT_FILE_INVALID for a file outside the
   * Dossier's folder, missing, or not the size announced.
   */
  addVersion: protectedProcedure.input(addVersionInput).mutation(async ({ ctx, input }) => {
    const document = await documentFor(ctx.prisma, ctx.session, input.documentId);
    const { dossier } = document;
    writable(dossier);
    const wrappedKey = await acceptEncryptedUpload(input, dossierFilePrefix(dossier.id));

    const version = await nextVersion(ctx.prisma, document.id, {
      fileName: input.fileName,
      contentType: input.contentType,
      size: input.size,
      objectKey: input.objectKey,
      wrappedKey,
      iv: input.iv,
      uploadedById: ctx.session.account.id,
    });

    if (isConsultant(ctx.session)) {
      notifyClient(dossier.account, dossier.service, { kind: 'newVersion', document: document.title }, dossier.id);
    } else {
      notifyConsultants(dossier, dossier.account.name, { kind: 'clientUpload', document: document.title });
    }
    notifyLater(ctx.prisma, {
      kind: 'VERSION_UPLOADED',
      actorId: ctx.session.account.id,
      recipients: isConsultant(ctx.session) ? [dossier.accountId] : 'CONSULTANTS',
      target: { dossierId: dossier.id, documentId: document.id },
    });
    return version;
  }),

  /** The consultant marks a Version Finale (or none); DOSSIER_FINALES_LOCKED once the Dossier passed its lock stage. */
  setFinal: consultantProcedure.input(setFinalInput).mutation(async ({ ctx, input }) => {
    const document = await documentFor(ctx.prisma, ctx.session, input.documentId);
    writable(document.dossier);
    if (finalesLocked(document.dossier.service, document.dossier.stage)) throw refuse('DOSSIER_FINALES_LOCKED');
    if (input.versionId) {
      const version = await ctx.prisma.documentVersion.findFirst({
        where: { id: input.versionId, documentId: document.id },
        select: { id: true },
      });
      if (!version) throw notFound();
    }
    await ctx.prisma.dossierDocument.update({
      where: { id: document.id },
      data: { finalVersionId: input.versionId },
    });
  }),

  /**
   * A message in the Document's conversation, or a reply (`parentId`); a
   * reply to a reply joins its comment, so threads stay one level deep. The
   * other side is emailed.
   */
  comment: protectedProcedure.input(commentInput).mutation(async ({ ctx, input }) => {
    const document = await documentFor(ctx.prisma, ctx.session, input.documentId);
    const { dossier } = document;
    writable(dossier);
    let parentId: string | null = null;
    if (input.parentId) {
      const parent = await ctx.prisma.documentComment.findFirst({
        where: { id: input.parentId, documentId: document.id },
        select: { id: true, parentId: true },
      });
      if (!parent) throw notFound();
      parentId = parent.parentId ?? parent.id;
    }
    const comment = await ctx.prisma.documentComment.create({
      data: { documentId: document.id, parentId, authorId: ctx.session.account.id, body: input.body },
      select: { id: true },
    });
    const excerpt = excerptOf(input.body);
    if (isConsultant(ctx.session)) {
      notifyClient(
        dossier.account,
        dossier.service,
        { kind: 'comment', document: document.title, excerpt },
        dossier.id,
      );
    } else {
      notifyConsultants(dossier, dossier.account.name, { kind: 'clientComment', document: document.title, excerpt });
    }
    notifyLater(ctx.prisma, {
      kind: 'MESSAGE_POSTED',
      actorId: ctx.session.account.id,
      recipients: isConsultant(ctx.session) ? [dossier.accountId] : 'CONSULTANTS',
      target: { dossierId: dossier.id, documentId: document.id, commentId: comment.id },
    });
    return comment;
  }),

  /** Its author rewrites a comment; it shows « modifié ». COMMENT_NOT_YOURS for anyone else's. */
  editComment: protectedProcedure.input(editCommentInput).mutation(async ({ ctx, input }) => {
    const comment = await commentFor(ctx.prisma, ctx.session, input.id);
    if (comment.authorId !== ctx.session.account.id) throw refuse('COMMENT_NOT_YOURS');
    await ctx.prisma.documentComment.update({
      where: { id: comment.id },
      data: { body: input.body, editedAt: new Date() },
    });
  }),

  /**
   * Its author, or the consultant, deletes a comment. One with replies stays
   * as « Commentaire supprimé » so the replies still read; once its last
   * reply goes, it goes too.
   */
  deleteComment: protectedProcedure.input(deleteCommentInput).mutation(async ({ ctx, input }) => {
    const comment = await commentFor(ctx.prisma, ctx.session, input.id);
    if (comment.authorId !== ctx.session.account.id && !isConsultant(ctx.session)) throw refuse('COMMENT_NOT_YOURS');
    await ctx.prisma.$transaction(async (tx) => {
      if ((await tx.documentComment.count({ where: { parentId: comment.id } })) > 0) {
        await tx.documentComment.update({ where: { id: comment.id }, data: { deletedAt: new Date(), body: '' } });
        await forgetComment(tx as Db, comment.id);
        return;
      }
      await tx.documentComment.delete({ where: { id: comment.id } });
      if (comment.parentId) {
        const parent = await tx.documentComment.findUnique({
          where: { id: comment.parentId },
          select: { deletedAt: true, _count: { select: { replies: true } } },
        });
        if (parent?.deletedAt && parent._count.replies === 0) {
          await tx.documentComment.delete({ where: { id: comment.parentId } });
        }
      }
    });
  }),
});

/** A comment still in the conversation, in a Dossier `session` reaches and that is still open. */
async function commentFor(prisma: Db, session: CurrentSession, id: string) {
  const comment = await prisma.documentComment.findUnique({
    where: { id },
    select: { id: true, documentId: true, parentId: true, authorId: true, deletedAt: true },
  });
  if (!comment || comment.deletedAt) throw notFound();
  const { dossier } = await documentFor(prisma, session, comment.documentId);
  writable(dossier);
  return comment;
}

/**
 * Saves the Document's next Version number. Two uploads at once can pick the
 * same number: the unique index refuses the second, which takes the next one.
 */
export async function nextVersion(
  prisma: Db,
  documentId: string,
  data: Omit<Prisma.DocumentVersionUncheckedCreateInput, 'documentId' | 'number'>,
): Promise<{ id: string; number: number }> {
  for (let attempt = 0; ; attempt++) {
    const last = await prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    try {
      return await prisma.documentVersion.create({
        data: { ...data, documentId, number: (last?.number ?? 0) + 1 },
        select: { id: true, number: true },
      });
    } catch (error) {
      const taken = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!taken || attempt >= 2) throw error;
    }
  }
}
