import { DEFAULT_AVAILABILITY, weeklyHoursSchema, type ConsultationAvailability } from '@/features/consultation/lib/availability';
import { MINUTE, type Busy } from '@/features/consultation/lib/slots';
import type { TRPCContext } from '@/server/trpc/context';

export type Db = TRPCContext['prisma'];

const DAY = 24 * 60 * MINUTE;

/** Every booking and payment takes its turn behind this lock, so two people never get the same slot. */
export const BOOKING_LOCK = 15_2026;

/** The Disponibilités and the price set in the Tableau de bord, or the defaults. */
export async function loadAvailability(prisma: Db): Promise<{ availability: ConsultationAvailability; price: number | null }> {
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
export async function busyTimes(
  prisma: Db,
  now: Date,
  horizonDays: number,
  holder?: string,
  /** A Réunion being moved: its own time doesn't block it. */
  exceptMeetingId?: string,
): Promise<Busy[]> {
  const window = { gt: new Date(now.getTime() - DAY), lt: new Date(now.getTime() + (horizonDays + 2) * DAY) };
  const [meetings, bookings] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        status: 'SCHEDULED',
        kind: { in: ['SCHEDULED', 'INSTANT'] },
        endedAt: null,
        startsAt: window,
        ...(exceptMeetingId ? { id: { not: exceptMeetingId } } : {}),
      },
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

/** Whether [startsAt, startsAt + minutes) overlaps anything in `busy`. */
export const overlapsBusy = (busy: Busy[], startsAt: Date, minutes: number): boolean => {
  const endsAt = startsAt.getTime() + minutes * MINUTE;
  return busy.some((b) => b.startsAt.getTime() < endsAt && b.endsAt.getTime() > startsAt.getTime());
};
