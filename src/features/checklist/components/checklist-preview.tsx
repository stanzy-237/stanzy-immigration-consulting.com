'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, type ReactNode } from 'react';

import { useCad, usePeopleNames } from '@/features/checklist/hooks/use-checklist-labels';
import { buildChecklist } from '@/features/checklist/lib/build-checklist';
import { checklistFees } from '@/features/checklist/lib/checklist-fees';
import type { ChecklistForm } from '@/features/checklist/lib/checklist-form';

/**
 * « Votre dossier », beside the form: what the answers give so far (the
 * documents, the people, IRCC's fees), updated with each answer, like the CRS
 * calculator's score card. Its button sends the form.
 */
export function ChecklistPreview({ form }: { form: ChecklistForm }): ReactNode {
  const t = useTranslations('Checklist.preview');
  const cad = useCad();
  const people = useMemo(() => buildChecklist(form), [form]);
  const names = usePeopleNames(people);
  const slots = people.flatMap((person) => person.slots);
  const pieces = slots.flatMap((slot) => slot.pieces);
  const mandatory = pieces.filter((piece) => piece.need === 'mandatory').length;
  const { total } = checklistFees(form);

  return (
    <aside aria-labelledby="checklist-preview" className="lg:sticky-below-nav">
      <div className="overflow-hidden rounded-2xl bg-navy-deep p-6 text-white shadow-lg">
        <h2 id="checklist-preview" className="font-label text-white/60">
          {t('title')}
        </h2>
        <p className="mt-4 flex items-baseline gap-2">
          <span className="font-heading text-6xl font-bold leading-none tabular-nums">{mandatory}</span>
          <span className="text-body-sm text-white/80">
            <span aria-hidden={true} className="text-rose">
              ★{' '}
            </span>
            {t('mandatory')}
          </span>
        </p>
        <p className="mt-2 text-body-sm text-white/60">{t('more', { recommended: pieces.length - mandatory, slots: slots.length })}</p>

        <p className="mt-6 font-label text-white/60">{t('people')}</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {names.map((name) => (
            <li key={name} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
              {name}
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="font-label text-white/60">{t('fees')}</p>
          <p className="mt-1 font-heading text-3xl font-bold tabular-nums">{cad(total)}</p>
          <p className="mt-1 text-xs text-white/50">{t('feesNote')}</p>
        </div>

        <button
          type="submit"
          className="mt-6 hidden h-12 w-full items-center justify-center gap-2 rounded-full bg-rouge font-heading text-body font-bold text-white transition-colors hover:bg-crimson lg:flex"
        >
          {t('cta')}
          <ArrowRight aria-hidden={true} className="size-4" />
        </button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-white/50">
          <Sparkles aria-hidden={true} className="size-3.5" />
          {t('live')}
        </p>
      </div>
    </aside>
  );
}
