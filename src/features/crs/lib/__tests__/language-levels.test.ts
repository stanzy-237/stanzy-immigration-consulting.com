import { describe, expect, it } from 'vitest';

import { computeCrs, type CrsProfile } from '@/features/crs/lib/compute-crs';
import { ABILITIES, type Ability, type LanguageResult } from '@/features/shared/lib/language-levels';

/**
 * Seam: the CRS engine, reading raw test results. Thresholds are the lowest
 * score of each level in IRCC's charts ("Express Entry: Language test
 * results", canada.ca, page modified 2026-10-16), copied here independently
 * of the engine's data: [CLB 10, 9, 8, 7, 6, 5, 4] per ability.
 */
type Chart = Record<Ability, readonly number[]>;

const CHARTS: Record<Exclude<LanguageResult['test'], 'CLB' | 'NCLC'>, { chart: Chart; step: number }> = {
  IELTS: {
    step: 0.5,
    chart: {
      speaking: [7.5, 7, 6.5, 6, 5.5, 5, 4],
      listening: [8.5, 8, 7.5, 6, 5.5, 5, 4.5],
      reading: [8, 7, 6.5, 6, 5, 4, 3.5],
      writing: [7.5, 7, 6.5, 6, 5.5, 5, 4],
    },
  },
  CELPIP: {
    step: 1,
    chart: {
      speaking: [10, 9, 8, 7, 6, 5, 4],
      listening: [10, 9, 8, 7, 6, 5, 4],
      reading: [10, 9, 8, 7, 6, 5, 4],
      writing: [10, 9, 8, 7, 6, 5, 4],
    },
  },
  PTE_CORE: {
    step: 1,
    chart: {
      speaking: [89, 84, 76, 68, 59, 51, 42],
      listening: [89, 82, 71, 60, 50, 39, 28],
      reading: [88, 78, 69, 60, 51, 42, 33],
      writing: [90, 88, 79, 69, 60, 51, 41],
    },
  },
  TEF: {
    step: 1,
    chart: {
      speaking: [393, 371, 349, 310, 271, 226, 181],
      listening: [316, 298, 280, 249, 217, 181, 145],
      reading: [263, 248, 233, 207, 181, 151, 121],
      writing: [393, 371, 349, 310, 271, 226, 181],
    },
  },
  TCF: {
    step: 1,
    chart: {
      speaking: [16, 14, 12, 10, 7, 6, 4],
      listening: [549, 523, 503, 458, 398, 369, 331],
      reading: [549, 524, 499, 453, 406, 375, 342],
      writing: [16, 14, 12, 10, 7, 6, 4],
    },
  },
};

const LEVELS = [10, 9, 8, 7, 6, 5, 4];

function levelsFor(test: LanguageResult['test'], scores: Record<Ability, number>) {
  const profile: CrsProfile = {
    maritalStatus: 'single',
    age: 29,
    education: 'bachelors',
    firstLanguage: { test, scores },
    secondLanguage: null,
    canadianWorkYears: 0,
    foreignWorkYears: 0,
    certificateOfQualification: false,
    canadianStudy: 'none',
    provincialNomination: false,
    siblingInCanada: false,
    highWageWork: 'none',
    highWageJobOffer: 'none',
  };
  const result = computeCrs(profile, { rules: '2025-03-25' });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.breakdown.levels.first;
}

const all = (score: number): Record<Ability, number> => ({
  speaking: score,
  listening: score,
  reading: score,
  writing: score,
});

describe.each(Object.entries(CHARTS))('%s results', (test, { chart, step }) => {
  const cases = ABILITIES.flatMap((ability) =>
    chart[ability].flatMap((min, i) => [
      [ability, min, LEVELS[i]!] as const,
      // One step below a level's minimum is the level under it (below CLB 4 = 0).
      [ability, min - step, LEVELS[i + 1] ?? 0] as const,
    ]),
  );

  it.each(cases)('%s %d is CLB %i', (ability, score, level) => {
    // The other abilities sit at their CLB 10 minimum; only `ability` is under test.
    const top = Object.fromEntries(ABILITIES.map((a) => [a, chart[a][0]!])) as Record<Ability, number>;
    const scores = { ...top, [ability]: score };
    expect(levelsFor(test as LanguageResult['test'], scores)?.[ability]).toBe(level);
  });
});

describe('levels entered directly', () => {
  it('uses CLB / NCLC levels as given, CLB 10 and above counting as 10', () => {
    expect(levelsFor('CLB', { speaking: 12, listening: 9, reading: 4, writing: 3 })).toEqual({
      speaking: 10,
      listening: 9,
      reading: 4,
      writing: 0,
    });
  });
});

describe('invalid results', () => {
  it.each([
    ['IELTS', 9.5],
    ['IELTS', 6.3],
    ['CELPIP', 13],
    ['PTE_CORE', 95],
    ['TEF', 451],
    ['TCF', 21],
    ['CLB', 13],
    ['NCLC', -1],
  ] as const)('refuses %s %d instead of scoring it', (test, bad) => {
    const scores = { ...all(test === 'TCF' ? 10 : test === 'TEF' ? 300 : test === 'PTE_CORE' ? 60 : 6), speaking: bad };
    const result = computeCrs(
      {
        maritalStatus: 'single',
        age: 29,
        education: 'bachelors',
        firstLanguage: { test, scores },
        secondLanguage: null,
        canadianWorkYears: 0,
        foreignWorkYears: 0,
        certificateOfQualification: false,
        canadianStudy: 'none',
        provincialNomination: false,
        siblingInCanada: false,
        highWageWork: 'none',
        highWageJobOffer: 'none',
      },
      { rules: '2025-03-25' },
    );

    expect(result).toEqual({
      ok: false,
      issues: [{ field: 'firstLanguage.speaking', code: 'SCORE_OUT_OF_RANGE' }],
    });
  });
});
