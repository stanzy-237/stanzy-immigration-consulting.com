import { z } from 'zod';

import type { CrsForm } from '@/features/crs/lib/crs-form';
import type { FswProfile, LmiaSituation } from '@/features/fsw/lib/assess-fsw';
import { EDUCATION_LEVELS, type EducationLevel } from '@/features/shared/data/education-levels';
import { TEST_SPECS } from '@/features/shared/data/language-tests';
import { parseScore, toLanguageResult } from '@/features/shared/lib/language-form';
import { ABILITIES, clbLevelFor, type Ability } from '@/features/shared/lib/language-levels';
import { MARITAL_STATUSES, type MaritalStatus } from '@/features/shared/lib/marital-status';

/**
 * The 67-points answers as the visitor picks them. First-language levels are
 * chosen per ability (9 means 9 or more, 6 means below 7); `toProfile` turns
 * the answers into the engine's profile.
 */
export const LEVEL_CHOICES = [9, 8, 7, 6] as const;
export type LevelChoice = (typeof LEVEL_CHOICES)[number];
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
  firstLanguageOfficial: 'fr' | 'en';
  firstLevels: Record<Ability, LevelChoice>;
  /** CLB/NCLC 5+ in all four abilities of the other official language. */
  secondLanguage: boolean;
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

/** The design's starting answers: NCLC 9, bachelor's, 2–3 years, 30 — 68 points. */
export const DEFAULT_FSW_FORM: FswForm = {
  firstLanguageOfficial: 'fr',
  firstLevels: allAt(9) as Record<Ability, LevelChoice>,
  secondLanguage: false,
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
  const fr = form.firstLanguageOfficial === 'fr';
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
    firstLanguage: { test: fr ? 'NCLC' : 'CLB', scores: { ...form.firstLevels } },
    secondLanguage: form.secondLanguage ? { test: fr ? 'CLB' : 'NCLC', scores: allAt(5) } : null,
    skilledWorkYears: form.skilledWorkYears,
    jobOffer: { valid: form.jobOffer === 'valid', lmiaSituation: form.lmiaSituation },
    studiedInCanada: form.studiedInCanada,
    workedInCanada: form.workedInCanada,
    relativeInCanada: form.relativeInCanada,
  };
}

/** A CLB/NCLC level folded onto the choices: 9 or more, 8, 7, or below 7. */
export const toLevelChoice = (level: number): LevelChoice =>
  level >= 9 ? 9 : level >= 7 ? (level as 7 | 8) : 6;

const workChoice = (years: number): FswForm['skilledWorkYears'] =>
  years >= 6 ? 6 : years >= 4 ? 4 : years >= 2 ? 2 : years >= 1 ? 1 : 0;

/**
 * Maps the Calculateur CRS answers onto the 67-points form: family, age,
 * education, languages, skilled work (Canadian and foreign together),
 * Canadian work and a sibling in Canada. Answers the CRS doesn't ask keep
 * their current value in `base`.
 */
export function fromCrsAnswers(crs: CrsForm, base: FswForm): FswForm {
  const first = toLanguageResult(crs.firstLanguage);
  const levels = first
    ? (Object.fromEntries(
        ABILITIES.map((a) => [a, toLevelChoice(clbLevelFor(first.test, a, first.scores[a]) ?? 0)]),
      ) as Record<Ability, LevelChoice>)
    : base.firstLevels;
  const second = toLanguageResult(crs.secondLanguage);
  const spouseLanguage = toLanguageResult(crs.spouseLanguage);
  const allAtLeast = (result: typeof first, min: number): boolean =>
    result !== null && ABILITIES.every((a) => (clbLevelFor(result.test, a, result.scores[a]) ?? 0) >= min);

  return {
    ...base,
    firstLanguageOfficial: first ? TEST_SPECS[first.test].language : base.firstLanguageOfficial,
    firstLevels: levels,
    secondLanguage: allAtLeast(second, 5),
    education: crs.education,
    skilledWorkYears: workChoice(crs.canadianWorkYears + crs.foreignWorkYears),
    age: crs.age,
    maritalStatus: crs.maritalStatus,
    spouseAccompanying: crs.spouseAccompanying,
    spouseIsCanadianCitizenOrPR: crs.spouseIsCanadianCitizenOrPR,
    spouseLanguageClb4: allAtLeast(spouseLanguage, 4),
    spouseWorkedInCanada: crs.spouseCanadianWorkYears >= 1,
    workedInCanada: crs.canadianWorkYears >= 1,
    relativeInCanada: crs.siblingInCanada || base.relativeInCanada,
  };
}

const level = z.union([z.literal(9), z.literal(8), z.literal(7), z.literal(6)]);

/** Validates a draft read back from browser storage; anything else is discarded. */
export const fswFormSchema = z.object({
  firstLanguageOfficial: z.enum(['fr', 'en']),
  firstLevels: z.object({ speaking: level, listening: level, reading: level, writing: level }),
  secondLanguage: z.boolean(),
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
