import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { transitionAccountStatus } from '@/features/auth/server/account-status';
import {
  accountSearchInput,
  closeDossierInput,
  dossierListInput,
  moveDossierInput,
  openDossierInput,
} from '@/features/dossiers/lib/dossier-schema';
import { isStageOf, nextStage, previousStage } from '@/features/dossiers/lib/workflow';
import { notifyClient } from '@/features/dossiers/server/dossier-notify';
import type { TRPCContext } from '@/server/trpc/context';
import {
  consultantProcedure,
  createTRPCRouter,
  protectedProcedure,
} from '@/server/trpc/trpc';

const byId = z.object({ id: z.string().min(1) });
const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

const client = { select: { id: true, name: true, email: true, locale: true } } as const;

const summary = {
  id: true,
  service: true,
  stage: true,
  startStage: true,
  state: true,
  closedAt: true,
  closedReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

type Db = TRPCContext['prisma'];

/** An open Dossier at `from`, or the reason it can't move. */
async function openAt(prisma: Db, id: string, from: string) {
  const dossier = await prisma.dossier.findUnique({ where: { id }, include: { account: client } });
  if (!dossier) throw notFound();
  if (dossier.state !== 'OPEN') throw refuse('DOSSIER_CLOSED');
  if (dossier.stage !== from) throw refuse('DOSSIER_STAGE_CHANGED');
  return dossier;
}

/**
 * Moves an open Dossier from `from` to `to` and records who did it. The save
 * only matches `from`, so two clicks (or two tabs) can't move it twice.
 */
async function move(
  prisma: Db,
  actorId: string,
  dossier: { id: string; stage: string },
  to: string,
  kind: 'ADVANCED' | 'MOVED_BACK',
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.dossier.updateMany({
      where: { id: dossier.id, stage: dossier.stage, state: 'OPEN' },
      data: { stage: to },
    });
    if (count === 0) throw refuse('DOSSIER_STAGE_CHANGED');
    await tx.dossierEvent.create({
      data: { dossierId: dossier.id, kind, fromStage: dossier.stage, toStage: to, actorId },
    });
  });
}

/**
 * Dossiers (GLOSSARY: Dossier, Workflow de service). The consultant opens a
 * Dossier for an Account, which makes it a Client, and moves it through its
 * service's stages by hand; the Client reads their own in « Mon espace ».
 */
