import { z } from 'zod';

import { ETAPE_EMOJIS } from '@/features/parcours/data/etapes';
import { ETAPE_COLORS } from '@/features/parcours/data/palette';

/** A calendar day, `YYYY-MM-DD`. */
export const calendarDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** What the form sends for one Étape; the server derives a missing code. */
export const etapeInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
  code: z.string().trim().max(10).optional(),
  emoji: z.enum(ETAPE_EMOJIS),
  color: z.enum(ETAPE_COLORS),
  date: calendarDay,
  note: z.string().trim().max(500).optional(),
});

export type EtapeInput = z.input<typeof etapeInputSchema>;

/** One Étape as the client reads it. */
export type Etape = {
  id: string;
  label: string;
  code: string;
  emoji: string;
  color: string;
  date: string;
  note: string;
};
