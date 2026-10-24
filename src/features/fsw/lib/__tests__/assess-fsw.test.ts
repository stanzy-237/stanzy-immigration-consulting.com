import { describe, expect, it } from 'vitest';

import { assessFsw, type FswProfile } from '@/features/fsw/lib/assess-fsw';
import type { LanguageResult } from '@/features/shared/lib/language-levels';
import type { RulesVersion } from '@/features/shared/lib/rules-version';

/**
 * Seam: the 67-points engine, one pure function from a profile to the
 * assessment. Every expected value is worked by hand from IRCC's "Six
 * selection factors – Federal skilled workers" and the ECA education table
 * (canada.ca, pages modified 2026-10-16), never from the engine's tables.
 */

const levels = (test: 'CLB' | 'NCLC', level: number): LanguageResult => ({
  test,
  scores: { speaking: level, listening: level, reading: level, writing: level },
});

/** Single, 30, bachelor's, NCLC 9 French, 3 years of skilled work. */
function profile(overrides: Partial<FswProfile> = {}): FswProfile {
  return {
    maritalStatus: 'single',
    age: 30,
    education: 'bachelors',
    firstLanguage: levels('NCLC', 9),
    secondLanguage: null,
    skilledWorkYears: 3,
    jobOffer: { valid: false, lmiaSituation: 'none' },
    studiedInCanada: false,
    workedInCanada: false,
    relativeInCanada: false,
    ...overrides,
  };
}

function assessed(p: FswProfile, rules: RulesVersion = '2025-03-25') {
  const result = assessFsw(p, { rules });
  if (!result.ok) throw new Error(`unexpected issues: ${JSON.stringify(result.issues)}`);
  return result.assessment;
}

describe('assessFsw — eligibility', () => {
  it('passes a candidate at 68 who meets every requirement', () => {
    // Language NCLC 9 ×4 = 6×4 = 24. Bachelor's = 21. 3 yrs = 11. Age 30 = 12. Total 68.
    const a = assessed(profile());

    expect(a.factors).toEqual({
      language: 24,
      education: 21,
      work: 11,
      age: 12,
      arrangedEmployment: 0,
      adaptability: 0,
    });
    expect(a.total).toBe(68);
    expect(a.requirements).toEqual({ firstLanguageClb7: true, oneYearOfWork: true, credential: true });
    expect(a.eligible).toBe(true);
  });
});

describe('assessFsw — the 67-point pass mark', () => {
  /** 36, two-year diploma, CLB 8 English, 4 yrs, NCLC 5 French as second language. */
  const at67 = profile({
    age: 36,
    education: 'twoYear',
    firstLanguage: levels('CLB', 8),
    secondLanguage: levels('NCLC', 5),
    skilledWorkYears: 4,
  });

  it('passes at exactly 67', () => {
    // Language CLB 8 ×4 = 5×4 = 20, + second language NCLC 5 ×4 = 4 → 24.
    // Two-year = 19. 4 yrs = 13. Age 36 = 11. Total 67.
    const a = assessed(at67);

    expect(a.factors).toMatchObject({ language: 24, education: 19, work: 13, age: 11 });
    expect(a.total).toBe(67);
    expect(a.eligible).toBe(true);
    expect(a.pointsShort).toBe(0);
  });

  it('fails at 66, one point short', () => {
    // Same at 37: age = 10. Total 66.
    const a = assessed({ ...at67, age: 37 });

    expect(a.total).toBe(66);
    expect(a.eligible).toBe(false);
    expect(a.pointsShort).toBe(1);
  });

  it('gives no second-language points below CLB 5 in any ability', () => {
    const weak = levels('NCLC', 5);
    weak.scores.reading = 4;
    expect(assessed({ ...at67, secondLanguage: weak }).factors.language).toBe(20);
  });
});

describe('assessFsw — minimum requirements', () => {
  it('is not eligible below CLB 7 in any first-language ability, whatever the points', () => {
    // NCLC 9 ×3 = 18, writing NCLC 6 = not eligible (0). Master's 23. 6+ yrs 15. Age 30 12. Total 68.
    const first = levels('NCLC', 9);
    first.scores.writing = 6;
    const a = assessed(profile({ firstLanguage: first, education: 'masters', skilledWorkYears: 6 }));

    expect(a.total).toBe(68);
    expect(a.requirements.firstLanguageClb7).toBe(false);
    expect(a.eligible).toBe(false);
  });

  it('is not eligible without a year of skilled work', () => {
    // 24 + 21 + 0 + 12 = 57.
    const a = assessed(profile({ skilledWorkYears: 0 }));

    expect(a.total).toBe(57);
    expect(a.requirements.oneYearOfWork).toBe(false);
  });

  it('is not eligible without at least a secondary diploma', () => {
    expect(assessed(profile({ education: 'lessThanSecondary' })).requirements.credential).toBe(false);
  });

  it('is not eligible without a first-language test', () => {
    expect(assessed(profile({ firstLanguage: null })).requirements.firstLanguageClb7).toBe(false);
  });
});

describe('assessFsw — age and work bands', () => {
  it.each([
    [17, 0],
    [18, 12],
    [35, 12],
    [36, 11],
    [40, 7],
    [46, 1],
    [47, 0],
  ])('gives age %i %i points', (age, points) => {
    expect(assessed(profile({ age })).factors.age).toBe(points);
  });

  it.each([
    [1, 9],
    [2, 11],
    [3, 11],
    [4, 13],
    [5, 13],
    [6, 15],
  ])('gives %i year(s) of skilled work %i points', (years, points) => {
    expect(assessed(profile({ skilledWorkYears: years })).factors.work).toBe(points);
  });
});

