import { describe, expect, it } from 'vitest';

import { DEFAULT_RATES } from '@/features/budget/data/currencies';
import { DEFAULT_ANSWERS, type BudgetAnswers } from '@/features/budget/lib/budget-schema';
import { estimateBudget } from '@/features/budget/lib/estimate-budget';

/**
 * Edge cases of IRCC's tables the page tests don't reach. Expected amounts
 * come from IRCC's fee page (30 Apr 2026) and proof-of-funds table (7 Jul 2025).
 */
const inCad = (patch: Partial<BudgetAnswers>) =>
  estimateBudget({ ...DEFAULT_ANSWERS, currency: 'CAD', ...patch }, DEFAULT_RATES);

const biometrics = (patch: Partial<BudgetAnswers>) =>
  inCad(patch).fees.find((line) => line.key === 'biometrics')?.amount;

describe('estimateBudget', () => {
  it.each([
    ['a single applicant', {}, 85],
    ['a couple', { spouse: true }, 170],
    ['a couple and three children, capped for the family', { spouse: true, children: 3 }, 170],
    ['a single parent and one child', { children: 1 }, 170],
  ])('charges biometrics for %s: %s CAD', (_, patch, expected) => {
    expect(biometrics(patch)).toBe(expected);
  });

  it.each([
    ['7 persons, the last row of the table', { spouse: true, children: 5 }, 40_392],
    ['8 persons, one beyond the table', { spouse: true, children: 6 }, 44_504],
    ['10 persons', { spouse: true, children: 8 }, 52_728],
  ])('asks for proof of funds for %s: %s CAD', (_, patch, expected) => {
    expect(inCad(patch).fundsToProve).toMatchObject({ cad: expected });
  });

  it('never adds the proof of funds to the fees', () => {
    // Single applicant: 990 + 600 + 85 + 300 (WES) + 210 000 XAF / 440 (TEF) +
    // 114 520 / 440 (medical, the IOM's price from 15) + 25 000 / 440 (police)
    // + 110 000 / 440 (passport) + 5 000 / 440 (photos), each line rounded:
    // 1 975 + 477 + 260 + 57 + 250 + 11.
    expect(inCad({}).feesTotal).toBe(3_030);
    expect(inCad({}).fundsToProve).toMatchObject({ persons: 1, cad: 15_263 });
  });
});
