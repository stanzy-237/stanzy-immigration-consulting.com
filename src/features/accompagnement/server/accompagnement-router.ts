import type { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { createTranslator } from 'next-intl';
import { after } from 'next/server';
import { z } from 'zod';

import { planDossier } from '@/features/accompagnement/lib/dossier-plan';
import {
  interestApprovedEmail,
  interestRejectedEmail,
  newInterestEmail,
  stanzyDeclinedEmail,
  stanzyRequestedEmail,
} from '@/features/accompagnement/lib/interest-emails';
import {
  decideInput,
  interestAnswersSchema,
  interestListInput,
  levelOf,
  REASON_MAX,
  rejectInput,
  startStageOf,
  type InterestAnswers,
} from '@/features/accompagnement/lib/interest-schema';
import { livesInCameroon } from '@/features/accompagnement/server/residence';
import { transitionAccountStatus } from '@/features/auth/server/account-status';
import { dashboardOrigin } from '@/features/dashboard/lib/dashboard-host';
import { dossierRefInput } from '@/features/dossiers/lib/document-schema';
import { dossierFor, isConsultant, writable } from '@/features/dossiers/server/dossier-access';
import { notifyLater } from '@/features/notifications/server/notify';
import { toLocale } from '@/i18n/routing';
import { siteUrl } from '@/lib/site-url';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { appMailer } from '@/server/email/app-mailer';
import type { EmailMessage } from '@/server/email/mailer';
import type { TRPCContext } from '@/server/trpc/context';
import { consultantProcedure, createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

type Db = TRPCContext['prisma'];

const byId = z.object({ id: z.string().min(1) });
const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

/** A Stanzy request still under way: one at a time per Document. */
const OPEN_STANZY = ['REQUESTED', 'ACCEPTED', 'ASSIGNED'] as const;

/** Sends after the response; a failure is logged, the change is already saved. */
function mailLater(label: string, emails: () => Promise<EmailMessage[]>): void {
  after(async () => {
    try {
      for (const email of await emails()) await appMailer.send(email);
    } catch (error) {
      console.error(`[accompagnement] could not email ${label}`, error);
    }
  });
}

const consultants = (db: Db) =>
  db.account.findMany({ where: { role: 'CONSULTANT' }, select: { email: true, locale: true } });

/** The Client's open Accompagnement Dossier, if any: one at a time. */
const openAccompagnement = (db: Db, accountId: string) =>
  db.dossier.findFirst({
    where: { accountId, service: 'ACCOMPAGNEMENT', state: 'OPEN' },
    select: { id: true },
  });

const listed = {
  id: true,
  status: true,
  level: true,
  levelOverride: true,
  createdAt: true,
  decidedAt: true,
  dossierId: true,
  account: { select: { id: true, name: true, email: true } },
} satisfies Prisma.InterestRequestSelect;

/**
 * Accompagnement Entrée Express (#81): a signed-in User sends a Demande
 * d'intérêt and becomes a Lead; the consultant sees its Niveau, may change
 * it, and approves (the Dossier opens at the matching stage, its Documents
 * made from the Checklist) or rejects. « Stanzy s'en charge » requests on a
 * missing Document are recorded here; prices and Missions come with #80 and #42.
 */
export const accompagnementRouter = createTRPCRouter({
  /** The viewer's latest Demande, and their open Accompagnement Dossier if any. */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const [latest, dossier] = await Promise.all([
      ctx.prisma.interestRequest.findFirst({
        where: { accountId: ctx.session.account.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, rejectReason: true, dossierId: true, createdAt: true, decidedAt: true },
      }),
      openAccompagnement(ctx.prisma, ctx.session.account.id),
    ]);
    return { latest, dossierId: dossier?.id ?? null };
  }),

  /** Sends a Demande d'intérêt: the User becomes a Lead, the consultant is told. One waits at a time. */
  submit: protectedProcedure.input(interestAnswersSchema).mutation(async ({ ctx, input }) => {
    const account = ctx.session.account;
    if (account.role !== 'MEMBER') throw refuse('INTEREST_NOT_ELIGIBLE');
    if (await openAccompagnement(ctx.prisma, account.id)) throw refuse('INTEREST_ALREADY_CLIENT');
    const pending = await ctx.prisma.interestRequest.findFirst({
      where: { accountId: account.id, status: 'SUBMITTED' },
      select: { id: true },
    });
    if (pending) throw refuse('INTEREST_PENDING');

    const level = levelOf(input);
    const interest = await ctx.prisma.$transaction(async (tx) => {
      const created = await tx.interestRequest.create({
        data: {
          accountId: account.id,
          answers: input as unknown as Prisma.InputJsonValue,
          level,
          residence: input.progress.residence,
        },
        select: { id: true },
      });
      // The session's status can be minutes old (its cookie cache): read the Account's own.
      const { status } = await tx.account.findUniqueOrThrow({ where: { id: account.id }, select: { status: true } });
      if (status === 'USER') await transitionAccountStatus(tx, account.id, 'START_ONBOARDING');
      return created;
    });

    mailLater('a new Demande', async () =>
      (await consultants(ctx.prisma)).map((consultant) =>
        newInterestEmail({
          to: consultant.email,
          locale: consultant.locale,
          client: account.name,
          level,
          url: `${dashboardOrigin(siteUrl())}/demandes/${interest.id}`,
        }),
      ),
    );
    notifyLater(ctx.prisma, {
      kind: 'INTEREST_SUBMITTED',
      actorId: account.id,
      recipients: 'CONSULTANTS',
      target: {},
      params: { interestId: interest.id, client: account.name, level },
    });
    return interest;
  }),

  dashboard: createTRPCRouter({
    /** The Demandes d'intérêt, newest first; « À traiter » by default. */
    list: consultantProcedure.input(interestListInput).query(({ ctx, input }) =>
      ctx.prisma.interestRequest.findMany({
        where: input.filter === 'ALL' ? {} : { status: input.filter },
        orderBy: { createdAt: 'desc' },
        select: listed,
      }),
    ),

    /** One Demande with every answer and the Account's earlier ones. */
    get: consultantProcedure.input(byId).query(async ({ ctx, input }) => {
      const interest = await ctx.prisma.interestRequest.findUnique({
        where: { id: input.id },
        select: {
          ...listed,
          answers: true,
          residence: true,
          rejectReason: true,
          decidedBy: { select: { name: true } },
          account: { select: { id: true, name: true, email: true, locale: true, status: true } },
        },
      });
      if (!interest) throw notFound();
      const history = await ctx.prisma.interestRequest.findMany({
        where: { accountId: interest.account.id, id: { not: interest.id } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, createdAt: true },
      });
      return { ...interest, answers: interest.answers as unknown as InterestAnswers, history };
    }),

    /**
     * Approves at the Niveau chosen: the Accompagnement Dossier opens at its
     * stage with its Sections and Documents, the Account becomes a Client,
     * and the User is told. The invoice is the consultant's next step.
     */
    approve: consultantProcedure.input(decideInput).mutation(async ({ ctx, input }) => {
      const interest = await ctx.prisma.interestRequest.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          status: true,
          level: true,
          answers: true,
          account: { select: { id: true, name: true, email: true, locale: true, status: true } },
        },
      });
      if (!interest) throw notFound();
      if (interest.status !== 'SUBMITTED') throw refuse('INTEREST_NOT_PENDING');
      if (await openAccompagnement(ctx.prisma, interest.account.id)) throw refuse('INTEREST_ALREADY_CLIENT');

      const answers = interest.answers as unknown as InterestAnswers;
      const stage = startStageOf(input.level, answers.progress.ita);
      const plan = planDossier(answers, interest.account.locale);
      const { account } = interest;
      const consultantId = ctx.session.account.id;

      const dossier = await ctx.prisma.$transaction(async (tx) => {
        const { count } = await tx.interestRequest.updateMany({
          where: { id: interest.id, status: 'SUBMITTED' },
          data: {
            status: 'APPROVED',
            levelOverride: input.level === interest.level ? null : input.level,
            decidedById: consultantId,
            decidedAt: new Date(),
          },
        });
        if (count === 0) throw refuse('INTEREST_NOT_PENDING');
        const created = await tx.dossier.create({
          data: {
            accountId: account.id,
            service: 'ACCOMPAGNEMENT',
            stage,
            startStage: stage,
            events: { create: { kind: 'OPENED', toStage: stage, actorId: consultantId } },
            sections: {
              create: plan.map((section, index) => ({
                title: section.title,
                position: index + 1,
                documents: {
                  create: section.documents.map((document) => ({
                    title: document.title,
                    kind: document.kind,
                    need: document.need,
                    missing: document.missing,
                    clientNote: document.clientNote,
                    addedById: consultantId,
                    ...(document.stanzy ? { stanzyRequests: { create: { requestedById: account.id } } } : {}),
                  })),
                },
              })),
            },
          },
          select: { id: true },
        });
        await tx.interestRequest.update({ where: { id: interest.id }, data: { dossierId: created.id } });
        if (account.status === 'USER') await transitionAccountStatus(tx, account.id, 'START_ONBOARDING');
        if (account.status !== 'CLIENT') await transitionAccountStatus(tx, account.id, 'OPEN_DOSSIER');
        return created;
      });

      const lang = toLocale(account.locale);
      const stageName = createTranslator({ locale: lang, messages: { fr, en }[lang] })(
        `Dossiers.stages.ACCOMPAGNEMENT.${stage}`,
      );
      mailLater('an approval', async () => [
        interestApprovedEmail({
          to: account.email,
          name: account.name,
          locale: lang,
          stage: stageName,
          url: `${siteUrl()}/${lang}/mon-espace/dossiers/${dossier.id}`,
        }),
      ]);
      notifyLater(ctx.prisma, {
        kind: 'DOSSIER_OPENED',
        actorId: consultantId,
        recipients: [account.id],
        target: { dossierId: dossier.id },
      });
      return dossier;
    }),

    /** Rejects with an optional reason; the User stays as they are and may send another. */
    reject: consultantProcedure.input(rejectInput).mutation(async ({ ctx, input }) => {
      const interest = await ctx.prisma.interestRequest.findUnique({
        where: { id: input.id },
        select: { id: true, account: { select: { id: true, name: true, email: true, locale: true } } },
      });
      if (!interest) throw notFound();
      const { count } = await ctx.prisma.interestRequest.updateMany({
        where: { id: interest.id, status: 'SUBMITTED' },
        data: {
          status: 'REJECTED',
          rejectReason: input.reason || null,
          decidedById: ctx.session.account.id,
          decidedAt: new Date(),
        },
      });
      if (count === 0) throw refuse('INTEREST_NOT_PENDING');
      const { account } = interest;
      const lang = toLocale(account.locale);
      mailLater('a rejection', async () => [
        interestRejectedEmail({
          to: account.email,
          name: account.name,
          locale: lang,
          reason: input.reason || null,
          url: `${siteUrl()}/${lang}/mon-espace/accompagnement`,
        }),
      ]);
      notifyLater(ctx.prisma, {
        kind: 'INTEREST_REJECTED',
        actorId: ctx.session.account.id,
        recipients: [account.id],
        target: {},
        params: { interestId: interest.id },
      });
    }),
  }),

  stanzy: createTRPCRouter({
    /** A Dossier's « Documents à obtenir par Stanzy », newest first. */
    forDossier: protectedProcedure.input(dossierRefInput).query(async ({ ctx, input }) => {
      const dossier = await dossierFor(ctx.prisma, ctx.session, input.dossierId);
      return ctx.prisma.stanzyRequest.findMany({
        where: { document: { section: { dossierId: dossier.id } } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          declineNote: true,
          createdAt: true,
          document: { select: { id: true, title: true, section: { select: { title: true } } } },
        },
      });
    }),

    /**
     * The Client in Cameroon asks Stanzy to get a missing Document (no
     * Version yet); the consultant is told. One request at a time.
     */
    request: protectedProcedure.input(z.object({ documentId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const document = await ctx.prisma.dossierDocument.findUnique({
        where: { id: input.documentId },
        select: {
          id: true,
          title: true,
          missing: true,
          section: { select: { dossierId: true } },
          _count: { select: { versions: true } },
          stanzyRequests: { where: { status: { in: [...OPEN_STANZY] } }, select: { id: true } },
        },
      });
      if (!document) throw notFound();
      const dossier = await dossierFor(ctx.prisma, ctx.session, document.section.dossierId);
      writable(dossier);
      if (isConsultant(ctx.session) || dossier.accountId !== ctx.session.account.id) throw refuse('STANZY_CLIENT_ONLY');
      if (!(await livesInCameroon(ctx.prisma, dossier.accountId))) throw refuse('STANZY_CAMEROON_ONLY');
      if (!document.missing || document._count.versions > 0) throw refuse('STANZY_NOT_MISSING');
      if (document.stanzyRequests.length > 0) throw refuse('STANZY_ALREADY_ASKED');

      const request = await ctx.prisma.stanzyRequest.create({
        data: { documentId: document.id, requestedById: ctx.session.account.id },
        select: { id: true },
      });
      const client = dossier.account.name;
      mailLater('a Stanzy request', async () =>
        (await consultants(ctx.prisma)).map((consultant) =>
          stanzyRequestedEmail({
            to: consultant.email,
            locale: consultant.locale,
            client,
            document: document.title,
            url: `${dashboardOrigin(siteUrl())}/dossiers/${dossier.id}#stanzy`,
          }),
        ),
      );
      notifyLater(ctx.prisma, {
        kind: 'STANZY_REQUESTED',
        actorId: ctx.session.account.id,
        recipients: 'CONSULTANTS',
        target: { dossierId: dossier.id, documentId: document.id },
      });
      return request;
    }),

    /** The consultant declines, with a note: the Client gets the Document themselves. */
    decline: consultantProcedure
      .input(z.object({ id: z.string().min(1), note: z.string().trim().max(REASON_MAX) }))
      .mutation(async ({ ctx, input }) => {
        const request = await ctx.prisma.stanzyRequest.findUnique({
          where: { id: input.id },
          select: { id: true, document: { select: { id: true, title: true, section: { select: { dossierId: true } } } } },
        });
        if (!request) throw notFound();
        const dossier = await dossierFor(ctx.prisma, ctx.session, request.document.section.dossierId);
        const { count } = await ctx.prisma.stanzyRequest.updateMany({
          where: { id: request.id, status: 'REQUESTED' },
          data: { status: 'DECLINED', declineNote: input.note || null, decidedAt: new Date() },
        });
        if (count === 0) throw refuse('STANZY_NOT_PENDING');
        const client = dossier.account;
        const lang = toLocale(client.locale);
        mailLater('a declined Stanzy request', async () => [
          stanzyDeclinedEmail({
            to: client.email,
            name: client.name,
            locale: lang,
            document: request.document.title,
            note: input.note || null,
            url: `${siteUrl()}/${lang}/mon-espace/dossiers/${dossier.id}?document=${request.document.id}#documents`,
          }),
        ]);
        notifyLater(ctx.prisma, {
          kind: 'STANZY_DECLINED',
          actorId: ctx.session.account.id,
          recipients: [client.id],
          target: { dossierId: dossier.id, documentId: request.document.id },
        });
      }),
  }),
});
