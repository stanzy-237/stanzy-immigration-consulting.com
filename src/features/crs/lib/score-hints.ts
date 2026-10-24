import { TEST_SPECS } from '@/features/crs/data/language-tests';
import {
  ABILITIES,
  computeCrs,
  type ClbLevels,
  type CrsProfile,
  type LanguageResult,
  type RulesVersion,
} from '@/features/crs/lib/compute-crs';

export type ScoreHint = {
  kind: 'firstLanguageClb9' | 'frenchNclc7' | 'canadianWorkYear';
  /** Points the change would add, under the same rules. */
  gain: number;
};

/** Levels raised to at least `floor`, entered directly as CLB (English) or NCLC (French). */
function atLeast(levels: ClbLevels | null, floor: number, language: 'en' | 'fr'): LanguageResult {
  const scores = Object.fromEntries(
    ABILITIES.map((a) => [a, Math.max(levels?.[a] ?? 0, floor)]),
  ) as LanguageResult['scores'];
  return { test: language === 'fr' ? 'NCLC' : 'CLB', scores };
}

/**
 * The changes that would raise `profile`'s score most, each priced by
 * re-scoring the changed profile: reaching CLB/NCLC 9 in the first official
 * language, NCLC 7 in French, one more year of Canadian work.
 */
export function scoreHints(profile: CrsProfile, rules: RulesVersion): ScoreHint[] {
  const current = computeCrs(profile, { rules });
  if (!current.ok) return [];
  const { levels } = current.breakdown;
  const firstIsFrench = profile.firstLanguage
    ? TEST_SPECS[profile.firstLanguage.test].language === 'fr'
    : false;

  const scenarios: [ScoreHint['kind'], CrsProfile][] = [
    [
      'firstLanguageClb9',
      { ...profile, firstLanguage: atLeast(levels.first, 9, firstIsFrench ? 'fr' : 'en') },
    ],
    [
      'frenchNclc7',
      firstIsFrench || !profile.firstLanguage
        ? { ...profile, firstLanguage: atLeast(levels.first, 7, 'fr') }
        : { ...profile, secondLanguage: atLeast(levels.second, 7, 'fr') },
    ],
    ['canadianWorkYear', { ...profile, canadianWorkYears: Math.min(profile.canadianWorkYears + 1, 5) }],
  ];

  return scenarios
    .map(([kind, changed]) => {
      const result = computeCrs(changed, { rules });
      return { kind, gain: result.ok ? result.breakdown.total - current.breakdown.total : 0 };
    })
    .filter((hint) => hint.gain > 0)
    .sort((a, b) => b.gain - a.gain);
}
