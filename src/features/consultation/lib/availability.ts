import { z } from 'zod';

import type { Availability } from '@/features/consultation/lib/slots';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** `ConsultationSettings.weeklyHours`, read back from the database. */
export const weeklyHoursSchema = z.array(z.object({ day: z.number().int().min(1).max(7), start: time, end: time }));

const WEEKDAYS = [1, 2, 3, 4, 5];

/**
 * The Disponibilités until the consultant sets them in the Tableau de bord:
 * weekdays 09:00–17:00 Douala, 45 minutes with a 15-minute pause, booked at
 * least a day ahead and up to 30 days out. No price: it is never in code.
 */
export const DEFAULT_AVAILABILITY: Availability & { moveCutoffHours: number } = {
  durationMinutes: 45,
  bufferMinutes: 15,
  minNoticeHours: 24,
  horizonDays: 30,
  moveCutoffHours: 24,
  weeklyHours: WEEKDAYS.map((day) => ({ day, start: '09:00', end: '17:00' })),
  blockedDates: [],
};
