'use client';

import { budgetAnswersSchema, DEFAULT_ANSWERS, type BudgetAnswers } from '@/features/budget/lib/budget-schema';
import { useStoredForm } from '@/features/shared/hooks/use-stored-form';

/** Versioned, so a later change to the answers' shape discards old estimates instead of breaking. */
export const BUDGET_ESTIMATE_KEY = 'stanzy.budget.estimate.v1';

/** The estimator's answers, kept in this browser only (never on the Account). */
export function useBudgetEstimate(): [BudgetAnswers, (next: BudgetAnswers) => void] {
  return useStoredForm(BUDGET_ESTIMATE_KEY, budgetAnswersSchema, DEFAULT_ANSWERS);
}
