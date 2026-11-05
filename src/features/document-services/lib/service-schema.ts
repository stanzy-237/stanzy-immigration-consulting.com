import { z } from 'zod';

import { DOCUMENTS } from '@/features/checklist/lib/build-checklist';
import type { Locale } from '@/i18n/routing';

export const NAME_MAX = 120;
export const TEXT_MAX = 2000;
export const CONTRACT_MAX = 20_000;
/** 100 % in hundredths of a percent. */
export const PERCENT_MAX = 10_000;

/** A text in each of the site's languages. */
export type Texts = Record<Locale, string>;

const texts = (max: number, min = 0) => z.object({ fr: z.string().trim().min(min).max(max), en: z.string().trim().min(min).max(max) });

/** A Service documentaire as the consultant writes it in the Tableau de bord (#80). */
export const serviceInput = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    active: z.boolean(),
    name: texts(NAME_MAX, 2),
    summary: texts(TEXT_MAX),
    provides: texts(TEXT_MAX),
    turnaround: texts(NAME_MAX),
    conditions: texts(TEXT_MAX),
    contractTitle: texts(NAME_MAX, 2),
    contractBody: texts(CONTRACT_MAX, 10),
    priceKind: z.enum(['FIXED', 'PERCENT']),
    /** XAF for FIXED; hundredths of a percent for PERCENT. */
    price: z.number().int().min(0).max(1_000_000_000),
    unit: texts(NAME_MAX),
    documentKinds: z.array(z.enum(DOCUMENTS)).max(DOCUMENTS.length),
  })
  .refine((service) => service.priceKind === 'FIXED' || service.price <= PERCENT_MAX, {
    message: 'SERVICE_PERCENT_TOO_HIGH',
    path: ['price'],
  });
export type ServiceInput = z.infer<typeof serviceInput>;

export const saveServiceInput = z.object({ id: z.string().min(1).nullable(), service: serviceInput });
export const slugInput = z.object({ slug: z.string().min(1).max(60) });

/** A text in `locale`, else in the other language, so nothing shows empty. */
export function textIn(value: unknown, locale: string): string {
  const all = (value ?? {}) as Partial<Texts>;
  return (locale === 'en' ? all.en || all.fr : all.fr || all.en) ?? '';
}

/**
 * What a service costs for one order: its price for FIXED, else its share of
 * `base` (the funds to justify), rounded to the franc. Null when a PERCENT
 * service has no base yet: the consultant enters the amount.
 */
export function amountFor(service: { priceKind: 'FIXED' | 'PERCENT'; price: number }, base?: number): number | null {
  if (service.priceKind === 'FIXED') return service.price;
  if (base === undefined) return null;
  return Math.round((base * service.price) / PERCENT_MAX);
}
