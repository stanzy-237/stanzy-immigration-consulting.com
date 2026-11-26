import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { consultationSpacePath } from '@/features/consultation/lib/payment';
import { cancelSlotSchema, clientNoteSchema, moveSlotSchema, nextStepSchema, notesSchema, settingsInputSchema } from '@/features/consultation/lib/settings';
import { freeSlots, MINUTE, type Busy } from '@/features/consultation/lib/slots';
import { isDay, mondayOf, startOfDay } from '@/features/consultation/lib/week-calendar';
import { addDays } from '@/features/notifications/lib/douala-days';
import { paidConfirmation } from '@/features/consultation/server/consultation-payments';
import { BOOKING_LOCK, busyTimes, loadAvailability, type Db } from '@/features/consultation/server/booking-calendar';
import { emailParticipantsLater, meetingParams } from '@/features/meetings/server/meeting-notify';
import { notifyLater } from '@/features/notifications/server/notify';
import { consultationPublishedEmail } from '@/features/consultation/lib/consultation-emails';
import { toLocale } from '@/i18n/routing';
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
  /** Not over yet: there is nothing to write about or publish. */
  notOver: 'CONSULTATION_NOT_OVER',
} as const;

const ended = (c: { startsAt: Date; durationMinutes: number }, now: Date) => c.startsAt.getTime() + c.durationMinutes * MINUTE <= now.getTime();

/** Over: its time has passed, or its Réunion was ended for everyone. */
export const isOver = (c: { startsAt: Date; durationMinutes: number; meeting?: { endedAt: Date | null } | null }, now: Date) => ended(c, now) || Boolean(c.meeting?.endedAt);

/** The Enregistrement to show: the first video, with how long it lasts and its Transcription's words. */
export function recordingOf(files: { id: string; kind: string; startedAt: Date; endedAt: Date; text: string | null }[]) {
  const video = files.find((f) => f.kind === 'RECORDING');
  if (!video) return null;
  const transcript = files.find((f) => f.kind === 'TRANSCRIPTION');
  return { id: video.id, seconds: Math.max(1, Math.round((video.endedAt.getTime() - video.startedAt.getTime()) / 1000)), transcript: transcript?.text ?? null };
}

/** A paid Consultation that is over, for « 2 Après »; else the error the page shows. */
async function over(db: Db, id: string) {
  const consultation = await db.consultation.findUnique({
    where: { id },
    include: { account: { select: { name: true, email: true, locale: true } }, meeting: { select: { id: true, endedAt: true } }, nextSteps: { orderBy: { position: 'asc' }, select: { text: true } } },
  });
  if (!consultation) throw new TRPCError({ code: 'NOT_FOUND' });
  if (consultation.status !== 'PAID' || !isOver(consultation, new Date())) throw new TRPCError({ code: 'BAD_REQUEST', message: ADMIN_ERRORS.notOver });
  return consultation;
}

const accountSelect = { select: { id: true, name: true, email: true, status: true, locale: true } } as const;

/**
 * The paid Consultation's free starts for a move: the Disponibilités, minus
 * what is taken (its own Réunion left out, `alsoBusy` added).
 */
export async function startsFor(db: Db, meetingId: string | null, alsoBusy: Busy[] = []) {
  const now = new Date();
  const { availability } = await loadAvailability(db);
  const busy = [...(await busyTimes(db, now, availability.horizonDays, undefined, meetingId ?? undefined)), ...alsoBusy];
  return freeSlots(availability, busy, now);
}

