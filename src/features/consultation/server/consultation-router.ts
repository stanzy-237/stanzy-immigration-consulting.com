import { TRPCError } from '@trpc/server';

import { DEFAULT_AVAILABILITY, weeklyHoursSchema, type ConsultationAvailability } from '@/features/consultation/lib/availability';
import { bookInputSchema, bookingRefSchema, contactSchema, HOLD_MINUTES, isHeld, prepareSchema } from '@/features/consultation/lib/booking';
import { freeSlots, MINUTE, type Busy, type SlotDay } from '@/features/consultation/lib/slots';
import { createBookingAccount } from '@/features/consultation/server/booking-account';
import { hashHoldToken, newHoldToken } from '@/features/consultation/server/hold-token';
import type { TRPCContext } from '@/server/trpc/context';
import { createTRPCRouter, humanOnly, publicProcedure } from '@/server/trpc/trpc';

const DAY = 24 * 60 * MINUTE;

/** Every booking takes its turn behind this lock, so two people never hold the same slot. */
const BOOKING_LOCK = 15_2026;

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

type Db = TRPCContext['prisma'];

async function loadAvailability(prisma: Db): Promise<{ availability: ConsultationAvailability; price: number | null }> {
  const settings = await prisma.consultationSettings.findUnique({ where: { id: 'default' } });
  return {
    availability: settings ? { ...settings, weeklyHours: weeklyHoursSchema.parse(settings.weeklyHours) } : DEFAULT_AVAILABILITY,
    price: settings?.price ?? null,
  };
}

/**
 * The time already taken from now to the horizon: every Réunion still planned
 * (whatever it is about; the Salle personnelle is always open), and every
 * Consultation held or paid but not yet in a Réunion. `holder` leaves out that
 * Compte's own holds, so a booker never collides with the slot they hold.
 */
async function busyTimes(prisma: Db, now: Date, horizonDays: number, holder?: string): Promise<Busy[]> {
  const window = { gt: new Date(now.getTime() - DAY), lt: new Date(now.getTime() + (horizonDays + 2) * DAY) };
  const [meetings, bookings] = await Promise.all([
    prisma.meeting.findMany({
      where: { status: 'SCHEDULED', kind: { in: ['SCHEDULED', 'INSTANT'] }, endedAt: null, startsAt: window },
      select: { startsAt: true, durationMinutes: true },
    }),
    prisma.consultation.findMany({
      where: {
        startsAt: window,
        meetingId: null,
        OR: [{ status: 'PAID' }, { status: 'HELD', heldUntil: { gt: now } }],
        ...(holder ? { NOT: { accountId: holder, status: 'HELD' } } : {}),
      },
      select: { startsAt: true, durationMinutes: true },
    }),
  ]);
  return [...meetings, ...bookings].map((b) => ({ startsAt: b.startsAt, endsAt: new Date(b.startsAt.getTime() + b.durationMinutes * MINUTE) }));
}

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
    return {
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
});
