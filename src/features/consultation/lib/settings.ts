import { z } from 'zod';

/**
 * Disponibilités (Tableau de bord → Consultations, right column): when a
 * Consultation can be booked, how long it lasts, and its price. All times are
 * Douala's. A day can have several ranges (« 09:00 – 12:00 · 14:00 – 16:00 »).
 */
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time');
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

export const weeklyRangeSchema = z
  .object({ day: z.number().int().min(1).max(7), start: time, end: time })
  .refine((range) => minutes(range.start) < minutes(range.end), { message: 'order', path: ['end'] });

export const settingsInputSchema = z
  .object({
    weeklyHours: z.array(weeklyRangeSchema).max(35),
    durationMinutes: z.number().int().min(15).max(180),
    bufferMinutes: z.number().int().min(0).max(120),
    minNoticeHours: z.number().int().min(0).max(24 * 14),
    horizonDays: z.number().int().min(1).max(180),
    moveCutoffHours: z.number().int().min(0).max(24 * 14),
    /** FCFA; null keeps payment closed (« arrive très bientôt »). */
    price: z.number().int().min(100).max(10_000_000).nullable(),
    blockedDates: z
      .array(z.iso.date())
      .max(366)
      .transform((days) => [...new Set(days)].toSorted()),
  })
  .superRefine((settings, ctx) => {
    // Two ranges of one day may not overlap.
    for (let day = 1; day <= 7; day++) {
      const ranges = settings.weeklyHours.filter((r) => r.day === day).toSorted((a, b) => minutes(a.start) - minutes(b.start));
      for (let i = 1; i < ranges.length; i++) {
        if (minutes(ranges[i]!.start) < minutes(ranges[i - 1]!.end)) ctx.addIssue({ code: 'custom', path: ['weeklyHours'], message: 'overlap' });
      }
    }
  });
export type SettingsInput = z.input<typeof settingsInputSchema>;

/** « Annuler ce créneau »: why, said to the Client in the « Déplacée » e-mail. */
export const cancelSlotSchema = z.object({ id: z.string().min(1), reason: z.string().trim().min(3).max(500) });
export const moveSlotSchema = z.object({ id: z.string().min(1), start: z.iso.datetime() });
export const notesSchema = z.object({ id: z.string().min(1), notes: z.string().max(20_000) });

/** A note for the Client (« Notes pour Aminata »), maybe at a moment of the Enregistrement. */
export const clientNoteSchema = z.object({
  id: z.string().min(1),
  noteId: z.string().min(1).optional(),
  atSeconds: z.number().int().min(0).max(6 * 3600).nullable(),
  text: z.string().trim().min(1).max(2000),
});
/** One of « Ses prochaines étapes ». */
export const nextStepSchema = z.object({ id: z.string().min(1), stepId: z.string().min(1).optional(), text: z.string().trim().min(1).max(300) });
