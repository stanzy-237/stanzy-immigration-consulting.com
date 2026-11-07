import { TRPCError } from '@trpc/server';
import { after } from 'next/server';
import { z } from 'zod';

import { stanzyDeclinedEmail, stanzyRequestedEmail } from '@/features/accompagnement/lib/interest-emails';
import { acceptStanzyRequest } from '@/features/accompagnement/server/stanzy-accept';
import { transitionAccountStatus } from '@/features/auth/server/account-status';
import { DOCUMENT_GUIDES } from '@/features/checklist/data/document-guides';
import { dashboardOrigin } from '@/features/dashboard/lib/dashboard-host';
import {
  approveOrderInput,
  newShareToken,
  offerPath,
  orderInput,
  orderListInput,
  rejectOrderInput,
  tokenInput,
} from '@/features/document-services/lib/order-schema';
import { prerequisitesOf, textIn, type Texts } from '@/features/document-services/lib/service-schema';
import { dossierFor } from '@/features/dossiers/server/dossier-access';
import { notifyLater } from '@/features/notifications/server/notify';
import { toLocale } from '@/i18n/routing';
import { siteUrl } from '@/lib/site-url';
import { trackLater } from '@/server/analytics';
import { appMailer } from '@/server/email/app-mailer';
import type { EmailMessage } from '@/server/email/mailer';
import type { TRPCContext } from '@/server/trpc/context';
import { consultantProcedure, createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc/trpc';

type Db = TRPCContext['prisma'];

const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

/** Sends after the response; a failure is logged, the change is already saved. */
function mailLater(label: string, emails: () => Promise<EmailMessage[]>): void {
  after(async () => {
    try {
      for (const email of await emails()) await appMailer.send(email);
    } catch (error) {
      console.error(`[document-services] could not email ${label}`, error);
    }
  });
}

/** What the private link shows: the service as the catalogue does, price included. */
const offered = {
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
  prerequisites: true,
  questionnaire: true,
} as const;

/** The active service behind a private link; NOT_FOUND for an unknown or withdrawn one. */
async function serviceFor(db: Db, token: string) {
  const service = await db.documentService.findUnique({ where: { shareToken: token }, select: { ...offered, active: true } });
  if (!service?.active) throw notFound();
  return service;
}

/**
 * A Service documentaire ordered on its own (#80): the consultant sends its
 * private link on WhatsApp; the person reads its conditions, contract and
 * price, signs in and orders it. The consultant approves: that opens their
 * Service documentaire Dossier with the service's Document and its « Stanzy
 * s'en charge » request, and sends the service's Contrat with the invoice.
 * From there it runs as any request: what to hand over, the countdown, the
 * stages. Wherever the person lives: the link is the invitation.
 */
export const ordersRouter = createTRPCRouter({
  /** The private link's page; for someone signed in, their last order of it. */
  offer: publicProcedure.input(tokenInput).query(async ({ ctx, input }) => {
    const service = await serviceFor(ctx.prisma, input.token);
    const order = ctx.session
      ? await ctx.prisma.serviceOrder.findFirst({
          where: { accountId: ctx.session.account.id, serviceId: service.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, rejectNote: true, dossierId: true, createdAt: true },
        })
      : null;
    return { service: { ...service, prerequisites: prerequisitesOf(service.prerequisites) }, order };
  }),

  /** Orders the service, its conditions and contract accepted. One waits at a time per service. */
  order: protectedProcedure.input(orderInput).mutation(async ({ ctx, input }) => {
    const { account } = ctx.session;
    if (account.role !== 'MEMBER') throw refuse('ORDER_NOT_ELIGIBLE');
    const service = await serviceFor(ctx.prisma, input.token);
    const pending = await ctx.prisma.serviceOrder.findFirst({
      where: { accountId: account.id, serviceId: service.id, status: 'SUBMITTED' },
      select: { id: true },
    });
    if (pending) throw refuse('ORDER_PENDING');
    const order = await ctx.prisma.serviceOrder.create({
      data: { accountId: account.id, serviceId: service.id, note: input.note || null },
      select: { id: true },
    });
    const name = service.name as unknown as Texts;
    mailLater('an order', async () =>
      (await ctx.prisma.account.findMany({ where: { role: 'CONSULTANT' }, select: { email: true, locale: true } })).map(
        (consultant) =>
          stanzyRequestedEmail({
            to: consultant.email,
            locale: consultant.locale,
            client: account.name,
            document: textIn(name, consultant.locale ?? 'fr'),
            url: `${dashboardOrigin(siteUrl())}/services#commandes`,
          }),
      ),
    );
    trackLater(ctx.headers, 'service.ordered', { service: service.slug });
    return order;
  }),

  dashboard: createTRPCRouter({
    /** The orders, « À traiter » first, with who ordered what. */
    list: consultantProcedure.input(orderListInput).query(({ ctx, input }) =>
      ctx.prisma.serviceOrder.findMany({
        where: { status: input.filter },
        orderBy: { createdAt: input.filter === 'SUBMITTED' ? 'asc' : 'desc' },
        take: 100,
        select: {
          id: true,
          status: true,
          note: true,
          rejectNote: true,
          createdAt: true,
          dossierId: true,
          account: { select: { id: true, name: true, email: true, locale: true } },
          service: { select: { id: true, slug: true, name: true, priceKind: true, price: true, unit: true } },
        },
      }),
    ),

    /** The service's private link to send, made the first time; `renew` replaces it (the old one stops working). */
    shareLink: consultantProcedure
      .input(z.object({ id: z.string().min(1), renew: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const service = await ctx.prisma.documentService.findUnique({ where: { id: input.id }, select: { shareToken: true } });
        if (!service) throw notFound();
        // On the public site, in French: the visitor can switch language there.
        const link = (token: string) => ({ url: `${siteUrl()}/fr${offerPath(token)}` });
        if (service.shareToken && !input.renew) return link(service.shareToken);
        const token = newShareToken();
        await ctx.prisma.documentService.update({ where: { id: input.id }, data: { shareToken: token } });
        return link(token);
      }),

    /**
     * Opens the Client's Service documentaire Dossier: a Section for the
     * service with the Documents it gets, its « Stanzy s'en charge » request
     * on the first, the conditions accepted on ordering. Then that request is
     * taken on: the service's Contrat to sign, a line on the draft invoice.
     */
    approve: consultantProcedure.input(approveOrderInput).mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.serviceOrder.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          status: true,
          createdAt: true,
          account: { select: { id: true, locale: true, status: true } },
          service: { select: { id: true, name: true, documentKinds: true, contractTitle: true, contractBody: true } },
        },
      });
      if (!order) throw notFound();
      if (order.status !== 'SUBMITTED') throw refuse('ORDER_NOT_PENDING');
      const { account, service } = order;
      const lang = toLocale(account.locale);
      const name = service.name as unknown as Texts;
      const titleOf = (kind: string): string =>
        (DOCUMENT_GUIDES[lang] as Record<string, { name: string } | undefined>)[kind]?.name ?? textIn(name, lang);
      const kinds = service.documentKinds.length > 0 ? service.documentKinds : [null];
      const consultantId = ctx.session.account.id;

      const { dossierId, requestId } = await ctx.prisma.$transaction(async (tx) => {
        const { count } = await tx.serviceOrder.updateMany({
          where: { id: order.id, status: 'SUBMITTED' },
          data: { status: 'APPROVED', decidedAt: new Date() },
        });
        if (count === 0) throw refuse('ORDER_NOT_PENDING');
        const dossier = await tx.dossier.create({
          data: {
            accountId: account.id,
            service: 'SERVICE_DOCUMENTAIRE',
            stage: 'commande',
            startStage: 'commande',
            events: { create: { kind: 'OPENED', toStage: 'commande', actorId: consultantId } },
            sections: { create: { title: name[lang], titles: name, position: 1 } },
          },
          select: { id: true, sections: { select: { id: true } } },
        });
        const documents = kinds.map((kind) => ({
          id: crypto.randomUUID(),
          sectionId: dossier.sections[0]!.id,
          title: kind ? titleOf(kind) : name[lang],
          kind,
          need: 'mandatory',
          addedById: consultantId,
        }));
        await tx.dossierDocument.createMany({ data: documents });
        const request = await tx.stanzyRequest.create({
          data: {
            documentId: documents[0]!.id,
            requestedById: account.id,
            serviceId: service.id,
            acceptedAt: order.createdAt,
          },
          select: { id: true },
        });
        await tx.serviceOrder.update({ where: { id: order.id }, data: { dossierId: dossier.id } });
        if (account.status === 'USER') await transitionAccountStatus(tx, account.id, 'START_ONBOARDING');
        if (account.status !== 'CLIENT') await transitionAccountStatus(tx, account.id, 'OPEN_DOSSIER');
        return { dossierId: dossier.id, requestId: request.id };
      });

      const dossier = await dossierFor(ctx.prisma, ctx.session, dossierId);
      const accepted = await acceptStanzyRequest(
        ctx,
        dossier,
        { id: requestId, status: 'REQUESTED', document: { title: kinds[0] ? titleOf(kinds[0]) : name[lang] }, service },
        input,
      );
      notifyLater(ctx.prisma, {
        kind: 'DOSSIER_OPENED',
        actorId: consultantId,
        recipients: [account.id],
        target: { dossierId },
      });
      trackLater(ctx.headers, 'service.order.approved');
      return { dossierId, ...accepted };
    }),

    /** Turns an order down, with a note for the Client. */
    reject: consultantProcedure.input(rejectOrderInput).mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.serviceOrder.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          account: { select: { email: true, name: true, locale: true } },
          service: { select: { name: true, shareToken: true } },
        },
      });
      if (!order) throw notFound();
      const { count } = await ctx.prisma.serviceOrder.updateMany({
        where: { id: order.id, status: 'SUBMITTED' },
        data: { status: 'REJECTED', rejectNote: input.note || null, decidedAt: new Date() },
      });
      if (count === 0) throw refuse('ORDER_NOT_PENDING');
      const { account, service } = order;
      const lang = toLocale(account.locale);
      mailLater('a rejected order', async () => [
        stanzyDeclinedEmail({
          to: account.email,
          name: account.name,
          locale: lang,
          document: textIn(service.name, lang),
          note: input.note || null,
          url: service.shareToken ? `${siteUrl()}/${lang}${offerPath(service.shareToken)}` : `${siteUrl()}/${lang}/mon-espace`,
        }),
      ]);
    }),
  }),
});
