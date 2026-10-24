import { z } from 'zod';

import { EDUCATION_LEVELS, HIGH_WAGE_LEVELS, type EducationLevel, type HighWageLevel } from '@/features/crs/data/crs-criteria';
import { LANGUAGE_TESTS, type LanguageTest } from '@/features/crs/data/language-tests';
import {
  ABILITIES,
  isPartnered,
  MARITAL_STATUSES,
  type Ability,
  type CrsProfile,
  type LanguageResult,
} from '@/features/crs/lib/compute-crs';

/**
 * The calculator's answers as the visitor types them (strings for typed
 * numbers, so a half-typed "6," survives). `toProfile` turns them into the
 * engine's profile; `fromProfile` reopens a saved one.
 */
export type LanguageForm = { test: LanguageTest | 'none'; scores: Record<Ability, string> };

export type CrsForm = {
  maritalStatus: CrsProfile['maritalStatus'];
  spouseAccompanying: boolean;
  spouseIsCanadianCitizenOrPR: boolean;
  spouseEducation: EducationLevel;
  spouseCanadianWorkYears: number;
  spouseLanguage: LanguageForm;
  age: string;
  education: EducationLevel;
  firstLanguage: LanguageForm;
  secondLanguage: LanguageForm | null;
  canadianWorkYears: number;
  foreignWorkYears: number;
  certificateOfQualification: boolean;
  canadianStudy: CrsProfile['canadianStudy'];
  provincialNomination: boolean;
  siblingInCanada: boolean;
  highWageWork: HighWageLevel;
  highWageJobOffer: HighWageLevel;
};

const emptyScores = (): Record<Ability, string> => ({ speaking: '', listening: '', reading: '', writing: '' });
export const emptyLanguage = (): LanguageForm => ({ test: 'none', scores: emptyScores() });

export const DEFAULT_FORM: CrsForm = {
  maritalStatus: 'single',
  spouseAccompanying: false,
  spouseIsCanadianCitizenOrPR: false,
  spouseEducation: 'lessThanSecondary',
  spouseCanadianWorkYears: 0,
  spouseLanguage: emptyLanguage(),
  age: '30',
  education: 'bachelors',
  firstLanguage: emptyLanguage(),
  secondLanguage: null,
  canadianWorkYears: 0,
  foreignWorkYears: 0,
  certificateOfQualification: false,
  canadianStudy: 'none',
  provincialNomination: false,
  siblingInCanada: false,
  highWageWork: 'none',
  highWageJobOffer: 'none',
};

/** A typed number, accepting a French decimal comma; NaN when blank or not a number. */
export const parseScore = (raw: string): number => (raw.trim() === '' ? Number.NaN : Number(raw.trim().replace(',', '.')));

/** A test counts once a test is chosen and all four results are typed. */
function toLanguage(form: LanguageForm | null): LanguageResult | null {
  if (!form || form.test === 'none') return null;
  if (ABILITIES.some((a) => form.scores[a].trim() === '')) return null;
  const scores = Object.fromEntries(ABILITIES.map((a) => [a, parseScore(form.scores[a])])) as Record<Ability, number>;
  return { test: form.test, scores };
}

export function toProfile(form: CrsForm): CrsProfile {
  return {
    maritalStatus: form.maritalStatus,
    spouse: isPartnered(form.maritalStatus)
      ? {
          accompanying: form.spouseAccompanying,
          isCanadianCitizenOrPR: form.spouseIsCanadianCitizenOrPR,
          education: form.spouseEducation,
          canadianWorkYears: form.spouseCanadianWorkYears,
          language: toLanguage(form.spouseLanguage),
        }
      : undefined,
    age: parseScore(form.age),
    education: form.education,
    firstLanguage: toLanguage(form.firstLanguage),
    secondLanguage: toLanguage(form.secondLanguage),
    canadianWorkYears: form.canadianWorkYears,
    foreignWorkYears: form.foreignWorkYears,
    certificateOfQualification: form.certificateOfQualification,
    canadianStudy: form.canadianStudy,
    provincialNomination: form.provincialNomination,
    siblingInCanada: form.siblingInCanada,
    highWageWork: form.highWageWork,
    highWageJobOffer: form.highWageJobOffer,
  };
}

const fromLanguage = (result: LanguageResult | null | undefined): LanguageForm =>
  result
    ? { test: result.test, scores: Object.fromEntries(ABILITIES.map((a) => [a, String(result.scores[a])])) as Record<Ability, string> }
    : emptyLanguage();

export function fromProfile(profile: CrsProfile): CrsForm {
  return {
    ...DEFAULT_FORM,
    maritalStatus: profile.maritalStatus,
    spouseAccompanying: profile.spouse?.accompanying ?? false,
    spouseIsCanadianCitizenOrPR: profile.spouse?.isCanadianCitizenOrPR ?? false,
    spouseEducation: profile.spouse?.education ?? 'lessThanSecondary',
    spouseCanadianWorkYears: profile.spouse?.canadianWorkYears ?? 0,
    spouseLanguage: fromLanguage(profile.spouse?.language),
    age: String(profile.age),
    education: profile.education,
    firstLanguage: fromLanguage(profile.firstLanguage),
    secondLanguage: profile.secondLanguage ? fromLanguage(profile.secondLanguage) : null,
    canadianWorkYears: profile.canadianWorkYears,
    foreignWorkYears: profile.foreignWorkYears,
    certificateOfQualification: profile.certificateOfQualification,
    canadianStudy: profile.canadianStudy,
    provincialNomination: profile.provincialNomination,
    siblingInCanada: profile.siblingInCanada,
    highWageWork: profile.highWageWork,
    highWageJobOffer: profile.highWageJobOffer,
  };
}

const languageForm = z.object({
  test: z.enum([...LANGUAGE_TESTS, 'none']),
  scores: z.object({ speaking: z.string(), listening: z.string(), reading: z.string(), writing: z.string() }),
});

/** Validates a draft read back from browser storage; anything else is discarded. */
export const crsFormSchema = z.object({
  maritalStatus: z.enum(MARITAL_STATUSES),
  spouseAccompanying: z.boolean(),
  spouseIsCanadianCitizenOrPR: z.boolean(),
  spouseEducation: z.enum(EDUCATION_LEVELS),
  spouseCanadianWorkYears: z.number().int().min(0).max(5),
  spouseLanguage: languageForm,
  age: z.string().max(5),
  education: z.enum(EDUCATION_LEVELS),
  firstLanguage: languageForm,
  secondLanguage: languageForm.nullable(),
  canadianWorkYears: z.number().int().min(0).max(5),
  foreignWorkYears: z.number().int().min(0).max(3),
  certificateOfQualification: z.boolean(),
  canadianStudy: z.enum(['none', 'oneOrTwoYears', 'threePlusYears']),
  provincialNomination: z.boolean(),
  siblingInCanada: z.boolean(),
  highWageWork: z.enum(HIGH_WAGE_LEVELS),
  highWageJobOffer: z.enum(HIGH_WAGE_LEVELS),
}) satisfies z.ZodType<CrsForm>;
