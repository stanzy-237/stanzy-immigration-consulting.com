import { describe, expect, it } from 'vitest';

import {
  computeCrs,
  rulesInForceOn,
  type CrsProfile,
  type LanguageResult,
} from '@/features/crs/lib/compute-crs';

/**
 * Seam: the CRS engine, one pure function from a profile to the breakdown.
 *
 * Every expected value below is worked out by hand from IRCC's published CRS
 * criteria (canada.ca, "Comprehensive Ranking System (CRS) criteria", page
 * modified 2026-10-16) and language-test charts — never from the engine's
 * own tables. The working is in each test's comment.
 */

const clb = (level: number): LanguageResult => ({
  test: 'CLB',
  scores: { speaking: level, listening: level, reading: level, writing: level },
});

/** A single 29-year-old with a bachelor's degree and nothing else. */
function profile(overrides: Partial<CrsProfile> = {}): CrsProfile {
  return {
    maritalStatus: 'single',
    age: 29,
    education: 'bachelors',
    firstLanguage: null,
    secondLanguage: null,
    canadianWorkYears: 0,
    foreignWorkYears: 0,
    certificateOfQualification: false,
    canadianStudy: 'none',
    provincialNomination: false,
    siblingInCanada: false,
    highWageWork: 'none',
    highWageJobOffer: 'none',
    ...overrides,
  };
}

function scored(p: CrsProfile) {
  const result = computeCrs(p, { rules: '2025-03-25' });
  if (!result.ok) throw new Error(`unexpected issues: ${JSON.stringify(result.issues)}`);
  return result.breakdown;
}

describe('computeCrs — single candidate', () => {
  it('scores core factors and skill transferability', () => {
    // Age 29: 110. Bachelor's: 120. CLB 9 ×4: 31×4 = 124. A = 354.
    // C: bachelor's + CLB 9 all = 25; 3+ yrs foreign + CLB 9 all = 50. C = 75.
    const b = scored(profile({ firstLanguage: clb(9), foreignWorkYears: 3 }));

    expect(b.core).toMatchObject({ age: 110, education: 120, firstLanguage: 124, total: 354 });
    expect(b.transferability).toMatchObject({ education: 25, foreignWork: 50, total: 75 });
    expect(b.spouse.total).toBe(0);
    expect(b.additional.total).toBe(0);
    expect(b.total).toBe(429);
  });
});

const nclc = (level: number): LanguageResult => ({
  test: 'NCLC',
  scores: { speaking: level, listening: level, reading: level, writing: level },
});

describe('computeCrs — married or common-law candidate', () => {
  /** 33, master's, CLB 10 English, NCLC 7 French, 2 yrs Canada, 2 yrs abroad. */
  const candidate = profile({
    maritalStatus: 'married',
    age: 33,
    education: 'masters',
    firstLanguage: clb(10),
    secondLanguage: nclc(7),
    canadianWorkYears: 2,
    foreignWorkYears: 2,
  });
  const spouse = {
    isCanadianCitizenOrPR: false,
    accompanying: true,
    education: 'bachelors' as const,
    canadianWorkYears: 1,
    language: clb(7),
  };

  it('uses the with-spouse tables and adds the spouse factors when the spouse comes along', () => {
    // A (with spouse): age 33 = 80, master's = 126, CLB 10 ×4 = 32×4 = 128,
    //   NCLC 7 second language = 3×4 = 12, 2 yrs Canada = 46. A = 392.
    // B: bachelor's = 8, CLB 7 ×4 = 3×4 = 12, 1 yr Canada = 5. B = 25.
    // C: master's + CLB 9+ = 50, master's + 2 yrs Canada = 50 → group capped 50;
    //   1–2 yrs abroad + CLB 9+ = 25, + 2 yrs Canada = 25 → 50. C = 100.
    // D: NCLC 7+ French with CLB 5+ English = 50.
    const b = scored({ ...candidate, spouse });

    expect(b.core).toMatchObject({
      age: 80,
      education: 126,
      firstLanguage: 128,
      secondLanguage: 12,
      canadianWork: 46,
      total: 392,
    });
    expect(b.spouse).toEqual({ education: 8, language: 12, canadianWork: 5, total: 25 });
    expect(b.transferability).toMatchObject({ education: 50, foreignWork: 50, total: 100 });
    expect(b.additional).toMatchObject({ french: 50, total: 50 });
    expect(b.total).toBe(567);
  });

  it.each([
    ['is a Canadian citizen or permanent resident', { isCanadianCitizenOrPR: true }],
    ['does not come to Canada', { accompanying: false }],
  ])('scores the candidate as single when the spouse %s', (_case, change) => {
    // A (single): 88 + 135 + 34×4 = 136 + 12 + 53 = 424. B = 0. C = 100. D = 50.
    const b = scored({ ...candidate, spouse: { ...spouse, ...change } });

    expect(b.core.total).toBe(424);
    expect(b.spouse.total).toBe(0);
    expect(b.total).toBe(574);
  });
});

