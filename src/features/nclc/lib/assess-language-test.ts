// The CRS points tables are the CRS calculator's own data, read here rather
// than copied so both tools always agree.
import { ADDITIONAL_POINTS, FIRST_LANGUAGE_POINTS } from '@/features/crs/data/crs-criteria';
import { TEST_SPECS } from '@/features/shared/data/language-tests';
import { ABILITIES, clbLevelFor, type Ability, type ClbLevels, type LanguageResult } from '@/features/shared/lib/language-levels';

/**
 * Minimum CLB/NCLC per ability for each Entrée Express program, for the first
 * official language (IRCC, "Express Entry: Language test results"):
 * - FSW: 7 on all four;
 * - CEC: 7 on all four for a TEER 0 or 1 job, 5 for TEER 2 or 3;
 * - FST: 5 in speaking and listening, 4 in reading and writing.
 */
const PROGRAM_MINIMUMS = {
  fsw: { speaking: 7, listening: 7, reading: 7, writing: 7 },
  cecTeer01: { speaking: 7, listening: 7, reading: 7, writing: 7 },
  cecTeer23: { speaking: 5, listening: 5, reading: 5, writing: 5 },
  fst: { speaking: 5, listening: 5, reading: 4, writing: 4 },
} as const satisfies Record<string, Record<Ability, number>>;

export type Program = keyof typeof PROGRAM_MINIMUMS;

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
  programs: Record<Program, boolean>;
};

export type LanguageAssessmentResult =
  | { ok: true; assessment: LanguageAssessment }
  | { ok: false; invalid: Ability[] };

/**
 * What one official-language test is worth for Entrée Express: the level of
 * each ability, the weakest one, indicative CRS points and which programs'
 * language minimums it meets. Results that aren't possible for the test are
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
      programs: Object.fromEntries(
        Object.entries(PROGRAM_MINIMUMS).map(([program, minimum]) => [program, ABILITIES.every((a) => clb[a] >= minimum[a])]),
      ) as Record<Program, boolean>,
    },
  };
}
