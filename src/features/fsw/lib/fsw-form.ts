import { z } from 'zod';

import type { CrsForm } from '@/features/crs/lib/crs-form';
import type { FswProfile, LmiaSituation } from '@/features/fsw/lib/assess-fsw';
import { EDUCATION_LEVELS, type EducationLevel } from '@/features/shared/data/education-levels';
import { LANGUAGE_TESTS } from '@/features/shared/data/language-tests';
import {
  emptyLanguage,
  parseScore,
  toLanguageResult,
  type LanguageForm,
} from '@/features/shared/lib/language-form';
import { ABILITIES, clbLevelFor, type Ability } from '@/features/shared/lib/language-levels';
import { MARITAL_STATUSES, type MaritalStatus } from '@/features/shared/lib/marital-status';

/**
 * The 67-points answers as the visitor gives them. Languages are entered as
 * in the Calculateur CRS (a test, then four results); `toProfile` turns the
 * answers into the engine's profile.
 */

/** Years of skilled work: 0 = under a year, 1, 2 = 2–3, 4 = 4–5, 6 = 6 or more. */
export const WORK_CHOICES = [0, 1, 2, 4, 6] as const;
export const LMIA_SITUATIONS = [
  'none',
  'lmiaWorkPermit',
  'lmiaExemptWorkPermit',
  'lmiaOffer',
  'lmiaOfferNewEmployer',
] as const satisfies readonly LmiaSituation[];

export type FswForm = {
  firstLanguage: LanguageForm;
  secondLanguage: LanguageForm | null;
  education: EducationLevel;
  skilledWorkYears: (typeof WORK_CHOICES)[number];
  age: string;
  jobOffer: 'none' | 'valid';
  lmiaSituation: LmiaSituation;
  maritalStatus: MaritalStatus;
  spouseAccompanying: boolean;
  spouseIsCanadianCitizenOrPR: boolean;
  spouseLanguageClb4: boolean;
  spouseStudiedInCanada: boolean;
  spouseWorkedInCanada: boolean;
  studiedInCanada: boolean;
  workedInCanada: boolean;
  relativeInCanada: boolean;
};

const allAt = (level: number): Record<Ability, number> =>
  Object.fromEntries(ABILITIES.map((a) => [a, level])) as Record<Ability, number>;

/** No test yet (as in the Calculateur CRS); bachelor's, 2–3 years, 30. */
export const DEFAULT_FSW_FORM: FswForm = {
  firstLanguage: emptyLanguage(),
  secondLanguage: null,
  education: 'bachelors',
  skilledWorkYears: 2,
  age: '30',
  jobOffer: 'none',
  lmiaSituation: 'none',
  maritalStatus: 'single',
  spouseAccompanying: false,
  spouseIsCanadianCitizenOrPR: false,
  spouseLanguageClb4: false,
  spouseStudiedInCanada: false,
  spouseWorkedInCanada: false,
  studiedInCanada: false,
  workedInCanada: false,
  relativeInCanada: false,
};

export function toProfile(form: FswForm): FswProfile {
  return {
    maritalStatus: form.maritalStatus,
    spouse: {
      accompanying: form.spouseAccompanying,
      isCanadianCitizenOrPR: form.spouseIsCanadianCitizenOrPR,
      language: form.spouseLanguageClb4 ? { test: 'CLB', scores: allAt(4) } : null,
      studiedInCanada: form.spouseStudiedInCanada,
      workedInCanada: form.spouseWorkedInCanada,
    },
    age: parseScore(form.age),
    education: form.education,
    firstLanguage: toLanguageResult(form.firstLanguage),
    secondLanguage: toLanguageResult(form.secondLanguage),
    skilledWorkYears: form.skilledWorkYears,
    jobOffer: { valid: form.jobOffer === 'valid', lmiaSituation: form.lmiaSituation },
    studiedInCanada: form.studiedInCanada,
    workedInCanada: form.workedInCanada,
    relativeInCanada: form.relativeInCanada,
  };
}

const workChoice = (years: number): FswForm['skilledWorkYears'] =>
  years >= 6 ? 6 : years >= 4 ? 4 : years >= 2 ? 2 : years >= 1 ? 1 : 0;

/**
 * Maps the Calculateur CRS answers onto the 67-points form: family, age,
 * education, languages, skilled work, Canadian work and studies, and a
 * sibling in Canada. Answers the CRS doesn't ask keep their value in `base`.
 *
 * The CRS asks work in ranges ("1 à 2 ans", "3 ans ou plus", "5 ans ou plus")
 * that may overlap in time, so skilled work is read as the longer of the two
 * lower bounds: never more than the candidate has, possibly less. The page
 * asks the visitor to check it.
 */
export function fromCrsAnswers(crs: CrsForm, base: FswForm): FswForm {
  const spouseLanguage = toLanguageResult(crs.spouseLanguage);
  const spouseClb4 =
    spouseLanguage !== null &&
    ABILITIES.every((a) => (clbLevelFor(spouseLanguage.test, a, spouseLanguage.scores[a]) ?? 0) >= 4);

  return {
    ...base,
    firstLanguage: crs.firstLanguage,
    secondLanguage: crs.secondLanguage,
    education: crs.education,
    skilledWorkYears: workChoice(Math.max(crs.canadianWorkYears, crs.foreignWorkYears)),
    age: crs.age,
    maritalStatus: crs.maritalStatus,
    spouseAccompanying: crs.spouseAccompanying,
    spouseIsCanadianCitizenOrPR: crs.spouseIsCanadianCitizenOrPR,
    spouseLanguageClb4: spouseClb4,
    spouseWorkedInCanada: crs.spouseCanadianWorkYears >= 1,
    workedInCanada: crs.canadianWorkYears >= 1,
    // A credential of 3+ years in Canada means at least 2 academic years of full-time study.
    studiedInCanada: crs.canadianStudy === 'threePlusYears' || base.studiedInCanada,
    relativeInCanada: crs.siblingInCanada || base.relativeInCanada,
  };
}

const languageForm = z.object({
  test: z.enum([...LANGUAGE_TESTS, 'none']),
  scores: z.object({ speaking: z.string(), listening: z.string(), reading: z.string(), writing: z.string() }),
});

/** Validates a draft read back from browser storage; anything else is discarded. */
export const fswFormSchema = z.object({
  firstLanguage: languageForm,
  secondLanguage: languageForm.nullable(),
  education: z.enum(EDUCATION_LEVELS),
  skilledWorkYears: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(4), z.literal(6)]),
  age: z.string().max(5),
  jobOffer: z.enum(['none', 'valid']),
  lmiaSituation: z.enum(LMIA_SITUATIONS),
  maritalStatus: z.enum(MARITAL_STATUSES),
  spouseAccompanying: z.boolean(),
  spouseIsCanadianCitizenOrPR: z.boolean(),
  spouseLanguageClb4: z.boolean(),
  spouseStudiedInCanada: z.boolean(),
  spouseWorkedInCanada: z.boolean(),
  studiedInCanada: z.boolean(),
  workedInCanada: z.boolean(),
  relativeInCanada: z.boolean(),
}) satisfies z.ZodType<FswForm>;
