/**
 * IRCC's Federal Skilled Worker selection grid (67 points out of 100),
 * transcribed from "Six selection factors – Federal skilled workers"
 * (canada.ca, page modified 2026-10-16):
 * https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers/six-selection-factors-federal-skilled-workers.html
 * and, for education, the Educational Credential Assessment page (modified 2026-10-16):
 * https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/education-assessed.html
 *
 * When IRCC changes a criterion, update this file, the golden profiles in
 * the engine tests and the rules version together.
 */

import type { EducationLevel } from '@/features/shared/data/education-levels';

/** The day the transcribed IRCC pages were last modified; shown on the page. */
export const FSW_CRITERIA_DATE = '2026-10-16';

export const FSW_PASS_MARK = 67;
export const FSW_MAX = 100;

/** 1. Language. First official language, per ability; below CLB 7 is not eligible. */
export const FIRST_LANGUAGE_MIN_CLB = 7;
/** Points by CLB level 7, 8, 9 (or more). */
export const FIRST_LANGUAGE_POINTS: Record<7 | 8 | 9, number> = { 7: 4, 8: 5, 9: 6 };
/** Second official language: CLB 5 or more in all four abilities. */
export const SECOND_LANGUAGE_MIN_CLB = 5;
export const SECOND_LANGUAGE_POINTS = 4;
export const LANGUAGE_MAX = 28;

/** 2. Education (max 25). Less than secondary doesn't meet the education requirement. */
export const EDUCATION_POINTS: Record<EducationLevel, number> = {
  lessThanSecondary: 0,
  secondary: 5,
  oneYear: 15,
  twoYear: 19,
  bachelors: 21,
  twoOrMore: 22,
  masters: 23,
  doctorate: 25,
};
export const EDUCATION_MAX = 25;

/** 3. Skilled work experience in the last 10 years (max 15); under 1 year isn't eligible. */
export function workPoints(years: number): number {
  if (years >= 6) return 15;
  if (years >= 4) return 13;
  if (years >= 2) return 11;
  if (years >= 1) return 9;
  return 0;
}
export const WORK_MAX = 15;

/** 4. Age on the day IRCC receives the application (max 12). */
export function agePoints(age: number): number {
  if (age < 18 || age >= 47) return 0;
  if (age <= 35) return 12;
  return 12 - (age - 35); // 36 = 11 … 46 = 1
}
export const AGE_MAX = 12;

/** 5. Arranged employment (max 10). */
export const ARRANGED_EMPLOYMENT_POINTS = 10;

/** 6. Adaptability: each element, capped at 10 in total. */
export const ADAPTABILITY_POINTS = {
  spouseLanguage: 5,
  studiedInCanada: 5,
  spouseStudiedInCanada: 5,
  workedInCanada: 10,
  spouseWorkedInCanada: 5,
  arrangedEmployment: 5,
  relativeInCanada: 5,
} as const;
/** Spouse's language: CLB 4 or more in all four abilities, English or French. */
export const SPOUSE_LANGUAGE_MIN_CLB = 4;
export const ADAPTABILITY_MAX = 10;
