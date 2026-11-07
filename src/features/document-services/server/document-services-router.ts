import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { livesInCameroon } from '@/features/accompagnement/server/residence';
import { STARTER_SERVICES } from '@/features/document-services/data/starter-services';
import {
  addRequirementFileInput,
  requestRef,
  requirementFilePrefix,
  saveAnswersInput,
} from '@/features/document-services/lib/requirements';
import { prerequisitesOf, saveServiceInput, slugInput } from '@/features/document-services/lib/service-schema';
import { editableRequest, requestFor, requirementsOf } from '@/features/document-services/server/requirements';
import { acceptEncryptedUpload, deleteFiles } from '@/features/dossiers/server/dossier-files';
import { consultantProcedure, createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

const byId = z.object({ id: z.string().min(1) });
const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

/** What a Client reads of a service: everything but when it was written. */
const shown = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  provides: true,
  turnaround: true,
  conditions: true,
  contractTitle: true,
  contractBody: true,
  priceKind: true,
  price: true,
  unit: true,
  documentKinds: true,
  prerequisites: true,
  questionnaire: true,
} satisfies Prisma.DocumentServiceSelect;

/** A Document of the viewer's own open Dossier that Stanzy could get for them, with no request under way. */
async function askable(db: Db, accountId: string, documentId: string) {
  const document = await db.dossierDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      title: true,
      kind: true,
      finalVersionId: true,
      section: { select: { dossier: { select: { id: true, accountId: true, state: true } } } },
      stanzyRequests: { where: { status: { in: ['REQUESTED', 'ACCEPTED', 'ASSIGNED'] } }, select: { id: true } },
    },
  });
  const dossier = document?.section.dossier;
  if (!document || dossier?.accountId !== accountId || dossier.state !== 'OPEN') return null;
  if (document.finalVersionId || document.stanzyRequests.length > 0) return null;
  return { id: document.id, title: document.title, kind: document.kind, dossierId: dossier.id };
}

/**
 * Services documentaires (#80): the catalogue the consultant writes in the
 * Tableau de bord, prices included (they live here only), and the page
 * Clients in Cameroon read in « Mon espace », where « Stanzy s'en charge »
 * on a Document leads: its conditions, its contract and its price.
 */
