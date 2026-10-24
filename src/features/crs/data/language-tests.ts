/**
 * IRCC's test-score → CLB/NCLC equivalence charts for Express Entry,
 * transcribed from "Express Entry: Language test results" (canada.ca, page
 * modified 2026-10-16):
 * https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html
 *
 * TEF Canada uses the "Équivalence ancien score" column, the only one
 * Express Entry accepts.
 */

export const LANGUAGE_TESTS = ['TEF', 'TCF', 'IELTS', 'CELPIP', 'PTE_CORE', 'CLB', 'NCLC'] as const;
export type LanguageTest = (typeof LANGUAGE_TESTS)[number];

type Ability = 'speaking' | 'listening' | 'reading' | 'writing';

export type TestSpec = {
  language: 'en' | 'fr';
  /** Valid scores: from `min` to `max`, in steps of `step`. */
  range: Record<Ability, { min: number; max: number }>;
  step: number;
  /** Lowest score for CLB/NCLC 10, 9, 8, 7, 6, 5, 4 (in that order), per ability. */
  thresholds: Record<Ability, readonly number[]> | null;
};

const same = <T>(value: T): Record<Ability, T> => ({
  speaking: value,
  listening: value,
  reading: value,
  writing: value,
});

export const TEST_SPECS: Record<LanguageTest, TestSpec> = {
  TEF: {
    language: 'fr',
    step: 1,
    range: {
      speaking: { min: 0, max: 450 },
      listening: { min: 0, max: 360 },
      reading: { min: 0, max: 300 },
      writing: { min: 0, max: 450 },
    },
    thresholds: {
      speaking: [393, 371, 349, 310, 271, 226, 181],
      listening: [316, 298, 280, 249, 217, 181, 145],
      reading: [263, 248, 233, 207, 181, 151, 121],
      writing: [393, 371, 349, 310, 271, 226, 181],
    },
  },
  TCF: {
    language: 'fr',
    step: 1,
    range: {
      speaking: { min: 0, max: 20 },
      listening: { min: 0, max: 699 },
      reading: { min: 0, max: 699 },
      writing: { min: 0, max: 20 },
    },
    thresholds: {
      speaking: [16, 14, 12, 10, 7, 6, 4],
      listening: [549, 523, 503, 458, 398, 369, 331],
      reading: [549, 524, 499, 453, 406, 375, 342],
      writing: [16, 14, 12, 10, 7, 6, 4],
    },
  },
  IELTS: {
    language: 'en',
    step: 0.5,
    range: same({ min: 0, max: 9 }),
    thresholds: {
      speaking: [7.5, 7, 6.5, 6, 5.5, 5, 4],
      listening: [8.5, 8, 7.5, 6, 5.5, 5, 4.5],
      reading: [8, 7, 6.5, 6, 5, 4, 3.5],
      writing: [7.5, 7, 6.5, 6, 5.5, 5, 4],
    },
  },
  CELPIP: {
    language: 'en',
    step: 1,
    range: same({ min: 0, max: 12 }),
    thresholds: same([10, 9, 8, 7, 6, 5, 4]),
  },
  PTE_CORE: {
    language: 'en',
    step: 1,
    range: same({ min: 10, max: 90 }),
    thresholds: {
      speaking: [89, 84, 76, 68, 59, 51, 42],
      listening: [89, 82, 71, 60, 50, 39, 28],
      reading: [88, 78, 69, 60, 51, 42, 33],
      writing: [90, 88, 79, 69, 60, 51, 41],
    },
  },
  // Levels entered directly; CLB/NCLC run to 12.
  CLB: { language: 'en', step: 1, range: same({ min: 0, max: 12 }), thresholds: null },
  NCLC: { language: 'fr', step: 1, range: same({ min: 0, max: 12 }), thresholds: null },
};
