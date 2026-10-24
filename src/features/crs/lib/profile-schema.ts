import { z } from 'zod';

import { EDUCATION_LEVELS, HIGH_WAGE_LEVELS } from '@/features/crs/data/crs-criteria';
import { LANGUAGE_TESTS } from '@/features/crs/data/language-tests';
import { MARITAL_STATUSES, type CrsProfile } from '@/features/crs/lib/compute-crs';

/**
 * The shape of a CRS profile, for input that crosses a trust boundary (tRPC,
 * browser storage). Whether the values make sense is the engine's job.
 */
const languageResult = z
  .object({
    test: z.enum(LANGUAGE_TESTS),
    scores: z.object({
      speaking: z.number(),
      listening: z.number(),
      reading: z.number(),
      writing: z.number(),
    }),
  })
  .nullable();

const years = z.number().int().min(0).max(50);

export const crsProfileSchema = z.object({
  maritalStatus: z.enum(MARITAL_STATUSES),
  spouse: z
    .object({
      isCanadianCitizenOrPR: z.boolean(),
      accompanying: z.boolean(),
      education: z.enum(EDUCATION_LEVELS),
      canadianWorkYears: years,
      language: languageResult,
    })
    .optional(),
  age: z.number(),
  education: z.enum(EDUCATION_LEVELS),
  firstLanguage: languageResult,
  secondLanguage: languageResult,
  canadianWorkYears: years,
  foreignWorkYears: years,
  certificateOfQualification: z.boolean(),
  canadianStudy: z.enum(['none', 'oneOrTwoYears', 'threePlusYears']),
  provincialNomination: z.boolean(),
  siblingInCanada: z.boolean(),
  highWageWork: z.enum(HIGH_WAGE_LEVELS),
  highWageJobOffer: z.enum(HIGH_WAGE_LEVELS),
}) satisfies z.ZodType<CrsProfile>;