export const dossiersRouter = createTRPCRouter({
  /** The signed-in Account's Dossiers, newest first. */
  mine: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.dossier.findMany({
      where: { accountId: ctx.session.account.id },
      orderBy: { createdAt: 'desc' },
      select: summary,
    }),
  ),

  dashboard: createTRPCRouter({
    /** Every Dossier in `state`, last changed first. */
    list: consultantProcedure.input(dossierListInput).query(({ ctx, input }) =>
      ctx.prisma.dossier.findMany({
        where: input.state === 'ALL' ? {} : { state: input.state },
        orderBy: { updatedAt: 'desc' },
        select: { ...summary, account: { select: { id: true, name: true, email: true } } },
      }),
    ),

    get: consultantProcedure.input(byId).query(async ({ ctx, input }) => {
      const dossier = await ctx.prisma.dossier.findUnique({
        where: { id: input.id },
        select: {
          ...summary,
          account: { select: { id: true, name: true, email: true } },
          events: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              kind: true,
              fromStage: true,
              toStage: true,
              note: true,
              createdAt: true,
              actor: { select: { name: true } },
            },
          },
        },
      });
      if (!dossier) throw notFound();
      return dossier;
    }),

    /** Accounts a Dossier can be opened for: members (not Partners or the consultant), by name or email. */
    searchAccounts: consultantProcedure.input(accountSearchInput).query(({ ctx, input }) =>
      ctx.prisma.account.findMany({
        where: {
          role: 'MEMBER',
          OR: [
            { name: { contains: input.query, mode: 'insensitive' } },
            { email: { contains: input.query, mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
        take: 8,
        select: { id: true, name: true, email: true, status: true },
      }),
    ),

    /**
     * Opens a Dossier at `startStage` and makes its Account a Client (a User
     * becomes a Lead on the way). Refuses DOSSIER_INVALID_STAGE for a stage of
     * another service and DOSSIER_ACCOUNT_NOT_ELIGIBLE for a Partner or the consultant.
     */
    open: consultantProcedure.input(openDossierInput).mutation(async ({ ctx, input }) => {
      if (!isStageOf(input.service, input.startStage)) throw refuse('DOSSIER_INVALID_STAGE');
      const account = await ctx.prisma.account.findUnique({
        where: { id: input.accountId },
        select: { id: true, name: true, email: true, locale: true, role: true, status: true },
      });
      if (!account) throw notFound();
      if (account.role !== 'MEMBER') throw refuse('DOSSIER_ACCOUNT_NOT_ELIGIBLE');

      const dossier = await ctx.prisma.$transaction(async (tx) => {
        const created = await tx.dossier.create({
          data: {
            accountId: account.id,
            service: input.service,
            stage: input.startStage,
            startStage: input.startStage,
            events: {
              create: { kind: 'OPENED', toStage: input.startStage, actorId: ctx.session.account.id },
            },
          },
          select: { id: true },
        });
        if (account.status === 'USER') await transitionAccountStatus(tx, account.id, 'START_ONBOARDING');
        if (account.status !== 'CLIENT') await transitionAccountStatus(tx, account.id, 'OPEN_DOSSIER');
        return created;
      });

      notifyClient(account, input.service, { kind: 'opened', stage: input.startStage });
      return dossier;
    }),

    /** The next stage; DOSSIER_LAST_STAGE on the last one. */
    advance: consultantProcedure.input(moveDossierInput).mutation(async ({ ctx, input }) => {
      const dossier = await openAt(ctx.prisma, input.id, input.from);
      const { service } = dossier;
      const to = nextStage(service, dossier.stage);
      if (!to) throw refuse('DOSSIER_LAST_STAGE');
      await move(ctx.prisma, ctx.session.account.id, dossier, to, 'ADVANCED');
      notifyClient(dossier.account, service, { kind: 'stageChanged', stage: to });
      return { stage: to };
    }),

    /** The previous stage; DOSSIER_FIRST_STAGE on the first one. */
    moveBack: consultantProcedure.input(moveDossierInput).mutation(async ({ ctx, input }) => {
      const dossier = await openAt(ctx.prisma, input.id, input.from);
      const { service } = dossier;
      const to = previousStage(service, dossier.stage);
      if (!to) throw refuse('DOSSIER_FIRST_STAGE');
      await move(ctx.prisma, ctx.session.account.id, dossier, to, 'MOVED_BACK');
      notifyClient(dossier.account, service, { kind: 'stageChanged', stage: to });
      return { stage: to };
    }),

    /** Clôturé with a reason, at any stage. Closed for good: there is no reopening. */
    close: consultantProcedure.input(closeDossierInput).mutation(async ({ ctx, input }) => {
      const dossier = await ctx.prisma.dossier.findUnique({
        where: { id: input.id },
        include: { account: client },
      });
      if (!dossier) throw notFound();
      await ctx.prisma.$transaction(async (tx) => {
        const { count } = await tx.dossier.updateMany({
          where: { id: dossier.id, state: 'OPEN' },
          data: { state: 'CLOSED', closedAt: new Date(), closedReason: input.reason },
        });
        if (count === 0) throw refuse('DOSSIER_CLOSED');
        await tx.dossierEvent.create({
          data: {
            dossierId: dossier.id,
            kind: 'CLOSED',
            fromStage: dossier.stage,
            toStage: dossier.stage,
            note: input.reason,
            actorId: ctx.session.account.id,
          },
        });
      });
      notifyClient(dossier.account, dossier.service, { kind: 'closed', reason: input.reason });
    }),
  }),
});