export const documentServicesRouter = createTRPCRouter({
  dashboard: createTRPCRouter({
    /** Every service, in catalogue order, with how many requests each has had. */
    list: consultantProcedure.query(async ({ ctx }) =>
      (
        await ctx.prisma.documentService.findMany({
          orderBy: { position: 'asc' },
          select: { ...shown, active: true, updatedAt: true, _count: { select: { requests: true } } },
        })
      ).map((service) => ({ ...service, prerequisites: prerequisitesOf(service.prerequisites) })),
    ),

    get: consultantProcedure.input(byId).query(async ({ ctx, input }) => {
      const service = await ctx.prisma.documentService.findUnique({
        where: { id: input.id },
        select: { ...shown, active: true },
      });
      if (!service) throw notFound();
      return { ...service, prerequisites: prerequisitesOf(service.prerequisites) };
    }),

    /** Adds a service at the end of the catalogue, or saves one. SERVICE_SLUG_TAKEN when its address is another's. */
    save: consultantProcedure.input(saveServiceInput).mutation(async ({ ctx, input }) => {
      try {
        if (input.id) {
          return await ctx.prisma.documentService.update({ where: { id: input.id }, data: input.service, select: { id: true } });
        }
        const last = await ctx.prisma.documentService.findFirst({ orderBy: { position: 'desc' }, select: { position: true } });
        return await ctx.prisma.documentService.create({
          data: { ...input.service, position: (last?.position ?? 0) + 1 },
          select: { id: true },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw refuse('SERVICE_SLUG_TAKEN');
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw notFound();
        throw error;
      }
    }),

    /** Adds the starting services the catalogue lacks: inactive and priced 0, for the consultant to price. */
    addStarters: consultantProcedure.mutation(async ({ ctx }) => {
      const existing = await ctx.prisma.documentService.findMany({ select: { slug: true, position: true } });
      const taken = new Set(existing.map((service) => service.slug));
      let position = Math.max(0, ...existing.map((service) => service.position));
      const missing = STARTER_SERVICES.filter((service) => !taken.has(service.slug));
      if (missing.length > 0) {
        await ctx.prisma.documentService.createMany({
          data: missing.map((service) => ({ ...service, active: false, price: 0, position: ++position })),
        });
      }
      return { added: missing.length };
    }),
  }),

  /**
   * The catalogue for a Client: the active services with their prices, in
   * Cameroon only (`available`); the consultant sees it as they would.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const available =
      ctx.session.account.role === 'CONSULTANT' || (await livesInCameroon(ctx.prisma, ctx.session.account.id));
    if (!available) return { available, services: [] };
    const services = await ctx.prisma.documentService.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
      select: shown,
    });
    return { available, services };
  }),

  /**
   * One active service's page: its conditions, contract and price; with
   * `documentId`, the Document of the viewer's own Dossier it would get (when
   * Stanzy can still take it on), for « Stanzy s'en charge ».
   */
  get: protectedProcedure
    .input(slugInput.extend({ documentId: z.string().min(1).nullable() }))
    .query(async ({ ctx, input }) => {
      const service = await ctx.prisma.documentService.findFirst({ where: { slug: input.slug, active: true }, select: shown });
      if (!service) throw notFound();
      const { account } = ctx.session;
      const available = account.role === 'CONSULTANT' || (await livesInCameroon(ctx.prisma, account.id));
      if (!available) return { available, service: null, document: null, inDossier: null };
      const document = input.documentId ? await askable(ctx.prisma, account.id, input.documentId) : null;
      const prerequisites = prerequisitesOf(service.prerequisites);
      // Coming from a Document: the Checklist documents of that Dossier that already cover a prerequisite.
      const kinds = prerequisites.flatMap((item) => (item.kind ? [item.kind] : []));
      const held =
        document && kinds.length > 0
          ? await ctx.prisma.dossierDocument.findMany({
              where: { section: { dossierId: document.dossierId }, kind: { in: kinds }, versions: { some: {} } },
              select: { kind: true },
            })
          : [];
      const inDossier = prerequisites.map((item) => held.some((found) => item.kind !== null && found.kind === item.kind));
      return { available, service: { ...service, prerequisites }, document, inDossier: document ? inDossier : null };
    }),

  /**
   * What the Client hands over for a « Stanzy s'en charge » request: the
   * service's questionnaire and prerequisite files, shared with the
   * consultant (and the Partner in charge, #42), never Dossier Documents.
   */
  requirements: createTRPCRouter({
    get: protectedProcedure.input(requestRef).query(async ({ ctx, input }) => {
      const found = await requestFor(ctx.prisma, ctx.session, input.requestId);
      const { request, dossier, editable } = found;
      return {
        request: {
          id: request.id,
          status: request.status,
          createdAt: request.createdAt,
          document: { id: request.document.id, title: request.document.title },
          service: request.service ? { slug: request.service.slug, name: request.service.name } : null,
        },
        dossier: { id: dossier.id, client: dossier.account.name },
        editable,
        ...(await requirementsOf(ctx.prisma, found)),
      };
    }),

    /** Saves the questionnaire as it stands, answered or not yet. */
    saveAnswers: protectedProcedure.input(saveAnswersInput).mutation(async ({ ctx, input }) => {
      const { request } = await editableRequest(ctx.prisma, ctx.session, input.requestId);
      if (!request.service?.questionnaire) throw refuse('REQUIREMENTS_NO_QUESTIONNAIRE');
      const { answers } = input;
      await ctx.prisma.stanzyRequest.update({
        where: { id: request.id },
        // No donor without a donation; the UBA question only for the « sans fonds » service.
        data: {
          answers: {
            ...answers,
            donor: answers.donation ? answers.donor : null,
            ubaAccount: request.service.questionnaire === 'proofOfFundsNoFunds' ? answers.ubaAccount : null,
          },
        },
      });
    }),

    /** Records a file the browser encrypted and stored for one of the prerequisites (any photo or PDF). */
    addFile: protectedProcedure.input(addRequirementFileInput).mutation(async ({ ctx, input }) => {
      const { request } = await editableRequest(ctx.prisma, ctx.session, input.requestId);
      if (!prerequisitesOf(request.service?.prerequisites).some((item) => item.key === input.prerequisite)) {
        throw refuse('REQUIREMENTS_UNKNOWN');
      }
      const wrappedKey = await acceptEncryptedUpload(input, requirementFilePrefix(request.id));
      return ctx.prisma.requirementFile.create({
        data: {
          requestId: request.id,
          key: input.prerequisite,
          fileName: input.fileName,
          contentType: input.contentType,
          size: input.size,
          objectKey: input.objectKey,
          wrappedKey,
          iv: input.iv,
          uploadedById: ctx.session.account.id,
        },
        select: { id: true },
      });
    }),

    /** Removes a file handed over, and from R2. */
    removeFile: protectedProcedure
      .input(byId)
      .mutation(async ({ ctx, input }) => {
        const file = await ctx.prisma.requirementFile.findUnique({
          where: { id: input.id },
          select: { id: true, requestId: true, objectKey: true },
        });
        if (!file) throw notFound();
        await editableRequest(ctx.prisma, ctx.session, file.requestId);
        await ctx.prisma.requirementFile.delete({ where: { id: file.id } });
        await deleteFiles([file.objectKey]).catch(() => undefined);
      }),
  }),
});
