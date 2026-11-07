import { z } from 'zod';

import { REASON_MAX } from '@/features/accompagnement/lib/interest-schema';
import { SCHEDULE_MAX } from '@/features/contracts/lib/contract-schema';

/** What the Client may add when ordering (the amount to justify, a date…). */
export const ORDER_NOTE_MAX = 1000;

const id = z.string().min(1);

/** The private link's secret: 32 base64url characters. */
export const tokenInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/) });

export const orderInput = tokenInput.extend({
  note: z.string().trim().max(ORDER_NOTE_MAX),
  accepted: z.literal(true),
});

export const ORDER_FILTERS = ['SUBMITTED', 'APPROVED', 'REJECTED'] as const;
export const orderListInput = z.object({ filter: z.enum(ORDER_FILTERS) });

/** Approving opens the Dossier and sends the service's Contrat at `amount`, in `locale`. */
export const approveOrderInput = z.object({
  id,
  locale: z.enum(['fr', 'en']),
  amount: z.number().int().positive().max(1_000_000_000),
  schedule: z.string().trim().min(1).max(SCHEDULE_MAX),
});

export const rejectOrderInput = z.object({ id, note: z.string().trim().max(REASON_MAX) });

/** The private link of a service, on the public site. */
export const offerPath = (token: string): string => `/services/offre/${token}`;

/** A fresh secret for a private link. */
export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
