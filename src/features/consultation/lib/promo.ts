import { z } from 'zod';

import { bookingRefSchema } from '@/features/consultation/lib/booking';

/**
 * Codes promo (docs/design/consultation.md, Promo codes). Applied at checkout
 * only; a place counts when the payment succeeds; deleting stops a code at
 * once. These are the rules both the checkout and the Tableau de bord follow.
 */

/** The services a code can apply to: the Consultation, and the Dossier services. */
export const PROMO_SERVICES = ['CONSULTATION', 'ACCOMPAGNEMENT', 'VERIFICATION', 'EDE'] as const;
export type PromoService = (typeof PROMO_SERVICES)[number];

/** What a payment can never go under: SasPay can't take a free Consultation. */
export const MIN_TO_PAY = 100;

/** « blackfriday » or « Black Friday » → BLACKFRIDAY: how codes are stored and compared. */
export const normalizeCode = (raw: string): string => raw.normalize('NFKD').replace(/[^A-Za-z0-9_-]/g, '').toUpperCase();

/** Why a code can't be used here, each with its own message (mobile: in the promo sheet). */
export const PROMO_ERRORS = {
  /** Never existed, or deleted. Maybe a typo: the nearest live code is suggested. */
  unknown: 'PROMO_UNKNOWN',
  /** Past its end date (`Offre terminée`). */
  ended: 'PROMO_ENDED',
  /** No place left (`Places épuisées`). */
  soldOut: 'PROMO_SOLD_OUT',
  /** « Une seule fois par Compte », and this Compte already paid with it (`Déjà utilisé`). */
  used: 'PROMO_USED',
  /** It doesn't apply to the Consultation. */
  service: 'PROMO_NOT_FOR_SERVICE',
  /** Just before paying, the last place went to someone else (`3d Dernière place partie`). */
  lastPlace: 'PROMO_LAST_PLACE',
} as const;

export type PromoRule = {
  reductionType: 'PERCENT' | 'AMOUNT';
  reductionValue: number;
  places: number | null;
  endsAt: Date | null;
};

/**
 * The reduction on `price`, in FCFA: a percentage (rounded to the franc) or a
 * fixed amount, never leaving less than MIN_TO_PAY to pay.
 */
export function discountFor(price: number, code: Pick<PromoRule, 'reductionType' | 'reductionValue'>): number {
  const raw = code.reductionType === 'PERCENT' ? Math.round((price * code.reductionValue) / 100) : code.reductionValue;
  return Math.max(0, Math.min(raw, price - MIN_TO_PAY));
}

export type PromoStatus = 'ACTIVE' | 'SOLD_OUT' | 'ENDED';

/** Actif, Épuisé or Terminé, as the dashboard list shows it. `used`: payments that succeeded with it. */
export function promoStatus(code: Pick<PromoRule, 'places' | 'endsAt'>, used: number, now: Date): PromoStatus {
  if (code.endsAt && code.endsAt <= now) return 'ENDED';
  if (code.places !== null && used >= code.places) return 'SOLD_OUT';
  return 'ACTIVE';
}

/** Edit distance, for « Vérifiez l'orthographe : BLACKFRIDAY ? ». */
function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length]!;
}

/** The live code `typed` most likely meant (at most 2 letters off), or null. */
export function nearestCode(typed: string, live: string[]): string | null {
  let best: { code: string; d: number } | null = null;
  for (const code of live) {
    const d = distance(typed, code);
    if (d > 0 && d <= 2 && (!best || d < best.d)) best = { code, d };
  }
  return best?.code ?? null;
}

/** « Nouveau code » in the Tableau de bord. `endsAt` is the end in Douala time, as the form gives it. */
export const promoCreateSchema = z
  .object({
    code: z
      .string()
      .transform(normalizeCode)
      .pipe(z.string().min(3, 'code').max(30, 'code')),
    reductionType: z.enum(['PERCENT', 'AMOUNT']),
    reductionValue: z.number().int().positive(),
    services: z.array(z.enum(PROMO_SERVICES)).min(1, 'services').transform((all) => [...new Set(all)]),
    places: z.number().int().min(1).max(100_000).nullable(),
    endsAt: z.date().nullable(),
    oncePerAccount: z.boolean(),
  })
  .refine((value) => value.reductionType === 'AMOUNT' || value.reductionValue <= 99, { path: ['reductionValue'], message: 'percent' });
export type PromoCreateInput = z.input<typeof promoCreateSchema>;

/** Applying a code at checkout. */
export const applyPromoSchema = bookingRefSchema.extend({ code: z.string().trim().min(1).max(40) });
