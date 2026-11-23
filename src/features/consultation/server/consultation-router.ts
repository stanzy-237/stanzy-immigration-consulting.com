import { DEFAULT_AVAILABILITY, weeklyHoursSchema } from '@/features/consultation/lib/availability';
import { freeSlots, type Availability, type SlotDay } from '@/features/consultation/lib/slots';
import { createTRPCRouter, publicProcedure } from '@/server/trpc/trpc';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export type ConsultationSlots = {
  durationMinutes: number;
  /** How long before the start the Client can still move it. */
  moveCutoffHours: number;
  /** XAF, from the Tableau de bord; null until it is set. */
  price: number | null;
  days: SlotDay[];
};

/** Consultation (#15): the public page's free slots; booking and payment come next. */
export const consultationRouter = createTRPCRouter({
  /** The free starts from today to the horizon, with the Consultation's length and price. */
  slots: publicProcedure.query(async ({ ctx }): Promise<ConsultationSlots> => {
    const now = new Date();
    const settings = await ctx.prisma.consultationSettings.findUnique({ where: { id: 'default' } });
    const availability: Availability & { moveCutoffHours: number } = settings
      ? { ...settings, weeklyHours: weeklyHoursSchema.parse(settings.weeklyHours) }
      : DEFAULT_AVAILABILITY;

    // Every Réunion still planned takes its time, whatever it is about; the Salle personnelle is always open.
    const meetings = await ctx.prisma.meeting.findMany({
      where: {
        status: 'SCHEDULED',
        kind: { in: ['SCHEDULED', 'INSTANT'] },
        endedAt: null,
        startsAt: { gt: new Date(now.getTime() - DAY), lt: new Date(now.getTime() + (availability.horizonDays + 2) * DAY) },
      },
      select: { startsAt: true, durationMinutes: true },
    });
    const busy = meetings.map((m) => ({ startsAt: m.startsAt, endsAt: new Date(m.startsAt.getTime() + m.durationMinutes * MINUTE) }));

    return {
      durationMinutes: availability.durationMinutes,
      moveCutoffHours: availability.moveCutoffHours,
      price: settings?.price ?? null,
      days: freeSlots(availability, busy, now),
    };
  }),
});
