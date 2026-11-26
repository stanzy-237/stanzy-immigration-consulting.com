import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { MINUTE } from '@/features/consultation/lib/slots';
import { loadAvailability, type Db } from '@/features/consultation/server/booking-calendar';
import { isOver, movable, moveTo, recordingOf, startsFor } from '@/features/consultation/server/consultation-admin-router';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

/** Errors the Client's pages explain. */
export const SPACE_ERRORS = {
  /** Too close to the start: moving closed « Déplacer jusqu'à » hours before. */
  moveClosed: 'MOVE_CLOSED',
  slotTaken: 'SLOT_TAKEN',
} as const;

/** One of the signed-in Account's Consultations; anyone else's is NOT_FOUND (ADR 0005). */
async function ownConsultation(db: Db, id: string, accountId: string) {
  const consultation = await db.consultation.findUnique({
    where: { id },
    include: {
      paidBy: { include: { promoCode: { select: { code: true } } } },
      meeting: { select: { id: true, endedAt: true, recordings: { select: { id: true, kind: true, startedAt: true, endedAt: true, text: true } } } },
      clientNotes: { orderBy: [{ atSeconds: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }], select: { id: true, atSeconds: true, text: true } },
      nextSteps: { orderBy: { position: 'asc' }, select: { id: true, text: true, doneAt: true } },
    },
  });
  if (!consultation || consultation.accountId !== accountId) throw new TRPCError({ code: 'NOT_FOUND' });
  return consultation;
}

/**
 * Mon espace → Consultations (#15, `Mon espace v2 · 1 Avant`, `3 Après ·
 * Récap`, `4 Déplacer`, `5 Mes consultations`): the Account's own
 * Consultations, one of them before or after, moving it to another free
 * slot, and ticking its next steps. What Stanzy writes after the
 * Consultation shows only once published; private notes never.
 */
export const consultationSpaceRouter = createTRPCRouter({
  /** « Mes consultations »: paid ones and those whose payment is on its way. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const rows = await ctx.prisma.consultation.findMany({
      where: {
        accountId: ctx.session.account.id,
        OR: [{ status: 'PAID' }, { status: 'HELD', heldUntil: { gt: now } }],
      },
      orderBy: { startsAt: 'asc' },
      include: {
        paidBy: { select: { charged: true, amount: true, currency: true, settledCurrency: true, networkName: true } },
        meeting: { select: { endedAt: true } },
        nextSteps: { select: { doneAt: true } },
        payments: { where: { status: 'PENDING' }, select: { networkName: true }, take: 1 },
      },
    });
    const items = rows.map((c) => ({
      id: c.id,
      status: c.status,
      startsAt: c.startsAt,
      durationMinutes: c.durationMinutes,
      minutes: c.meeting?.endedAt ? Math.max(1, Math.round((c.meeting.endedAt.getTime() - c.startsAt.getTime()) / MINUTE)) : c.durationMinutes,
      over: c.status === 'PAID' && isOver(c, now),
      published: c.publishedAt !== null,
      meetingId: c.meetingId,
      paymentId: c.paidById,
      paid: c.paidBy
        ? { amount: c.paidBy.charged === null ? c.paidBy.amount : Number(c.paidBy.charged), currency: c.paidBy.settledCurrency ?? c.paidBy.currency, network: c.paidBy.networkName }
        : null,
      pendingNetwork: c.status === 'HELD' ? (c.payments[0]?.networkName ?? null) : null,
      steps: { total: c.nextSteps.length, done: c.nextSteps.filter((s) => s.doneAt).length },
    }));
    return {
      upcoming: items.filter((c) => !c.over),
      past: items.filter((c) => c.over).toReversed(),
    };
  }),

  /** One Consultation, before (when, what to prepare, Déplacer) or after (once published: video, notes, transcript, steps). */
  detail: protectedProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const c = await ownConsultation(ctx.prisma, input.id, ctx.session.account.id);
    if (c.status !== 'PAID') throw new TRPCError({ code: 'NOT_FOUND' });
    const now = new Date();
    const { availability } = await loadAvailability(ctx.prisma);
    const moveUntil = new Date(c.startsAt.getTime() - availability.moveCutoffHours * 60 * MINUTE);
    const over = isOver(c, now);
    const recording = recordingOf(c.meeting?.recordings ?? []);
    const p = c.paidBy;
    return {
      id: c.id,
      startsAt: c.startsAt,
      durationMinutes: c.durationMinutes,
      minutes: c.meeting?.endedAt ? Math.max(1, Math.round((c.meeting.endedAt.getTime() - c.startsAt.getTime()) / MINUTE)) : c.durationMinutes,
      over,
      meetingId: c.meeting?.id ?? null,
      moveUntil,
      canMove: !over && now < moveUntil,
      moveCutoffHours: availability.moveCutoffHours,
      answers: { topics: c.topics, crsScore: c.crsScore, itaReceived: c.itaReceived, situation: c.situation },
      payment: p
        ? {
            id: p.id,
            amount: p.charged === null ? p.amount : Number(p.charged),
            currency: p.settledCurrency ?? p.currency,
            network: p.networkName,
            promo: p.promoCode?.code ?? null,
            invoiceNumber: p.invoiceNumber,
          }
        : null,
      // Nothing written after the Consultation shows before « Publier ».
      published:
        over && c.publishedAt
          ? {
              at: c.publishedAt,
              recording: recording ? { seconds: recording.seconds } : null,
              transcript: recording?.transcript || null,
              notes: c.clientNotes,
              steps: c.nextSteps,
            }
          : null,
    };
  }),

  /** « Déplacer »: the free starts, by day, while moving is still open. */
  moveOptions: protectedProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    await ownConsultation(ctx.prisma, input.id, ctx.session.account.id);
    const c = await movable(ctx.prisma, input.id);
    return { days: await startsFor(ctx.prisma, c.meeting.id) };
  }),

  /** Moves it to a free start; its Réunion follows, the Client gets « Déplacée », Stanzy the bell. */
  move: protectedProcedure.input(z.object({ id: z.string().min(1), start: z.iso.datetime() })).mutation(async ({ ctx, input }) => {
    await ownConsultation(ctx.prisma, input.id, ctx.session.account.id);
    const c = await movable(ctx.prisma, input.id);
    const { availability } = await loadAvailability(ctx.prisma);
    if (Date.now() >= c.startsAt.getTime() - availability.moveCutoffHours * 60 * MINUTE) throw new TRPCError({ code: 'CONFLICT', message: SPACE_ERRORS.moveClosed });
    const consultant = await ctx.prisma.account.findFirst({ where: { role: 'CONSULTANT' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    await moveTo(ctx.prisma, ctx.session.account.id, c, new Date(input.start), null, consultant?.id ?? c.accountId);
    return { startsAt: new Date(input.start) };
  }),

  /** « Vos prochaines étapes »: ticks one off, or back on. */
  toggleStep: protectedProcedure
    .input(z.object({ id: z.string().min(1), stepId: z.string().min(1), done: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const c = await ownConsultation(ctx.prisma, input.id, ctx.session.account.id);
      if (!c.publishedAt) throw new TRPCError({ code: 'NOT_FOUND' });
      await ctx.prisma.consultationStep.updateMany({ where: { id: input.stepId, consultationId: c.id }, data: { doneAt: input.done ? new Date() : null } });
      return { done: input.done };
    }),
});
