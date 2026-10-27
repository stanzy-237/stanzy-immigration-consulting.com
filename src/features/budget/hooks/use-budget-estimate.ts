'use client';

import { useCallback, useState } from 'react';

import { budgetAnswersSchema, DEFAULT_ANSWERS, type BudgetAnswers } from '@/features/budget/lib/budget-schema';
import { useStoredForm } from '@/features/shared/hooks/use-stored-form';

/** Versioned, so a later change to the answers' shape discards old estimates instead of breaking. */
export const BUDGET_ESTIMATE_KEY = 'stanzy.budget.estimate.v1';

/**
 * The estimator's answers. Always kept in this browser; for a signed-in User
 * the copy saved to their Account wins until they change something.
 */
export function useBudgetEstimate(
  accountEstimate: BudgetAnswers | null | undefined,
): [BudgetAnswers, (next: BudgetAnswers) => void] {
  const [local, setLocal] = useStoredForm(BUDGET_ESTIMATE_KEY, budgetAnswersSchema, DEFAULT_ANSWERS);
  const [touched, setTouched] = useState(false);

  const update = useCallback(
    (next: BudgetAnswers) => {
      setTouched(true);
      setLocal(next);
    },
    [setLocal],
  );

  return [!touched && accountEstimate ? accountEstimate : local, update];
}
