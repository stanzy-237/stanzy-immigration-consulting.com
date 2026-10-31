import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { after } from 'next/server';
import { z } from 'zod';

import {
  addDocumentInput,
  addSectionInput,
  addVersionInput,
  commentInput,
  dossierRefInput,
  isDossierBlob,
  renameSectionInput,
  setFinalInput,
} from '@/features/dossiers/lib/document-schema';
import { excerptOf } from '@/features/dossiers/lib/dossier-emails';
import { finalesLocked } from '@/features/dossiers/lib/workflow';
import { deleteFiles, ENCRYPTED_FILE_MAX_BYTES, sealKey, storedSize } from '@/features/dossiers/server/dossier-files';
import { documentFor, dossierFor, isConsultant, sectionFor, writable } from '@/features/dossiers/server/dossier-access';
import { notifyClient, notifyConsultants } from '@/features/dossiers/server/dossier-notify';
import type { TRPCContext } from '@/server/trpc/context';
import { consultantProcedure, createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

const byId = z.object({ id: z.string().min(1) });
const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

type Db = TRPCContext['prisma'];

const person = { select: { name: true, role: true } } as const;

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
        documents: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            createdAt: true,
            finalVersionId: true,
            addedBy: person,
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
              },
            },
            comments: {
              orderBy: { createdAt: 'asc' },
              select: { id: true, body: true, createdAt: true, author: person },
            },
          },
        },
      },
    });
    return { open: dossier.state === 'OPEN', locked: finalesLocked(dossier.service, dossier.stage), sections };
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
    await ctx.prisma.dossierSection.update({ where: { id: section.id }, data: { title: input.title } });
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

  /** « J'ai ce document »: the Client or the consultant adds a Document, labelled with who added it. */
  addDocument: protectedProcedure.input(addDocumentInput).mutation(async ({ ctx, input }) => {
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
      select: { blobUrl: true },
    });
    await ctx.prisma.dossierDocument.delete({ where: { id: document.id } });
    after(() => deleteFiles(versions.map((version) => version.blobUrl)));
  }),

  /**
   * Records a file the browser encrypted and sent to Blob as the Document's
   * next Version. Refuses DOCUMENT_FILE_INVALID for a file outside the
   * Dossier's folder, missing, or not the size announced.
   */
  addVersion: protectedProcedure.input(addVersionInput).mutation(async ({ ctx, input }) => {
    const document = await documentFor(ctx.prisma, ctx.session, input.documentId);
    const { dossier } = document;
    writable(dossier);
    if (!isDossierBlob(input.blobUrl, dossier.id)) throw refuse('DOCUMENT_FILE_INVALID');
    const size = await storedSize(input.blobUrl);
    if (size === null || size > ENCRYPTED_FILE_MAX_BYTES || size !== input.size + 16) {
      throw refuse('DOCUMENT_FILE_INVALID');
    }
    let wrappedKey: string;
    try {
      wrappedKey = await sealKey(input.key);
    } catch {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'DOSSIER_FILES_UNCONFIGURED' });
    }

    const version = await nextVersion(ctx.prisma, document.id, {
      fileName: input.fileName,
      contentType: input.contentType,
      size: input.size,
      blobUrl: input.blobUrl,
      wrappedKey,
      iv: input.iv,
      uploadedById: ctx.session.account.id,
    });

    if (isConsultant(ctx.session)) {
      notifyClient(dossier.account, dossier.service, { kind: 'newVersion', document: document.title }, dossier.id);
    } else {
      notifyConsultants(dossier, dossier.account.name, { kind: 'clientUpload', document: document.title });
    }
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

  /** A message in the Document's thread; the other side is emailed. */
  comment: protectedProcedure.input(commentInput).mutation(async ({ ctx, input }) => {
    const document = await documentFor(ctx.prisma, ctx.session, input.documentId);
    const { dossier } = document;
    writable(dossier);
    const comment = await ctx.prisma.documentComment.create({
      data: { documentId: document.id, authorId: ctx.session.account.id, body: input.body },
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
    return comment;
  }),
});

/**
 * Saves the Document's next Version number. Two uploads at once can pick the
 * same number: the unique index refuses the second, which takes the next one.
 */
async function nextVersion(
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
