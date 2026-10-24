/**
 * IRCC's CRS points tables, transcribed from "Comprehensive Ranking System
 * (CRS) criteria – Express Entry" (canada.ca, page modified 2026-10-16):
 * https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html
 *
 * When IRCC changes a criterion, update this file, the golden profiles in
 * the engine tests and the rules version together.
 */

import type { EducationLevel } from '@/features/shared/data/education-levels';

/** Points by column: candidate with an accompanying spouse, or without. */
export type WithSpouse<T> = { withSpouse: T; withoutSpouse: T };

/** A. Age, ages 18 to 44; 17 or younger and 45 or older score 0. */
export const AGE_POINTS: WithSpouse<Record<number, number>> = {
  withSpouse: {
    18: 90, 19: 95, 20: 100, 21: 100, 22: 100, 23: 100, 24: 100, 25: 100, 26: 100, 27: 100,
    28: 100, 29: 100, 30: 95, 31: 90, 32: 85, 33: 80, 34: 75, 35: 70, 36: 65, 37: 60, 38: 55,
    39: 50, 40: 45, 41: 35, 42: 25, 43: 15, 44: 5,
  },
  withoutSpouse: {
    18: 99, 19: 105, 20: 110, 21: 110, 22: 110, 23: 110, 24: 110, 25: 110, 26: 110, 27: 110,
    28: 110, 29: 110, 30: 105, 31: 99, 32: 94, 33: 88, 34: 83, 35: 77, 36: 72, 37: 66, 38: 61,
    39: 55, 40: 50, 41: 39, 42: 28, 43: 17, 44: 6,
  },
};

/** A. Level of education. */
export const EDUCATION_POINTS: WithSpouse<Record<EducationLevel, number>> = {
  withSpouse: {
    lessThanSecondary: 0, secondary: 28, oneYear: 84, twoYear: 91,
    bachelors: 112, twoOrMore: 119, masters: 126, doctorate: 140,
  },
  withoutSpouse: {
    lessThanSecondary: 0, secondary: 30, oneYear: 90, twoYear: 98,
    bachelors: 120, twoOrMore: 128, masters: 135, doctorate: 150,
  },
};

/**
 * A. First official language, per ability, by CLB level. Index = CLB level
 * (0–10, where 10 means CLB 10 or more); below CLB 4 scores 0.
 */
export const FIRST_LANGUAGE_POINTS: WithSpouse<readonly number[]> = {
  //               0  1  2  3  4  5  6   7   8   9   10
  withSpouse:    [0, 0, 0, 0, 6, 6, 8, 16, 22, 29, 32],
  withoutSpouse: [0, 0, 0, 0, 6, 6, 9, 17, 23, 31, 34],
};

/** A. Second official language, per ability, by CLB level (same for both columns). */
export const SECOND_LANGUAGE_POINTS: readonly number[] = [0, 0, 0, 0, 0, 1, 1, 3, 3, 6, 6];

/** A. Second official language cap, all four abilities together. */
export const SECOND_LANGUAGE_CAP: WithSpouse<number> = { withSpouse: 22, withoutSpouse: 24 };

/** A. Canadian work experience. Index = years (0–5, where 5 means 5 or more). */
export const CANADIAN_WORK_POINTS: WithSpouse<readonly number[]> = {
  withSpouse:    [0, 35, 46, 56, 63, 70],
  withoutSpouse: [0, 40, 53, 64, 72, 80],
};

/** B. Spouse or common-law partner factors. */
export const SPOUSE_EDUCATION_POINTS: Record<EducationLevel, number> = {
  lessThanSecondary: 0, secondary: 2, oneYear: 6, twoYear: 7,
  bachelors: 8, twoOrMore: 9, masters: 10, doctorate: 10,
};
/** Per ability, by CLB level; capped at 20 for all four. */
export const SPOUSE_LANGUAGE_POINTS: readonly number[] = [0, 0, 0, 0, 0, 1, 1, 3, 3, 5, 5];
export const SPOUSE_LANGUAGE_CAP = 20;
/** Index = years (0–5+). */
export const SPOUSE_CANADIAN_WORK_POINTS: readonly number[] = [0, 5, 7, 8, 9, 10];