describe('computeCrs — additional points and caps', () => {
  it('caps the additional points at 600', () => {
    // A: age 45 = 0, secondary = 30, CLB 6 ×4 = 9×4 = 36, 1 yr Canada = 40. A = 106.
    // C: secondary + anything = 0; 3+ yrs abroad + CLB 6 = 0, + 1 yr Canada = 25 → 25;
    //   certificate + CLB 5+ (some under 7) = 25. C = 50.
    // D: nomination 600 + sibling 15 + 3-yr Canadian study 30 = 645 → capped 600.
    const b = scored(
      profile({
        age: 45,
        education: 'secondary',
        firstLanguage: clb(6),
        canadianWorkYears: 1,
        foreignWorkYears: 3,
        certificateOfQualification: true,
        provincialNomination: true,
        siblingInCanada: true,
        canadianStudy: 'threePlusYears',
      }),
    );

    expect(b.core.total).toBe(106);
    expect(b.transferability).toMatchObject({ education: 0, foreignWork: 25, certificate: 25, total: 50 });
    expect(b.additional).toMatchObject({
      provincialNomination: 600,
      sibling: 15,
      canadianStudy: 30,
      french: 0,
      total: 600,
    });
    expect(b.total).toBe(756);
  });

  it('gives the +25 French bonus when there is no English test', () => {
    // A: 25 = 110, doctorate = 150, NCLC 8 ×4 = 23×4 = 92. A = 352.
    // C: doctorate + NCLC 7+ (some under 9) = 25. D: French, no English = 25.
    const b = scored(profile({ age: 25, education: 'doctorate', firstLanguage: nclc(8) }));

    expect(b.core.total).toBe(352);
    expect(b.transferability.total).toBe(25);
    expect(b.additional.french).toBe(25);
    expect(b.total).toBe(402);
  });

  it('gives no French bonus below NCLC 7 on any ability', () => {
    const french = nclc(9);
    french.scores.writing = 6;
    const b = scored(profile({ firstLanguage: french, secondLanguage: clb(9) }));

    expect(b.additional.french).toBe(0);
  });

  it('caps skill transferability at 100 even when three groups reach 50', () => {
    // A: 110 + master's 135 + 124 + 2 yrs Canada 53 = 422.
    // C: education 50 (capped), foreign work 50 (capped), certificate + CLB 7+ = 50 → 100.
    const b = scored(
      profile({
        education: 'masters',
        firstLanguage: clb(9),
        canadianWorkYears: 2,
        foreignWorkYears: 3,
        certificateOfQualification: true,
      }),
    );

    expect(b.transferability).toMatchObject({ education: 50, foreignWork: 50, certificate: 50, total: 100 });
    expect(b.total).toBe(522);
  });

  it.each([
    [17, 0],
    [18, 99],
    [30, 105],
    [44, 6],
    [45, 0],
  ])('gives a single candidate aged %i %i age points', (age, points) => {
    expect(scored(profile({ age })).core.age).toBe(points);
  });
});

