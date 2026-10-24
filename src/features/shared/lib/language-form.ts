import type { LanguageTest } from '@/features/shared/data/language-tests';
import { ABILITIES, type Ability, type LanguageResult } from '@/features/shared/lib/language-levels';

/**
 * One official-language test as a visitor types it: which test, and the four
 * results as strings (so a half-typed "6," survives). Shared by the
 * calculators' forms; `toLanguageResult` turns it into engine input.
 */
export type LanguageForm = { test: LanguageTest | 'none'; scores: Record<Ability, string> };

const emptyScores = (): Record<Ability, string> => ({ speaking: '', listening: '', reading: '', writing: '' });
export const emptyLanguage = (): LanguageForm => ({ test: 'none', scores: emptyScores() });

/** A typed number, accepting a French decimal comma; NaN when blank or not a number. */
export const parseScore = (raw: string): number => (raw.trim() === '' ? Number.NaN : Number(raw.trim().replace(',', '.')));

/** A test counts once a test is chosen and all four results are typed. */
export function toLanguageResult(form: LanguageForm | null): LanguageResult | null {
  if (!form || form.test === 'none') return null;
  if (ABILITIES.some((a) => form.scores[a].trim() === '')) return null;
  const scores = Object.fromEntries(ABILITIES.map((a) => [a, parseScore(form.scores[a])])) as Record<Ability, number>;
  return { test: form.test, scores };
}

export const fromLanguageResult = (result: LanguageResult | null | undefined): LanguageForm =>
  result
    ? { test: result.test, scores: Object.fromEntries(ABILITIES.map((a) => [a, String(result.scores[a])])) as Record<Ability, string> }
    : emptyLanguage();
