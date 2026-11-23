import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';
import { z } from 'zod';

import { TOPIC_KEYS } from '@/features/consultation/lib/booking-fields';

/** How long a chosen slot is kept for its Compte while it pays (docs/design/consultation.md, Lifecycle). */
export const HOLD_MINUTES = 15;

/** The longest « Votre situation en quelques lignes ». */
export const SITUATION_MAX = 500;

/** A WhatsApp number, read in the booker's country: E.164, or null when it is not a real number there. */
export function toE164(phone: string, country: string): string | null {
  if (!isSupportedCountry(country)) return null;
  const parsed = parsePhoneNumberFromString(phone, country as CountryCode);
  return parsed?.isValid() ? parsed.number : null;
}

/** Step 1, Vos coordonnées. Name and e-mail are the Compte's; a signed-in booker's come from it. */
export const contactSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email().max(254),
    country: z.string().refine(isSupportedCountry, 'country'),
    phone: z.string().trim().min(4).max(30),
    whatsappReminders: z.boolean(),
  })
  .transform((contact, ctx) => {
    const phone = toE164(contact.phone, contact.country);
    if (!phone) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'phone' });
      return z.NEVER;
    }
    return { ...contact, phone };
  });

export const bookInputSchema = z.object({
  /** The chosen start, as the slots gave it (ISO). */
  start: z.iso.datetime(),
  contact: contactSchema,
  locale: z.enum(['fr', 'en']).default('fr'),
});

/** Step 2, Préparer l'échange: everything optional. */
export const prepareSchema = z.object({
  topics: z.array(z.enum(TOPIC_KEYS)).max(TOPIC_KEYS.length).transform((topics) => [...new Set(topics)]),
  crsScore: z.number().int().min(0).max(1200).nullable(),
  itaReceived: z.boolean().nullable(),
  situation: z
    .string()
    .trim()
    .max(SITUATION_MAX)
    .transform((text) => text || null)
    .nullable(),
});

/** Who may act on a booking: its signed-in Compte, or the browser holding its secret. */
export const bookingRefSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(20).max(100).optional(),
});

/** Whether a HELD booking still keeps its slot at `now`. */
export const isHeld = (booking: { status: string; heldUntil: Date | null }, now: Date): boolean =>
  booking.status === 'HELD' && booking.heldUntil !== null && booking.heldUntil > now;
