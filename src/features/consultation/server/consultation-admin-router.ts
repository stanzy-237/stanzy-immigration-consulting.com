import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { cancelSlotSchema, moveSlotSchema, notesSchema, settingsInputSchema } from '@/features/consultation/lib/settings';
import { freeSlots, MINUTE, type Busy } from '@/features/consultation/lib/slots';
import { isDay, mondayOf, startOfDay } from '@/features/consultation/lib/week-calendar';
import { addDays } from '@/features/notifications/lib/douala-days';
import { BOOKING_LOCK, busyTimes, loadAvailability, type Db } from '@/features/consultation/server/booking-calendar';
import { emailParticipantsLater, meetingParams } from '@/features/meetings/server/meeting-notify';
import { notifyLater } from '@/features/notifications/server/notify';
import { siteUrl } from '@/lib/site-url';
import { appMailer } from '@/server/email/app-mailer';
import { consultantProcedure, createTRPCRouter } from '@/server/trpc/trpc';

/** Errors the Consultation page explains. */
export const ADMIN_ERRORS = {
  /** Not paid, or already over: nothing to move. */
  notMovable: 'CONSULTATION_NOT_MOVABLE',
  /** That start is no longer free. */
  slotTaken: 'SLOT_TAKEN',
  /** No free slot left within the horizon. */
  noSlot: 'NO_FREE_SLOT',
} as const;

const ended = (c: { startsAt: Date; durationMinutes: number }, now: Date) => c.startsAt.getTime() + c.durationMinutes * MINUTE <= now.getTime();

const accountSelect = { select: { id: true, name: true, email: true, status: true, locale: true } } as const;

/**
 * The paid Consultation's free starts for a move: the Disponibilités, minus
 * what is taken (its own Réunion left out, `alsoBusy` added).
 */
async function startsFor(db: Db, meetingId: string | null, alsoBusy: Busy[] = []) {
  const now = new Date();
  const { availability } = await loadAvailability(db);
  const busy = [...(await busyTimes(db, now, availability.horizonDays, undefined, meetingId ?? undefined)), ...alsoBusy];
  return freeSlots(availability, busy, now);
}

/** A paid Consultation still to come, with its Réunion and Client; else the error the page shows. */
async function movable(db: Db, id: string) {
  const consultation = await db.consultation.findUnique({
    where: { id },
    include: { account: accountSelect, meeting: { select: { id: true, subject: true, recording: true, dossierId: true } } },
  });
  if (!consultation) throw new TRPCError({ code: 'NOT_FOUND' });
  if (consultation.status !== 'PAID' || !consultation.meeting || ended(consultation, new Date())) {
    throw new TRPCError({ code: 'CONFLICT', message: ADMIN_ERRORS.notMovable });
  }
  return { ...consultation, meeting: consultation.meeting };
}

/**
 * Moves a paid Consultation and its Réunion to `start`, behind the booking
 * lock (it must still be free), clears the sent reminders, and tells the
 * Client: the « Déplacée » e-mail (with `reason` when the consultant cancelled
 * the slot) and the bell.
 */
