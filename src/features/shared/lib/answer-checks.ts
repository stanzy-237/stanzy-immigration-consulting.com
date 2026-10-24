import { TEST_SPECS } from '@/features/shared/data/language-tests';
import {
  ABILITIES,
  clbLevelFor,
  type ClbLevels,
  type LanguageResult,
} from '@/features/shared/lib/language-levels';

/** An answer a calculator can't score until it is fixed. */
export type CalculatorIssue = {
  /** Dotted path to the answer to fix, e.g. `firstLanguage.speaking`. */
  field: string;
  code: 'SCORE_OUT_OF_RANGE' | 'SAME_LANGUAGE' | 'AGE_OUT_OF_RANGE';
};

/** Converts a set of results to levels, recording each impossible score as an issue. */
export function levelsWithIssues(
  result: LanguageResult | null | undefined,
  field: string,
  issues: CalculatorIssue[],
): ClbLevels | null {
  if (!result) return null;
  const levels = {} as ClbLevels;
  for (const ability of ABILITIES) {
    const level = clbLevelFor(result.test, ability, result.scores[ability]);
    if (level === null) issues.push({ field: `${field}.${ability}`, code: 'SCORE_OUT_OF_RANGE' });
    levels[ability] = level ?? 0;
  }
  return levels;
}

/**
 * The checks every calculator shares: a whole-number age, and a second
 * official language that is the other language (French or English).
 */
export function checkCandidate(
  candidate: { age: number; firstLanguage: LanguageResult | null; secondLanguage: LanguageResult | null },
  issues: CalculatorIssue[],
): void {
  if (!Number.isInteger(candidate.age) || candidate.age < 0 || candidate.age > 120) {
    issues.push({ field: 'age', code: 'AGE_OUT_OF_RANGE' });
  }
  const { firstLanguage: first, secondLanguage: second } = candidate;
  if (first && second && TEST_SPECS[first.test].language === TEST_SPECS[second.test].language) {
    issues.push({ field: 'secondLanguage', code: 'SAME_LANGUAGE' });
  }
}
