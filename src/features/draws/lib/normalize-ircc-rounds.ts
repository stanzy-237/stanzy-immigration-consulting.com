import { z } from 'zod';

import { groupFor, type DrawGroup } from '@/features/draws/lib/draw-type';

/** One IRCC round, cleaned. `raw` is the feed's object for it, untouched. */
export type NormalizedDraw = {
  /** IRCC's draw number as published: usually digits, once "91a"/"91b". */
  round: string;
  roundNumber: number;
  /** `YYYY-MM-DD`. */
  date: string;
  /** IRCC's drawName, as published (English). */
  typeLabel: string;
  group: DrawGroup;
  invitations: number;
  crsMin: number;
  irccUrl: string | null;
  raw: Record<string, unknown>;
};

export type NormalizeResult = {
  draws: NormalizedDraw[];
  skipped: { index: number; reason: string }[];
};

const IRCC_ORIGIN = 'https://www.canada.ca';

const feedSchema = z.object({ rounds: z.array(z.record(z.unknown())) });

/** "5,000" → 5000. Digits and thousands separators only. */
const count = z
  .string()
  .regex(/^\d{1,3}(,?\d{3})*$/, 'expected a whole number')
  .transform((value) => Number(value.replaceAll(',', '')));

const roundSchema = z.object({
  drawNumber: z.string().regex(/^\d+[a-z]?$/, 'expected a draw number'),
  drawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
  drawName: z.string().trim().min(1),
  drawSize: count,
  drawCRS: count,
  drawNumberURL: z.string().optional(),
});

/**
 * The notice link inside IRCC's HTML anchor, made public. Newer rounds point
 * at the CMS path (`/content/canadasite/en/…`), which canada.ca serves at `/en/…`.
 */
function noticeUrl(anchor: string | undefined): string | null {
  const href = anchor?.match(/href=['"]([^'"]+)['"]/)?.[1];
  if (!href) return null;
  return new URL(href.replace(/^\/content\/canadasite\//, '/'), IRCC_ORIGIN).toString();
}

/**
 * Cleans IRCC's `ee_rounds_123_en.json`. A round that doesn't parse is
 * reported in `skipped` and the others are still returned; a feed that isn't
 * shaped like IRCC rounds at all throws.
 */
export function normalizeIrccRounds(feed: unknown): NormalizeResult {
  const { rounds } = feedSchema.parse(feed);
  const result: NormalizeResult = { draws: [], skipped: [] };

  rounds.forEach((raw, index) => {
    const parsed = roundSchema.safeParse(raw);
    if (!parsed.success) {
      const reason = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      result.skipped.push({ index, reason });
      return;
    }
    const round = parsed.data;
    result.draws.push({
      round: round.drawNumber,
      roundNumber: Number.parseInt(round.drawNumber, 10),
      date: round.drawDate,
      typeLabel: round.drawName,
      group: groupFor(round.drawName),
      invitations: round.drawSize,
      crsMin: round.drawCRS,
      irccUrl: noticeUrl(round.drawNumberURL),
      raw,
    });
  });

  return result;
}
