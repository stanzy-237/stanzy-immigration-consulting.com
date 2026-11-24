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

/** The two ways to pay: a Mobile Money network SasPay pushes to (or opens a page for), or card on SasPay's card page. */
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
  /** Card: SasPay's `card` network, charged in USD at the day's rate. `country`: where the payer is. */
  z.object({ kind: z.literal('card'), country: z.string().refine(isSupportedCountry, 'country') }),
]);

export const payInputSchema = bookingRefSchema.extend({
  locale: z.enum(['fr', 'en']).default('fr'),
  method,
});
export type PayInput = z.output<typeof payInputSchema>;

/** SasPay's card, listed by `GET /pricing/my-rates/` as network `card` in a country of its own (`XX`). */
export const CARD_NETWORK = 'card';

/** A payment as its page follows it: the booking it belongs to, and its own id. */
export const paymentRefSchema = bookingRefSchema.extend({ paymentId: z.uuid() });

/** Where a paid Consultation's Facture is downloaded: the payment's id (a random UUID) is its key. */
export const consultationInvoicePath = (paymentId: string): string => `/api/consultation/invoices/${paymentId}`;