describe('computeCrs — labour market integration (rules from 2026-11-03)', () => {
  /**
   * Source: IRCC backgrounder "Changes to Express Entry for high-wage
   * occupations" (October 2026): duration points for Canadian work stay, plus
   * +20/+40/+70 for 12 months in a 1.3×/1.5×/2× high-wage occupation, OR a
   * high-wage job offer worth 50/70/100 — whichever is higher, never both;
   * the factor is capped at 150 (140 with a spouse). Skill transferability
   * keeps using years of Canadian work.
   */
  const newRules = (p: CrsProfile) => {
    const result = computeCrs(p, { rules: '2026-11-03' });
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    return result.breakdown;
  };

  it('adds the high-wage bonus to the duration points', () => {
    // A: 110 + 120 + 124 = 354, plus labour market integration 64 + 70 = 134.
    // C: bachelor's + CLB 9 = 25, bachelor's + 3 yrs Canada = 25 → 50. Total 538.
    const p = profile({ firstLanguage: clb(9), canadianWorkYears: 3, highWageWork: '2x' });

    const b = newRules(p);
    expect(b.core.labourMarketIntegration).toEqual({
      canadianWork: 64,
      highWageWork: 70,
      jobOffer: 0,
      total: 134,
    });
    expect(b.core.total).toBe(488);
    expect(b.transferability.total).toBe(50);
    expect(b.total).toBe(538);
  });

  it('ignores high-wage answers under the current rules', () => {
    // Same profile: A = 354 + 64 = 418, C = 50. Total 468.
    const p = profile({ firstLanguage: clb(9), canadianWorkYears: 3, highWageWork: '2x' });
    const result = computeCrs(p, { rules: '2025-03-25' });

    expect(result.ok && result.breakdown.total).toBe(468);
    expect(result.ok && result.breakdown.core.labourMarketIntegration).toBeNull();
  });

  it('takes a high-wage job offer instead when it is worth more', () => {
    // Experience route: 53 + 40 = 93. Job offer at 2×: 100. → 100.
    const b = newRules(
      profile({ canadianWorkYears: 2, highWageWork: '1.5x', highWageJobOffer: '2x' }),
    );

    expect(b.core.labourMarketIntegration).toMatchObject({ jobOffer: 100, total: 100 });
  });

  it('reaches the 140 cap with a spouse at 5+ years and a 2× occupation', () => {
    // With spouse: 70 + 70 = 140 = cap.
    const b = newRules(
      profile({
        maritalStatus: 'married',
        spouse: {
          isCanadianCitizenOrPR: false,
          accompanying: true,
          education: 'secondary',
          canadianWorkYears: 0,
          language: null,
        },
        canadianWorkYears: 5,
        highWageWork: '2x',
      }),
    );

    expect(b.core.labourMarketIntegration?.total).toBe(140);
  });

  it.each([
    ['2026-10-24', '2025-03-25'],
    ['2026-11-02', '2025-03-25'],
    ['2026-11-03', '2026-11-03'],
    ['2027-01-15', '2026-11-03'],
  ] as const)('applies the rules in force on %s (%s)', (day, rules) => {
    expect(rulesInForceOn(new Date(`${day}T12:00:00-05:00`))).toBe(rules);
  });
});

describe('computeCrs — answers to fix', () => {
  it('refuses a second language in the same language as the first', () => {
    const result = computeCrs(profile({ firstLanguage: clb(9), secondLanguage: clb(7) }), {
      rules: '2025-03-25',
    });

    expect(result).toEqual({
      ok: false,
      issues: [{ field: 'secondLanguage', code: 'SAME_LANGUAGE' }],
    });
  });

  it.each([-1, 12.5, 121])('refuses age %d', (age) => {
    expect(computeCrs(profile({ age }), { rules: '2025-03-25' })).toEqual({
      ok: false,
      issues: [{ field: 'age', code: 'AGE_OUT_OF_RANGE' }],
    });
  });
});
