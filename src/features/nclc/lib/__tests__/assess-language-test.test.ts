import { describe, expect, it } from 'vitest';

import { assessLanguageTest } from '@/features/nclc/lib/assess-language-test';

/**
 * Seam: one official-language test's results in, what they're worth for
 * Entrée Express out. Expected levels come from IRCC's equivalence charts;
 * CRS points from the "without spouse" first-language column.
 */
describe('assessLanguageTest', () => {
  it('converts TCF Canada results to NCLC and keeps the weakest skill', () => {
    const result = assessLanguageTest({ test: 'TCF', scores: { listening: 690, reading: 699, speaking: 19, writing: 12 } });

    expect(result).toEqual({
      ok: true,
      assessment: {
        language: 'fr',
        levels: { listening: 10, reading: 10, speaking: 10, writing: 8 },
        retained: 8,
        // 34 + 34 + 34 + 23, as a single candidate's first official language.
        crsFirstLanguage: 125,
        // NCLC 7+ on all four: 25 alone, 50 with English CLB 5+.
        frenchBonus: { alone: 25, withEnglish: 50 },
        programs: { fsw: true, cecTeer01: true, cecTeer23: true, fst: true },
      },
    });
  });

  it('scores an English test as CLB, with no French bonus', () => {
    const result = assessLanguageTest({ test: 'IELTS', scores: { listening: 6, reading: 6, speaking: 6, writing: 6 } });

    expect(result).toMatchObject({
      ok: true,
      assessment: { language: 'en', levels: { listening: 7, reading: 7, speaking: 7, writing: 7 }, retained: 7, crsFirstLanguage: 68, frenchBonus: null },
    });
  });

  it('tells which programs a CLB 5/4 profile reaches: trades only', () => {
    const result = assessLanguageTest({ test: 'CELPIP', scores: { speaking: 5, listening: 5, reading: 4, writing: 4 } });

    expect(result).toMatchObject({
      ok: true,
      assessment: { retained: 4, crsFirstLanguage: 24, programs: { fsw: false, cecTeer01: false, cecTeer23: false, fst: true } },
    });
  });

  it('gives no French bonus below NCLC 7 on any skill', () => {
    const result = assessLanguageTest({ test: 'TEF', scores: { speaking: 349, listening: 280, reading: 233, writing: 300 } });

    // Writing 300 is NCLC 6 (310 is needed for 7).
    expect(result).toMatchObject({ ok: true, assessment: { retained: 6, frenchBonus: null, programs: { fsw: false, cecTeer23: true } } });
  });

  it('reports a level below 4 as 0, which reaches nothing', () => {
    const result = assessLanguageTest({ test: 'TEF', scores: { speaking: 100, listening: 316, reading: 263, writing: 393 } });

    expect(result).toMatchObject({
      ok: true,
      assessment: { levels: { speaking: 0 }, retained: 0, programs: { fsw: false, cecTeer01: false, cecTeer23: false, fst: false } },
    });
  });

  it('names the results that are not possible for the test', () => {
    expect(assessLanguageTest({ test: 'TCF', scores: { listening: 700, reading: 500, speaking: 21, writing: 10 } })).toEqual({
      ok: false,
      invalid: ['speaking', 'listening'],
    });
    expect(assessLanguageTest({ test: 'IELTS', scores: { listening: 6.3, reading: 6, speaking: 6, writing: 6 } })).toEqual({
      ok: false,
      invalid: ['listening'],
    });
  });
});
