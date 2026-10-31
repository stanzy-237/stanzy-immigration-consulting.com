'use client';

import { useFormatter, useTranslations } from 'next-intl';

import type { ChecklistPerson } from '@/features/checklist/lib/build-checklist';

/** « 4 160,00 $ »: CAD, its columns and labels already say so, as in IRCC's checklist. */
export function useCad(): (amount: number) => string {
  const format = useFormatter();
  return (amount) => format.number(amount, { style: 'currency', currency: 'CAD', currencyDisplay: 'narrowSymbol' });
}

/** « Requérant principal », « Conjoint(e) », « Enfant 2 », for each person. */
export function usePeopleNames(people: ChecklistPerson[]): string[] {
  const t = useTranslations('Checklist.list.people');
  return people.map((person) => (person.kind === 'child' ? t('child', { number: person.number ?? 1 }) : t(person.kind)));
}