describe('assessFsw — arranged employment', () => {
  it('gives 10 points, and 5 for adaptability, for a valid offer under an LMIA situation', () => {
    // 68 (see above) + arranged employment 10 + adaptability (arranged employment) 5 = 83.
    const a = assessed(profile({ jobOffer: { valid: true, lmiaSituation: 'lmiaOffer' } }));

    expect(a.factors).toMatchObject({ arrangedEmployment: 10, adaptability: 5 });
    expect(a.total).toBe(83);
  });

  it('gives nothing before 2026-11-03 for a valid offer outside the four LMIA situations', () => {
    const a = assessed(profile({ jobOffer: { valid: true, lmiaSituation: 'none' } }), '2025-03-25');
    expect(a.factors).toMatchObject({ arrangedEmployment: 0, adaptability: 0 });
  });

  it('needs no LMIA from 2026-11-03: a valid TEER 0–3 offer is enough', () => {
    const a = assessed(profile({ jobOffer: { valid: true, lmiaSituation: 'none' } }), '2026-11-03');
    expect(a.factors).toMatchObject({ arrangedEmployment: 10, adaptability: 5 });
  });

  it('gives nothing for an offer that is not valid', () => {
    const a = assessed(profile({ jobOffer: { valid: false, lmiaSituation: 'lmiaOffer' } }), '2026-11-03');
    expect(a.factors.arrangedEmployment).toBe(0);
  });
});

describe('assessFsw — adaptability', () => {
  const spouse = {
    accompanying: true,
    isCanadianCitizenOrPR: false,
    language: levels('CLB', 4),
    studiedInCanada: true,
    workedInCanada: false,
  };

  it('caps adaptability at 10', () => {
    // Spouse CLB 4+ ×4 = 5, spouse studied = 5, my Canadian work = 10, relative = 5 → 25 → 10.
    const a = assessed(
      profile({ maritalStatus: 'married', spouse, workedInCanada: true, relativeInCanada: true }),
    );
    expect(a.factors.adaptability).toBe(10);
  });

  it('counts the spouse items only for an accompanying spouse', () => {
    // Spouse language 5 + spouse studies 5 = 10 when married and accompanying.
    expect(assessed(profile({ maritalStatus: 'commonLaw', spouse })).factors.adaptability).toBe(10);
    expect(assessed(profile({ maritalStatus: 'single', spouse })).factors.adaptability).toBe(0);
    expect(
      assessed(profile({ maritalStatus: 'married', spouse: { ...spouse, accompanying: false } })).factors
        .adaptability,
    ).toBe(0);
    expect(
      assessed(profile({ maritalStatus: 'married', spouse: { ...spouse, isCanadianCitizenOrPR: true } }))
        .factors.adaptability,
    ).toBe(0);
  });

  it('gives my own items: 5 for Canadian studies, 10 for Canadian work, 5 for a relative', () => {
    expect(assessed(profile({ studiedInCanada: true })).factors.adaptability).toBe(5);
    expect(assessed(profile({ workedInCanada: true })).factors.adaptability).toBe(10);
    expect(assessed(profile({ relativeInCanada: true })).factors.adaptability).toBe(5);
  });

  it("needs CLB 4 in all four of the spouse's abilities for the spouse language points", () => {
    const weak = levels('CLB', 4);
    weak.scores.speaking = 3;
    const a = assessed(
      profile({ maritalStatus: 'married', spouse: { ...spouse, studiedInCanada: false, language: weak } }),
    );
    expect(a.factors.adaptability).toBe(0);
  });
});

describe('assessFsw — raw test results', () => {
  // Lowest score for CLB/NCLC 7 per ability in IRCC's charts, and one listening
  // score just below it (CLB 6): speaking, listening, reading, writing.
  it.each([
    ['TEF', [310, 249, 207, 310], 248],
    ['TCF', [10, 458, 453, 10], 457],
    ['IELTS', [6, 6, 6, 6], 5.5],
    ['CELPIP', [7, 7, 7, 7], 6],
    ['PTE_CORE', [68, 60, 60, 69], 59],
  ] as const)('reads %s results: CLB 7 minimums pass, one below in listening fails', (test, [s, l, r, w], below) => {
    const at7 = assessed(profile({ firstLanguage: { test, scores: { speaking: s, listening: l, reading: r, writing: w } } }));
    // CLB 7 ×4 = 4×4 = 16.
    expect(at7.factors.language).toBe(16);
    expect(at7.requirements.firstLanguageClb7).toBe(true);

    const under = assessed(
      profile({ firstLanguage: { test, scores: { speaking: s, listening: below, reading: r, writing: w } } }),
    );
    expect(under.requirements.firstLanguageClb7).toBe(false);
  });
});

describe('assessFsw — answers to fix', () => {
  it('refuses a result that the test cannot give', () => {
    const result = assessFsw(
      profile({ firstLanguage: { test: 'IELTS', scores: { speaking: 9.5, listening: 7, reading: 7, writing: 7 } } }),
      { rules: '2025-03-25' },
    );
    expect(result).toEqual({
      ok: false,
      issues: [{ field: 'firstLanguage.speaking', code: 'SCORE_OUT_OF_RANGE' }],
    });
  });

  it('refuses a second language in the same language as the first', () => {
    expect(assessFsw(profile({ secondLanguage: levels('NCLC', 5) }), { rules: '2025-03-25' })).toEqual({
      ok: false,
      issues: [{ field: 'secondLanguage', code: 'SAME_LANGUAGE' }],
    });
  });

  it.each([-1, 30.5, 121])('refuses age %d', (age) => {
    expect(assessFsw(profile({ age }), { rules: '2025-03-25' })).toEqual({
      ok: false,
      issues: [{ field: 'age', code: 'AGE_OUT_OF_RANGE' }],
    });
  });
});
