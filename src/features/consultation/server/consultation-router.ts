import { TRPCError } from '@trpc/server';

import { bookInputSchema, bookingRefSchema, contactSchema, HOLD_MINUTES, isHeld, prepareSchema } from '@/features/consultation/lib/booking';
import { freeSlots, MINUTE, type Busy, type SlotDay } from '@/features/consultation/lib/slots';
import { BOOKING_LOCK, busyTimes, loadAvailability, type Db } from '@/features/consultation/server/booking-calendar';
import { PAYMENT_ERRORS, payInputSchema, paymentRefSchema } from '@/features/consultation/lib/payment';
import { applyPromoSchema, normalizeCode } from '@/features/consultation/lib/promo';
import { createBookingAccount } from '@/features/consultation/server/booking-account';
import { paymentOptions, refreshPayment, startPayment } from '@/features/consultation/server/consultation-payments';
import { checkPromo, promoView, usedCounts } from '@/features/consultation/server/promo-codes';
import { saspay } from '@/features/consultation/server/saspay';
import { hashHoldToken, newHoldToken } from '@/features/consultation/server/hold-token';
import type { TRPCContext } from '@/server/trpc/context';
import { createTRPCRouter, humanOnly, publicProcedure } from '@/server/trpc/trpc';
import { z } from 'zod';

/** The booking errors the page explains, each with its own message. */
export const BOOKING_ERRORS = {
  /** Signed out, and the e-mail already has a Compte: sign in to book. */
  accountExists: 'ACCOUNT_EXISTS',
  /** Someone else holds or booked it, or it is no longer offered. */
  slotTaken: 'SLOT_TAKEN',
  /** The 15 minutes passed: « Créneau libéré ». */
  holdExpired: 'HOLD_EXPIRED',
} as const;

export type ConsultationSlots = {
  durationMinutes: number;
  /** How long before the start the Client can still move it. */
  moveCutoffHours: number;
  /** XAF, from the Tableau de bord; null until it is set. */
  price: number | null;
  days: SlotDay[];
};

/** The booking `ref` names, if its signed-in Compte or the browser holding its secret asks; else NOT_FOUND. */
async function ownedBooking(ctx: TRPCContext, ref: { id: string; token?: string }) {
  const booking = await ctx.prisma.consultation.findUnique({
    where: { id: ref.id },
    include: { account: { select: { name: true, email: true } } },
  });
  const mine =
    booking &&
    ((ctx.session && booking.accountId === ctx.session.account.id) ||
      (ref.token && booking.holdTokenHash && hashHoldToken(ref.token) === booking.holdTokenHash));
  if (!booking || !mine) throw new TRPCError({ code: 'NOT_FOUND' });
  return booking;
}