/**
 * C. Skill transferability. Each grid gives [lower column, upper column]
 * points; a combination group is capped at 50, the whole factor at 100.
 *
 * Education rows: secondary or less = 0; a post-secondary credential of one
 * year or longer (one-year, two-year, bachelor's) = "one year"; two or more
 * credentials, a master's or a doctorate = "two or more".
 */
export const TRANSFER_EDUCATION_ROW: Record<EducationLevel, 'none' | 'postSecondary' | 'advanced'> = {
  lessThanSecondary: 'none', secondary: 'none',
  oneYear: 'postSecondary', twoYear: 'postSecondary', bachelors: 'postSecondary',
  twoOrMore: 'advanced', masters: 'advanced', doctorate: 'advanced',
};
/** Education with first-language CLB 7+ (lower) or CLB 9+ (upper), and with Canadian work 1 year (lower) or 2+ (upper). */
export const TRANSFER_EDUCATION_POINTS = {
  none: [0, 0],
  postSecondary: [13, 25],
  advanced: [25, 50],
} as const;
/** Foreign work (1–2 years, or 3+) with CLB 7+/9+, and with Canadian work 1 year / 2+. */
export const TRANSFER_FOREIGN_WORK_POINTS = {
  none: [0, 0],
  oneOrTwoYears: [13, 25],
  threePlusYears: [25, 50],
} as const;
/** Certificate of qualification with CLB 5+ (one or more under 7) or CLB 7+ on all four. */
export const TRANSFER_CERTIFICATE_POINTS = [25, 50] as const;
export const TRANSFER_GROUP_CAP = 50;
export const TRANSFER_CAP = 100;

/** D. Additional points, capped at 600 in total. */
export const ADDITIONAL_POINTS = {
  provincialNomination: 600,
  siblingInCanada: 15,
  canadianStudy: { none: 0, oneOrTwoYears: 15, threePlusYears: 30 },
  /** NCLC 7+ on all four French abilities, with English CLB 4 or lower (or no test) / CLB 5+ on all four. */
  french: { weakEnglish: 25, strongEnglish: 50 },
} as const;
export const ADDITIONAL_CAP = 600;
export const CRS_MAX = 1200;

/**
 * From 3 November 2026: the Canadian work experience line becomes the
 * "labour market integration" factor. Source: IRCC backgrounder "Changes to
 * Express Entry for high-wage occupations" (October 2026):
 * https://www.canada.ca/en/immigration-refugees-citizenship/news/2026/10/changes-to-express-entry-for-high-wage-occupations.html
 *
 * The factor is the higher of (duration points + high-wage experience bonus)
 * and the high-wage job offer points — "the points for Canadian work
 * experience and a job offer will not be combined" — capped at 150 (140 with
 * an accompanying spouse). IRCC had not yet republished the full CRS grid
 * when this was written; recheck the criteria page once it is.
 */
export const HIGH_WAGE_LEVELS = ['none', '1.3x', '1.5x', '2x'] as const;
export type HighWageLevel = (typeof HIGH_WAGE_LEVELS)[number];
/** 12+ months of Canadian work in an occupation at this multiple of the median wage. */
export const HIGH_WAGE_WORK_POINTS: Record<HighWageLevel, number> = {
  none: 0, '1.3x': 20, '1.5x': 40, '2x': 70,
};
/** A qualifying job offer in an occupation at this multiple of the median wage. */
export const HIGH_WAGE_JOB_OFFER_POINTS: Record<HighWageLevel, number> = {
  none: 0, '1.3x': 50, '1.5x': 70, '2x': 100,
};
export const LABOUR_MARKET_INTEGRATION_CAP: WithSpouse<number> = { withSpouse: 140, withoutSpouse: 150 };
