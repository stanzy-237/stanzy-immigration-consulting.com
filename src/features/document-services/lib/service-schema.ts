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

/** How a prerequisite is handed over: a file (any photo or PDF), or a signature drawn on screen. */
export const PREREQUISITE_TYPES = ['file', 'signature'] as const;
/** The questionnaires a service can ask with its request (src/features/document-services/lib/requirements.ts). */
export const QUESTIONNAIRES = ['proofOfFunds', 'proofOfFundsNoFunds'] as const;
export type Questionnaire = (typeof QUESTIONNAIRES)[number];

/**
 * What the Client hands over for the service, named in both languages. `kind`:
 * a Checklist document whose copy in the Dossier also counts (one way only).
 * `when: 'donation'`: only asked when the funds are a donation.
 */
export const prerequisite = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  fr: z.string().trim().min(2).max(NAME_MAX),
  en: z.string().trim().min(2).max(NAME_MAX),
  type: z.enum(PREREQUISITE_TYPES),
  kind: z.enum(DOCUMENTS).nullable(),
  when: z.enum(['donation']).nullable(),
});
export type Prerequisite = z.infer<typeof prerequisite>;

/** A key for a prerequisite from its French name (« Bulletin n° 3 » → `bulletin-n-3`). */
export const prerequisiteKey = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '') || 'piece';

/** A service's stored prerequisites, those saved before keys and types read as files keyed by name. */
export function prerequisitesOf(value: unknown): Prerequisite[] {
  const items = Array.isArray(value) ? (value as Partial<Prerequisite>[]) : [];
  return items.map((item) => ({
    key: item.key ?? prerequisiteKey(item.fr ?? ''),
    fr: item.fr ?? '',
    en: item.en ?? '',
    type: item.type ?? 'file',
    kind: item.kind ?? null,
    when: item.when ?? null,
  }));
}

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
    /** The turnaround in days, from the request's start date: the countdown the Client sees. */
    turnaroundDays: z.number().int().min(1).max(365).nullable(),
    conditions: texts(TEXT_MAX),
    contractTitle: texts(NAME_MAX, 2),
    contractBody: texts(CONTRACT_MAX, 10),
    priceKind: z.enum(['FIXED', 'PERCENT']),
    /** XAF for FIXED; hundredths of a percent for PERCENT. */
    price: z.number().int().min(0).max(1_000_000_000),
    unit: texts(NAME_MAX),
    documentKinds: z.array(z.enum(DOCUMENTS)).max(DOCUMENTS.length),
    prerequisites: z.array(prerequisite).max(20),
    questionnaire: z.enum(QUESTIONNAIRES).nullable(),
  })
  .refine((service) => new Set(service.prerequisites.map((item) => item.key)).size === service.prerequisites.length, {
    message: 'SERVICE_PREREQUISITE_DUPLICATE',
    path: ['prerequisites'],
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
