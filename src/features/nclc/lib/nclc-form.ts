import { z } from 'zod';

import type { LanguageTest } from '@/features/shared/data/language-tests';
import type { Ability } from '@/features/shared/lib/language-levels';

/** The tests this tool converts: the ones IRCC accepts, French first. */
export const NCLC_TESTS = ['TCF', 'TEF', 'IELTS', 'CELPIP', 'PTE_CORE'] as const satisfies readonly LanguageTest[];
export type NclcTest = (typeof NCLC_TESTS)[number];

/** Scores in the order a test report prints them: the receptive skills first. */
export const SCORE_ORDER = ['listening', 'reading', 'speaking', 'writing'] as const satisfies readonly Ability[];

/** The visitor's test and four results, typed as strings so a half-typed "6," survives. */
export type NclcForm = { test: NclcTest; scores: Record<Ability, string> };

export const DEFAULT_NCLC_FORM: NclcForm = {
  test: 'TCF',
  scores: { listening: '', reading: '', speaking: '', writing: '' },
};

const score = z.string().max(8);

export const nclcFormSchema: z.ZodType<NclcForm> = z.object({
  test: z.enum(NCLC_TESTS),
  scores: z.object({ listening: score, reading: score, speaking: score, writing: score }),
});