/** Consultation (#15): the public page's free slots, and booking one with a 15-minute hold. */
export const consultationRouter = createTRPCRouter({
  /** The free starts from today to the horizon, with the Consultation's length and price. */
  slots: publicProcedure.query(async ({ ctx }): Promise<ConsultationSlots> => {
    const now = new Date();
    const { availability, price } = await loadAvailability(ctx.prisma);
    return {
      durationMinutes: availability.durationMinutes,
      moveCutoffHours: availability.moveCutoffHours,
      price,
      days: freeSlots(availability, await busyTimes(ctx.prisma, now, availability.horizonDays), now),
    };
  }),

  /**
   * Step 1, Vos coordonnées: holds the chosen start for 15 minutes for the
   * booker's Compte. Signed in, it is theirs. Signed out, a Compte is created
   * for the e-mail (unverified, the Vérification e-mail sent) and the answer
   * carries a secret for this browser; an e-mail that already has a Compte is
   * refused (`ACCOUNT_EXISTS`): sign in to book. A Compte holds one slot at a
   * time: a new hold releases its previous one. `previous` (« Changer ») lets
   * a signed-out browser book again for the Compte it just created.
   */
  book: publicProcedure
    .use(humanOnly)
    .input(bookInputSchema)
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const { contact } = input;
      const { availability } = await loadAvailability(ctx.prisma);
      const startsAt = new Date(input.start);
      const offered = (busy: Busy[]) =>
        freeSlots(availability, busy, now).some((day) => day.starts.includes(startsAt.toISOString()));

      // « Changer »: the Compte that held the previous slot books again.
      const previous = input.previous ? await ownedBooking(ctx, input.previous) : null;
      let accountId = ctx.session?.account.id ?? previous?.accountId;

      // Checked before any Compte is created, so a taken slot creates nothing.
      if (!offered(await busyTimes(ctx.prisma, now, availability.horizonDays, accountId))) {
        throw new TRPCError({ code: 'CONFLICT', message: BOOKING_ERRORS.slotTaken });
      }

      let hold: { token: string; hash: string } | null = ctx.session ? null : previous ? newHoldToken() : null;
      if (!accountId) {
        const existing = await ctx.prisma.account.findUnique({ where: { email: contact.email }, select: { id: true } });
        if (existing) throw new TRPCError({ code: 'CONFLICT', message: BOOKING_ERRORS.accountExists });
        accountId = (
          await createBookingAccount({
            name: contact.name,
            email: contact.email,
            locale: input.locale,
            next: '/services/consultation/reserver',
          })
        ).id;
        hold = newHoldToken();
      }
      const owner = accountId;

      const booking = await ctx.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOKING_LOCK})`;
        // Their previous hold gives its slot back.
        await tx.consultation.updateMany({
          where: { accountId: owner, status: 'HELD', heldUntil: { gt: now } },
          data: { heldUntil: now },
        });
        // Checked again under the lock: someone may have held it meanwhile.
        if (!offered(await busyTimes(tx as unknown as Db, now, availability.horizonDays, owner))) {
          throw new TRPCError({ code: 'CONFLICT', message: BOOKING_ERRORS.slotTaken });
        }
        return tx.consultation.create({
          data: {
            accountId: owner,
            startsAt,
            durationMinutes: availability.durationMinutes,
            heldUntil: new Date(now.getTime() + HOLD_MINUTES * MINUTE),
            holdTokenHash: hold?.hash ?? null,
            country: contact.country,
            phone: contact.phone,
            whatsappReminders: contact.whatsappReminders,
            // « Créneau libéré », kept again: what they prepared comes along.
            ...(previous && {
              topics: previous.topics,
              crsScore: previous.crsScore,
              itaReceived: previous.itaReceived,
              situation: previous.situation,
            }),
          },
          select: { id: true, heldUntil: true },
        });
      });

      return { id: booking.id, heldUntil: booking.heldUntil!, token: hold?.token ?? null };
    }),

  /** The signed-in Compte's booking still held, if any: where the verification link leads back to. */
  current: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session) return null;
    const booking = await ctx.prisma.consultation.findFirst({
      where: { accountId: ctx.session.account.id, status: 'HELD', heldUntil: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, startsAt: true },
    });
    return booking;
  }),

  /** A booking as its page shows it: slot, hold, coordonnées and answers. */
  booking: publicProcedure.input(bookingRefSchema).query(async ({ ctx, input }) => {
    const booking = await ownedBooking(ctx, input);
    const { price } = await loadAvailability(ctx.prisma);
    const payment = await ctx.prisma.consultationPayment.findFirst({
      where: { consultationId: booking.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, createdAt: true },
    });
    const promo = await appliedPromo(ctx.prisma, booking.promoCodeId, price);
    return {
      payment,
      /** The Code promo applied, if any, with its reduction on the price. */
      promo,
      /** What is left to pay before SasPay's fees: the price less the code's reduction. */
      amount: price === null ? null : price - (promo?.discount ?? 0),
      meetingId: booking.meetingId,
      id: booking.id,
      status: booking.status,
      held: isHeld(booking, new Date()),
      startsAt: booking.startsAt,
      durationMinutes: booking.durationMinutes,
      heldUntil: booking.heldUntil,
      price,
      contact: {
        name: booking.account.name,
        email: booking.account.email,
        country: booking.country,
        phone: booking.phone,
        whatsappReminders: booking.whatsappReminders,
      },
      answers: {
        topics: booking.topics,
        crsScore: booking.crsScore,
        itaReceived: booking.itaReceived,
        situation: booking.situation,
      },
    };
  }),

  /** « Modifier » step 1: the country, WhatsApp number and reminders; name and e-mail are the Compte's. */
  contact: publicProcedure
    .input(bookingRefSchema.extend({ contact: contactSchema }))
    .mutation(async ({ ctx, input }) => {
      const booking = await ownedBooking(ctx, input);
      if (!isHeld(booking, new Date())) throw new TRPCError({ code: 'CONFLICT', message: BOOKING_ERRORS.holdExpired });
      const { country, phone, whatsappReminders } = input.contact;
      await ctx.prisma.consultation.update({ where: { id: booking.id }, data: { country, phone, whatsappReminders } });
      return { id: booking.id };
    }),

  /** Step 2, Préparer l'échange: saves the answers while the slot is still held. */
  prepare: publicProcedure
    .input(bookingRefSchema.extend({ answers: prepareSchema }))
    .mutation(async ({ ctx, input }) => {
      const booking = await ownedBooking(ctx, input);
      if (!isHeld(booking, new Date())) throw new TRPCError({ code: 'CONFLICT', message: BOOKING_ERRORS.holdExpired });
      await ctx.prisma.consultation.update({ where: { id: booking.id }, data: input.answers });
      return { id: booking.id };
    }),

  /**
   * « Appliquer » a Code promo at checkout: it must exist, apply to the
   * Consultation, not be over, have a place left (places paid so far) and, if
   * « Une seule fois par Compte », not have been paid with by this Compte.
   * Each refusal is its own message; an unknown code suggests the live code it
   * most likely meant. Kept on the booking until paid; checked again then.
   */
  applyPromo: publicProcedure
    .use(humanOnly)
    .input(applyPromoSchema)
    .mutation(async ({ ctx, input }) => {
      const booking = await ownedBooking(ctx, input);
      if (!isHeld(booking, new Date())) throw new TRPCError({ code: 'CONFLICT', message: BOOKING_ERRORS.holdExpired });
      const verdict = await checkPromo(ctx.prisma, {
        code: normalizeCode(input.code),
        accountId: booking.accountId,
        consultationId: booking.id,
        service: 'CONSULTATION',
        now: new Date(),
      });
      if (!verdict.ok) {
        // An unknown code carries the one it most likely meant: « PROMO_UNKNOWN:BLACKFRIDAY ».
        throw new TRPCError({ code: 'BAD_REQUEST', message: verdict.suggestion ? `${verdict.error}:${verdict.suggestion}` : verdict.error });
      }
      await ctx.prisma.consultation.update({ where: { id: booking.id }, data: { promoCodeId: verdict.code.id } });
      return { code: verdict.code.code };
    }),

  /** « Retirer » the Code promo: back to the full price. */
  removePromo: publicProcedure.input(bookingRefSchema).mutation(async ({ ctx, input }) => {
    const booking = await ownedBooking(ctx, input);
    await ctx.prisma.consultation.update({ where: { id: booking.id }, data: { promoCodeId: null } });
    return { id: booking.id };
  }),

  /**
   * Step 3's choices: the networks of `country` with their fee on the price,
   * and the countries one can pay from. `open` is false when SasPay is not set
   * up here (no key, or a live key outside production): the page says so.
   */
  paymentOptions: publicProcedure
    .input(z.object({ country: z.string().length(2) }))
    .query(async ({ ctx, input }) => {
      const { price } = await loadAvailability(ctx.prisma);
      const client = saspay();
      if (!client || price === null) return { open: false as const, price, networks: [], card: null };
      try {
        return { open: true as const, price, ...(await paymentOptions(client, input.country.toUpperCase(), price)) };
      } catch (error) {
        console.error('[saspay] could not list networks', error instanceof Error ? error.message : error);
        return { open: false as const, price, networks: [], card: null };
      }
    }),

  /** « Payer »: one SasPay payment for the held booking; says whether to wait for the phone or open SasPay's page. */
  pay: publicProcedure
    .use(humanOnly)
    .input(payInputSchema)
    .mutation(async ({ ctx, input }) => {
      const booking = await ownedBooking(ctx, input);
      if (booking.status === 'PAID') throw new TRPCError({ code: 'CONFLICT', message: PAYMENT_ERRORS.paid });
      if (!isHeld(booking, new Date())) throw new TRPCError({ code: 'CONFLICT', message: BOOKING_ERRORS.holdExpired });
      const client = saspay();
      if (!client) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: PAYMENT_ERRORS.closed });
      const { price } = await loadAvailability(ctx.prisma);
      if (price === null) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: PAYMENT_ERRORS.noPrice });
      return startPayment(ctx.prisma, client, booking, input, price);
    }),

  /**
   * A payment as the page follows it. A PENDING one is checked with SasPay
   * (at most every few seconds, or now with `force`: « Vérifier maintenant »),
   * so the page moves on without waiting for the webhook.
   */
  payment: publicProcedure
    .input(paymentRefSchema.extend({ force: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const booking = await ownedBooking(ctx, input);
      const found = await ctx.prisma.consultationPayment.findFirst({ where: { id: input.paymentId, consultationId: booking.id } });
      if (!found) throw new TRPCError({ code: 'NOT_FOUND' });
      const client = saspay();
      const payment = client ? await refreshPayment(ctx.prisma, client, found, input.force) : found;
      return paymentView(ctx.prisma, payment);
    }),

  /**
   * Where SasPay's page sends the payer back (`/reserver/paiement/<id>`),
   * maybe in another tab: the payment's id, a random UUID, is the only key.
   * Says how it went and, once paid, the slot and receipt lines; nothing else.
   */
  paymentReturn: publicProcedure.input(z.object({ paymentId: z.uuid() })).query(async ({ ctx, input }) => {
    const found = await ctx.prisma.consultationPayment.findUnique({ where: { id: input.paymentId } });
    if (!found) throw new TRPCError({ code: 'NOT_FOUND' });
    const client = saspay();
    const payment = client ? await refreshPayment(ctx.prisma, client, found) : found;
    return paymentView(ctx.prisma, payment);
  }),
});

/** What the payment screens show of one attempt and, once paid, its Consultation. */
async function paymentView(prisma: Db, payment: ConsultationPaymentRow) {
  const consultation = await prisma.consultation.findUniqueOrThrow({
    where: { id: payment.consultationId },
    select: { status: true, startsAt: true, durationMinutes: true, heldUntil: true, meetingId: true, paidById: true, account: { select: { name: true } } },
  });
  const paid = consultation.status === 'PAID' && consultation.paidById === payment.id;
  return {
    id: payment.id,
    status: payment.status,
    network: payment.network,
    networkName: payment.networkName,
    phone: payment.phone,
    amount: payment.amount,
    currency: payment.currency,
    /** The Code promo's reduction on this payment (FCFA), and the code. */
    discount: payment.discount,
    promoCode: payment.promoCodeId ? ((await prisma.promoCode.findUnique({ where: { id: payment.promoCodeId }, select: { code: true } }))?.code ?? null) : null,
    charged: payment.charged === null ? null : Number(payment.charged),
    fee: payment.fee === null ? null : Number(payment.fee),
    /** The currency of `fee` and `charged`, once paid (card: USD). */
    settledCurrency: payment.settledCurrency,
    checkoutUrl: payment.checkoutUrl,
    createdAt: payment.createdAt,
    settledAt: payment.settledAt,
    consultation: paid
      ? {
          firstName: consultation.account.name.trim().split(/\s+/)[0] ?? '',
          startsAt: consultation.startsAt,
          durationMinutes: consultation.durationMinutes,
          meetingId: consultation.meetingId,
        }
      : null,
    heldUntil: consultation.status === 'HELD' ? consultation.heldUntil : null,
  };
}

type ConsultationPaymentRow = Awaited<ReturnType<Db['consultationPayment']['findUniqueOrThrow']>>;

/** The Code promo applied to a booking, as the checkout shows it; null once deleted or without one. */
async function appliedPromo(prisma: Db, promoCodeId: string | null, price: number | null) {
  if (!promoCodeId || price === null) return null;
  const code = await prisma.promoCode.findFirst({ where: { id: promoCodeId, deletedAt: null } });
  if (!code) return null;
  const used = (await usedCounts(prisma, [code.id])).get(code.id) ?? 0;
  return promoView(code, price, used);
}