async function moveTo(db: Db, actorId: string, consultation: Awaited<ReturnType<typeof movable>>, start: Date, reason: string | null) {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOKING_LOCK})`;
    const free = await startsFor(tx as unknown as Db, consultation.meeting.id);
    if (!free.some((day) => day.starts.includes(start.toISOString()))) throw new TRPCError({ code: 'CONFLICT', message: ADMIN_ERRORS.slotTaken });
    await tx.consultation.update({ where: { id: consultation.id }, data: { startsAt: start } });
    await tx.meeting.update({
      where: { id: consultation.meeting.id },
      data: { startsAt: start, remindedDayBefore: null, remindedSoon: null },
    });
  });
  const facts = {
    id: consultation.meeting.id,
    dossierId: consultation.meeting.dossierId,
    subject: consultation.meeting.subject,
    startsAt: start,
    durationMinutes: consultation.durationMinutes,
    recording: consultation.meeting.recording,
  };
  emailParticipantsLater({ mailer: appMailer, siteUrl: siteUrl() }, [consultation.account], facts, 'moved', reason);
  notifyLater(db, { kind: 'MEETING_MOVED', actorId, recipients: [consultation.accountId], target: {}, params: meetingParams(facts) });
}

/**
 * Tableau de bord → Consultations (#15, `Tableau de bord · Consultations`,
 * `· Consultation · 1 Avant`): the bookings by tab, the Disponibilités and
 * price, and one Consultation's page (answers, private notes, payment,
 * Compte, reminders, « Déplacer », « Annuler ce créneau »). Consultant only.
 */
export const consultationAdminRouter = createTRPCRouter({
  /** The three tabs: à venir (paid or held), passées, paiements échoués; with their counts. */
  list: consultantProcedure.input(z.object({ tab: z.enum(['upcoming', 'past', 'failed']) })).query(async ({ ctx, input }) => {
    const now = new Date();
    const upcomingWhere = {
      OR: [
        { status: 'PAID' as const, startsAt: { gt: new Date(now.getTime() - 3 * 60 * MINUTE) } },
        { status: 'HELD' as const, heldUntil: { gt: now } },
      ],
    };
    const failedWhere = { status: 'FAILED' as const };
    const [upcomingRows, failedUnresolved] = await Promise.all([
      ctx.prisma.consultation.findMany({ where: upcomingWhere, select: { startsAt: true, durationMinutes: true } }),
      ctx.prisma.consultationPayment.count({ where: { ...failedWhere, consultation: { status: { not: 'PAID' } } } }),
    ]);
    const counts = { upcoming: upcomingRows.filter((c) => !ended(c, now)).length, failed: failedUnresolved };

    if (input.tab === 'failed') {
      const payments = await ctx.prisma.consultationPayment.findMany({
        where: failedWhere,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { consultation: { select: { id: true, status: true, startsAt: true, heldUntil: true, paidAt: true, account: accountSelect } } },
      });
      return {
        counts,
        failed: payments.map((p) => ({
          id: p.id,
          at: p.createdAt,
          consultationId: p.consultation.id,
          client: p.consultation.account,
          wanted: p.consultation.startsAt,
          network: p.networkName,
          /** SasPay refused it at once (number, route) rather than the payer not validating. */
          refusedAtOnce: p.failureCode !== null,
          paidLater: p.consultation.status === 'PAID',
          minutesToPaid: p.consultation.paidAt ? Math.round((p.consultation.paidAt.getTime() - p.createdAt.getTime()) / MINUTE) : null,
          released: p.consultation.status === 'HELD' && (!p.consultation.heldUntil || p.consultation.heldUntil <= now),
        })),
        rows: [],
      };
    }

    const rows = await ctx.prisma.consultation.findMany({
      where:
        input.tab === 'upcoming'
          ? upcomingWhere
          : { status: 'PAID', startsAt: { lt: now } },
      orderBy: { startsAt: input.tab === 'upcoming' ? 'asc' : 'desc' },
      take: input.tab === 'upcoming' ? 200 : 100,
      include: {
        account: accountSelect,
        paidBy: { select: { networkName: true, network: true } },
        meeting: { select: { id: true, endedAt: true } },
      },
    });
    return {
      counts,
      failed: [],
      rows: rows
        .filter((c) => (input.tab === 'upcoming' ? !ended(c, now) : ended(c, now)))
        .map((c) => ({
          id: c.id,
          status: c.status,
          startsAt: c.startsAt,
          durationMinutes: c.durationMinutes,
          heldUntil: c.heldUntil,
          crsScore: c.crsScore,
          client: c.account,
          network: c.paidBy?.network === 'card' ? null : (c.paidBy?.networkName ?? null),
          card: c.paidBy?.network === 'card',
          meetingId: c.meeting?.id ?? null,
        })),
    };
  }),

  /**
   * One week for the calendar (Monday `week`, Douala time): its paid
   * Consultations, those held while their Compte pays, and the consultant's
   * other Réunions, since they take the time too.
   */
  calendar: consultantProcedure
    .input(z.object({ week: z.string().refine(isDay, 'A YYYY-MM-DD day') }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const monday = mondayOf(input.week);
      const window = { gte: startOfDay(monday), lt: startOfDay(addDays(monday, 7)) };
      const [consultations, meetings] = await Promise.all([
        ctx.prisma.consultation.findMany({
          where: { startsAt: window, status: { in: ['PAID', 'HELD'] } },
          orderBy: { startsAt: 'asc' },
          select: { id: true, status: true, startsAt: true, durationMinutes: true, heldUntil: true, account: { select: { name: true } } },
        }),
        ctx.prisma.meeting.findMany({
          where: { startsAt: window, status: 'SCHEDULED', kind: { in: ['SCHEDULED', 'INSTANT'] }, consultation: { is: null } },
          orderBy: { startsAt: 'asc' },
          select: { id: true, subject: true, startsAt: true, durationMinutes: true },
        }),
      ]);
      return {
        week: monday,
        consultations: consultations
          .filter((c) => c.status === 'PAID' || (c.heldUntil !== null && c.heldUntil > now))
          .map((c) => ({ id: c.id, status: c.status, startsAt: c.startsAt, durationMinutes: c.durationMinutes, heldUntil: c.heldUntil, name: c.account.name })),
        meetings,
      };
    }),

  /** The Disponibilités and the price, as set (or the defaults, with no price). */
  settings: consultantProcedure.query(async ({ ctx }) => {
    const { availability, price } = await loadAvailability(ctx.prisma);
    return { ...availability, price };
  }),

  /** « Enregistrer »: the Disponibilités and the price; the public page follows at its next refresh. */
  saveSettings: consultantProcedure.input(settingsInputSchema).mutation(async ({ ctx, input }) => {
    await ctx.prisma.consultationSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...input },
      update: input,
    });
    return { saved: true };
  }),

  /** One Consultation's page (« 1 Avant »). */
  detail: consultantProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const c = await ctx.prisma.consultation.findUnique({
      where: { id: input.id },
      include: {
        account: { select: { id: true, name: true, email: true, status: true, _count: { select: { dossiers: true } } } },
        paidBy: { include: { promoCode: { select: { code: true, reductionType: true, reductionValue: true } } } },
        meeting: { select: { id: true, notes: true, remindedDayBefore: true, remindedSoon: true, endedAt: true, status: true } },
      },
    });
    if (!c) throw new TRPCError({ code: 'NOT_FOUND' });
    const p = c.paidBy;
    return {
      id: c.id,
      status: c.status,
      startsAt: c.startsAt,
      durationMinutes: c.durationMinutes,
      heldUntil: c.heldUntil,
      ended: ended(c, new Date()),
      answers: { topics: c.topics, crsScore: c.crsScore, itaReceived: c.itaReceived, situation: c.situation },
      client: {
        id: c.account.id,
        name: c.account.name,
        email: c.account.email,
        status: c.account.status,
        phone: c.phone,
        country: c.country,
        dossiers: c.account._count.dossiers,
      },
      payment: p
        ? {
            id: p.id,
            price: p.amount + p.discount,
            discount: p.discount,
            promo: p.promoCode,
            amount: p.amount,
            fee: p.fee === null ? null : Number(p.fee),
            charged: p.charged === null ? null : Number(p.charged),
            currency: p.settledCurrency ?? p.currency,
            network: p.network,
            networkName: p.networkName,
            settledAt: p.settledAt,
            invoiceNumber: p.invoiceNumber,
          }
        : null,
      meeting: c.meeting,
    };
  }),

  /** « Vos notes »: private, autosaved, kept with the Réunion; the Client never sees them. */
  saveNotes: consultantProcedure.input(notesSchema).mutation(async ({ ctx, input }) => {
    const c = await ctx.prisma.consultation.findUnique({ where: { id: input.id }, select: { meetingId: true } });
    if (!c?.meetingId) throw new TRPCError({ code: 'NOT_FOUND' });
    await ctx.prisma.meeting.update({ where: { id: c.meetingId }, data: { notes: input.notes.trim() || null } });
    return { saved: true };
  }),

  /** The free starts a paid Consultation can move to, and the one « Annuler ce créneau » would pick. */
  moveOptions: consultantProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const c = await movable(ctx.prisma, input.id);
    const days = await startsFor(ctx.prisma, c.meeting.id);
    const own = { startsAt: c.startsAt, endsAt: new Date(c.startsAt.getTime() + c.durationMinutes * MINUTE) };
    const next = (await startsFor(ctx.prisma, c.meeting.id, [own]))[0]?.starts[0] ?? null;
    return { days, next };
  }),

  /** « Déplacer »: to a free start the consultant picks. */
  move: consultantProcedure.input(moveSlotSchema).mutation(async ({ ctx, input }) => {
    const c = await movable(ctx.prisma, input.id);
    await moveTo(ctx.prisma, ctx.session.account.id, c, new Date(input.start), null);
    return { startsAt: new Date(input.start) };
  }),

  /**
   * « Annuler ce créneau »: the Consultation is never lost nor refunded; it
   * moves at once to the next free slot (not this one), and the Client is
   * told why and can still change it.
   */
  cancelSlot: consultantProcedure.input(cancelSlotSchema).mutation(async ({ ctx, input }) => {
    const c = await movable(ctx.prisma, input.id);
    const own = { startsAt: c.startsAt, endsAt: new Date(c.startsAt.getTime() + c.durationMinutes * MINUTE) };
    const next = (await startsFor(ctx.prisma, c.meeting.id, [own]))[0]?.starts[0];
    if (!next) throw new TRPCError({ code: 'CONFLICT', message: ADMIN_ERRORS.noSlot });
    await moveTo(ctx.prisma, ctx.session.account.id, c, new Date(next), input.reason);
    return { startsAt: new Date(next) };
  }),
});
