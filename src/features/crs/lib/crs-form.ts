import { z } from 'zod';

import { HIGH_WAGE_LEVELS, type HighWageLevel } from '@/features/crs/data/crs-criteria';
import { EDUCATION_LEVELS, type EducationLevel } from '@/features/shared/data/education-levels';
import type { CrsProfile } from '@/features/crs/lib/compute-crs';
import { LANGUAGE_TESTS } from '@/features/shared/data/language-tests';
import {
  emptyLanguage,
  fromLanguageResult,
  parseScore,
  toLanguageResult,
  type LanguageForm,
} from '@/features/shared/lib/language-form';
import { isPartnered, MARITAL_STATUSES } from '@/features/shared/lib/marital-status';

/**
 * The calculator's answers as the visitor types them (strings for typed
 * numbers, so a half-typed "6," survives). `toProfile` turns them into the
 * engine's profile; `fromProfile` reopens a saved one.
 */
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

export function toProfile(form: CrsForm): CrsProfile {
  return {
    maritalStatus: form.maritalStatus,
    spouse: isPartnered(form.maritalStatus)
      ? {
          accompanying: form.spouseAccompanying,
          isCanadianCitizenOrPR: form.spouseIsCanadianCitizenOrPR,
          education: form.spouseEducation,
          canadianWorkYears: form.spouseCanadianWorkYears,
          language: toLanguageResult(form.spouseLanguage),
        }
      : undefined,
    age: parseScore(form.age),
    education: form.education,
    firstLanguage: toLanguageResult(form.firstLanguage),
    secondLanguage: toLanguageResult(form.secondLanguage),
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

export function fromProfile(profile: CrsProfile): CrsForm {
  return {
    ...DEFAULT_FORM,
    maritalStatus: profile.maritalStatus,
    spouseAccompanying: profile.spouse?.accompanying ?? false,
    spouseIsCanadianCitizenOrPR: profile.spouse?.isCanadianCitizenOrPR ?? false,
    spouseEducation: profile.spouse?.education ?? 'lessThanSecondary',
    spouseCanadianWorkYears: profile.spouse?.canadianWorkYears ?? 0,
    spouseLanguage: fromLanguageResult(profile.spouse?.language),
    age: String(profile.age),
    education: profile.education,
    firstLanguage: fromLanguageResult(profile.firstLanguage),
    secondLanguage: profile.secondLanguage ? fromLanguageResult(profile.secondLanguage) : null,
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