/** A paid Consultation still to come, with its Réunion and Client; else the error the page shows. */
export async function movable(db: Db, id: string) {
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
export async function moveTo(
  db: Db,
  actorId: string,
  consultation: Awaited<ReturnType<typeof movable>>,
  start: Date,
  reason: string | null,
  /** Who gets the bell: the Client when the consultant moved it, the consultant when the Client did. */
  bellTo: string = consultation.accountId,
) {
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
  notifyLater(db, { kind: 'MEETING_MOVED', actorId, recipients: [bellTo], target: {}, params: meetingParams(facts) });
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
      ctx.prisma.consultation.findMany({ where: upcomingWhere, select: { startsAt: true, durationMinutes: true, meeting: { select: { endedAt: true } } } }),
      ctx.prisma.consultationPayment.count({ where: { ...failedWhere, consultation: { status: { not: 'PAID' } } } }),
    ]);
    // Ended for everyone counts as over, even before its time runs out.
    const counts = { upcoming: upcomingRows.filter((c) => !isOver(c, now)).length, failed: failedUnresolved };

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
        .filter((c) => (input.tab === 'upcoming' ? !isOver(c, now) : isOver(c, now)))
        .map((c) => ({
          id: c.id,
          status: c.status,
          startsAt: c.startsAt,
          durationMinutes: c.durationMinutes,
          heldUntil: c.heldUntil,
          crsScore: c.crsScore,
          topics: c.topics,
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
        meeting: {
          select: {
            id: true,
            notes: true,
            remindedDayBefore: true,
            remindedSoon: true,
            endedAt: true,
            status: true,
            createdAt: true,
            recordings: { orderBy: { startedAt: 'asc' }, select: { id: true, kind: true, startedAt: true, endedAt: true, text: true } },
          },
        },
        clientNotes: { orderBy: [{ atSeconds: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }], select: { id: true, atSeconds: true, text: true } },
        nextSteps: { orderBy: { position: 'asc' }, select: { id: true, text: true, doneAt: true } },
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
      meeting: c.meeting
        ? {
            id: c.meeting.id,
            notes: c.meeting.notes,
            remindedDayBefore: c.meeting.remindedDayBefore,
            remindedSoon: c.meeting.remindedSoon,
            endedAt: c.meeting.endedAt,
            status: c.meeting.status,
            createdAt: c.meeting.createdAt,
          }
        : null,
      // « 2 Après »: once over (its time passed, or « Terminer pour tous »).
      over: isOver(c, new Date()),
      recording: recordingOf(c.meeting?.recordings ?? []),
      clientNotes: c.clientNotes,
      nextSteps: c.nextSteps,
      publishedAt: c.publishedAt,
    };
  }),

  /**
   * « Renvoyer la confirmation »: the paid Consultation's e-mail again, as
   * it stands now (its slot, the link to its Réunion), with its Facture payée.
   */
  resendConfirmation: consultantProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const consultation = await ctx.prisma.consultation.findUnique({ where: { id: input.id }, select: { status: true, paidById: true } });
    if (!consultation) throw new TRPCError({ code: 'NOT_FOUND' });
    const message = consultation.status === 'PAID' && consultation.paidById ? await paidConfirmation(ctx.prisma, consultation.paidById) : null;
    if (!message) throw new TRPCError({ code: 'BAD_REQUEST', message: ADMIN_ERRORS.notMovable });
    await appMailer.send(message);
    return { sent: true };
  }),

  /** « Notes pour Aminata »: adds one, or changes it; `atSeconds` ties it to a moment of the video. */
  saveClientNote: consultantProcedure.input(clientNoteSchema).mutation(async ({ ctx, input }) => {
    await over(ctx.prisma, input.id);
    const data = { atSeconds: input.atSeconds, text: input.text };
    const note = input.noteId
      ? await ctx.prisma.consultationNote.update({ where: { id: input.noteId, consultationId: input.id }, data, select: { id: true } })
      : await ctx.prisma.consultationNote.create({ data: { ...data, consultationId: input.id }, select: { id: true } });
    return note;
  }),

  removeClientNote: consultantProcedure.input(z.object({ id: z.string().min(1), noteId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.consultationNote.deleteMany({ where: { id: input.noteId, consultationId: input.id } });
    return { removed: true };
  }),

  /** « Ses prochaines étapes »: adds one at the end, or rewrites it. */
  saveNextStep: consultantProcedure.input(nextStepSchema).mutation(async ({ ctx, input }) => {
    await over(ctx.prisma, input.id);
    if (input.stepId) {
      return ctx.prisma.consultationStep.update({ where: { id: input.stepId, consultationId: input.id }, data: { text: input.text }, select: { id: true } });
    }
    const last = await ctx.prisma.consultationStep.findFirst({ where: { consultationId: input.id }, orderBy: { position: 'desc' }, select: { position: true } });
    return ctx.prisma.consultationStep.create({ data: { consultationId: input.id, text: input.text, position: (last?.position ?? -1) + 1 }, select: { id: true } });
  }),

  removeNextStep: consultantProcedure.input(z.object({ id: z.string().min(1), stepId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.consultationStep.deleteMany({ where: { id: input.stepId, consultationId: input.id } });
    return { removed: true };
  }),

  /**
   * « Publier dans son espace »: from now on the Client sees the video, the
   * Transcription, the notes for them and the next steps (never the private
   * notes). The first time, they get « Votre enregistrement est prêt »;
   * later edits show without a new e-mail.
   */
  publish: consultantProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const consultation = await over(ctx.prisma, input.id);
    if (consultation.publishedAt) return { publishedAt: consultation.publishedAt, first: false };
    const publishedAt = new Date();
    await ctx.prisma.consultation.update({ where: { id: input.id }, data: { publishedAt } });
    const lang = toLocale(consultation.account.locale);
    await appMailer.send(
      consultationPublishedEmail({
        to: consultation.account.email,
        name: consultation.account.name,
        locale: lang,
        startsAt: consultation.startsAt,
        steps: consultation.nextSteps.map((s) => s.text),
        url: `${siteUrl()}/${lang}${consultationSpacePath(consultation.id)}`,
      }),
    );
    return { publishedAt, first: true };
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
