import { TEST_SPECS, type LanguageTest } from '@/features/shared/data/language-tests';

export const ABILITIES = ['speaking', 'listening', 'reading', 'writing'] as const;
export type Ability = (typeof ABILITIES)[number];
/** CLB/NCLC per ability: 10 means 10 or more, 0 means below 4. */
export type ClbLevels = Record<Ability, number>;

/**
 * Results of one official-language test, or levels entered directly (`CLB`
 * for English, `NCLC` for French).
 */
export type LanguageResult = {
  test: LanguageTest;
  scores: Record<Ability, number>;
};

const CLB_STEPS = [10, 9, 8, 7, 6, 5, 4] as const;

/** One ability's CLB/NCLC level (0 below 4), or null when `score` isn't a possible result of `test`. */
export function clbLevelFor(test: LanguageTest, ability: Ability, score: number): number | null {
  const spec = TEST_SPECS[test];
  const { min, max } = spec.range[ability];
  const steps = (score - min) / spec.step;
  if (!Number.isFinite(score) || score < min || score > max) return null;
  if (Math.abs(steps - Math.round(steps)) > 1e-9) return null;
  if (!spec.thresholds) return score >= 4 ? Math.min(score, 10) : 0;
  const index = spec.thresholds[ability].findIndex((threshold) => score >= threshold);
  return index === -1 ? 0 : CLB_STEPS[index]!;
}
