'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { EtapeCard } from '@/features/parcours/components/etape-card';
import type { Etape } from '@/features/parcours/lib/etape-schema';

/** The User's Étapes, oldest first, or an invitation to add the first one. */
export function EtapeFeed({
  etapes,
  onAdd,
  onEdit,
}: {
  etapes: Etape[];
  onAdd: () => void;
  onEdit: (etape: Etape) => void;
}): ReactNode {
  const t = useTranslations('Parcours');

  return (
    <section aria-labelledby="parcours-feed-title" className="min-w-0">
      <h2 id="parcours-feed-title" className="mb-4 font-heading text-lg font-bold tracking-tight text-navy-deep">
        {t('feedTitle')}
      </h2>
      {etapes.length > 0 && (
        <ol className="flex flex-col gap-2.5">
          {etapes.map((etape) => (
            <li key={etape.id}>
              <EtapeCard etape={etape} onEdit={() => onEdit(etape)} />
            </li>
          ))}
        </ol>
      )}
      {etapes.length === 0 && (
        <div className="grid min-h-90 place-items-center rounded-3xl border-2 border-dashed border-fog bg-white px-5 py-10 text-center">
          <div className="max-w-sm">
            <div
              aria-hidden={true}
              className="mx-auto mb-4 grid size-18 place-items-center rounded-full border-2 border-dashed border-fog bg-off-white text-3xl"
            >
              ✈️
            </div>
            <h3 className="mb-2 font-heading text-xl font-bold text-navy-deep">{t('empty.title')}</h3>
            <p className="mb-5 text-body-sm text-slate">{t('empty.text')}</p>
            <button
              type="button"
              onClick={onAdd}
              className="h-12 rounded-xl bg-rouge px-5 font-heading text-body-sm font-bold text-white hover:bg-crimson"
            >
              {t('empty.cta')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
