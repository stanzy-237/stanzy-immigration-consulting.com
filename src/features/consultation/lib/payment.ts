import { isSupportedCountry } from 'libphonenumber-js/min';
import { z } from 'zod';

import { bookingRefSchema, toE164 } from '@/features/consultation/lib/booking';

/** Paying keeps the slot this much longer, so a payer validating on their phone doesn't lose it… */
export const PAYING_MINUTES = 10;
/** …but never past this long after it was first held. */
export const HOLD_LIMIT_MINUTES = 45;

/** The payment errors step 3 explains, each with its own message. */
export const PAYMENT_ERRORS = {
  /** No SasPay key here (or the wrong kind): the page says payment opens soon. */
  closed: 'PAYMENT_CLOSED',
  /** The price is not set in the Tableau de bord yet. */
  noPrice: 'PRICE_MISSING',
  /** That network is not offered in that country (any more). */
  network: 'NETWORK_UNAVAILABLE',
  /** Orange Money CI / BF: the USSD code is missing or was refused. */
  otp: 'OTP_REQUIRED',
  /** SasPay refused at once (number, route…): nothing was charged. */
  refused: 'PAYMENT_REFUSED',
  /** A payment is already paid for this booking. */
  paid: 'ALREADY_PAID',
} as const;

/** The two ways to pay: a network SasPay pushes to (or opens a page for), or SasPay's own page (card, other countries). */
const method = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('network'),
      country: z.string().refine(isSupportedCountry, 'country'),
      network: z.string().trim().min(2).max(40),
      phone: z.string().trim().min(4).max(30),
      /** The code Orange Money CI / BF gives by USSD before paying. */
      otp: z
        .string()
        .trim()
        .regex(/^\d{4,8}$/, 'otp')
        .optional(),
    })
    .transform((value, ctx) => {
      const phone = toE164(value.phone, value.country);
      if (!phone) {
        ctx.addIssue({ code: 'custom', path: ['phone'], message: 'phone' });
        return z.NEVER;
      }
      return { ...value, phone };
    }),
  z.object({ kind: z.literal('checkout'), country: z.string().refine(isSupportedCountry, 'country') }),
]);

export const payInputSchema = bookingRefSchema.extend({
  locale: z.enum(['fr', 'en']).default('fr'),
  method,
});
export type PayInput = z.output<typeof payInputSchema>;

/** A payment as its page follows it: the booking it belongs to, and its own id. */
export const paymentRefSchema = bookingRefSchema.extend({ paymentId: z.uuid() });
