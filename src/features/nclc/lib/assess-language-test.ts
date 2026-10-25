// The CRS points tables are the CRS calculator's own data, read here rather
// than copied so both tools always agree.
import { ADDITIONAL_POINTS, FIRST_LANGUAGE_POINTS } from '@/features/crs/data/crs-criteria';
import { TEST_SPECS } from '@/features/shared/data/language-tests';
import { ABILITIES, clbLevelFor, type Ability, type ClbLevels, type LanguageResult } from '@/features/shared/lib/language-levels';

/**
 * Travailleurs qualifiés (FSW), the program Stanzy focuses on, needs CLB/NCLC 7
 * in every ability of the first official language (IRCC, "Express Entry:
 * Language test results").
 */
const FSW_MINIMUM = 7;

/**
 * Where the visitor stands for Travailleurs qualifiés (FSW), the program
 * Stanzy focuses on: `close` is one level short (weakest skill at 6),
 * `notEligible` further away. `shortSkills` are the skills under 7.
 */
export type FswVerdict = { status: 'eligible' | 'close' | 'notEligible'; shortSkills: Ability[] };

/** One level short of FSW's 7: the verdict says « presque » rather than « pas admissible ». */
const FSW_CLOSE_LEVEL = 6;

/** The CRS French-language bonus needs NCLC 7 or more on all four abilities. */
const FRENCH_BONUS_LEVEL = 7;

export type LanguageAssessment = {
  language: 'en' | 'fr';
  /** CLB (English) or NCLC (French) per ability; 0 means below 4. */
  levels: ClbLevels;
  /** The weakest ability: what program minimums are measured against. */
  retained: number;
  /** CRS points for these levels as a single candidate's first official language. */
  crsFirstLanguage: number;
  /** CRS French bonus: alone, and with English CLB 5+ on all four; null below NCLC 7. */
  frenchBonus: { alone: number; withEnglish: number } | null;
  fswVerdict: FswVerdict;
};

export type LanguageAssessmentResult =
  | { ok: true; assessment: LanguageAssessment }
  | { ok: false; invalid: Ability[] };

/**
 * What one official-language test is worth for Entrée Express: the level of
 * each ability, the weakest one, indicative CRS points and where it stands for
 * Travailleurs qualifiés. Results that aren't possible for the test are
 * named in `invalid`.
 */
export function assessLanguageTest(result: LanguageResult): LanguageAssessmentResult {
  const levels = Object.fromEntries(ABILITIES.map((a) => [a, clbLevelFor(result.test, a, result.scores[a])])) as Record<
    Ability,
    number | null
  >;
  const invalid = ABILITIES.filter((a) => levels[a] === null);
  if (invalid.length > 0) return { ok: false, invalid };

  const clb = levels as ClbLevels;
  const retained = Math.min(...ABILITIES.map((a) => clb[a]));
  const language = TEST_SPECS[result.test].language;
  const points = FIRST_LANGUAGE_POINTS.withoutSpouse;
  const shortSkills = ABILITIES.filter((a) => clb[a] < FSW_MINIMUM);

  return {
    ok: true,
    assessment: {
      language,
      levels: clb,
      retained,
      crsFirstLanguage: ABILITIES.reduce((sum, a) => sum + (points[clb[a]] ?? 0), 0),
      frenchBonus:
        language === 'fr' && retained >= FRENCH_BONUS_LEVEL
          ? { alone: ADDITIONAL_POINTS.french.weakEnglish, withEnglish: ADDITIONAL_POINTS.french.strongEnglish }
          : null,
      fswVerdict: {
        status: shortSkills.length === 0 ? 'eligible' : retained >= FSW_CLOSE_LEVEL ? 'close' : 'notEligible',
        shortSkills,
      },
    },
  };
}
