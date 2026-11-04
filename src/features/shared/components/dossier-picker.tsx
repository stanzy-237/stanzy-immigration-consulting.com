'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useState, type ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import type { ServiceType } from '@/features/dossiers/data/workflows';
import { dossierSearchInput } from '@/features/invoices/lib/invoice-schema';
import { useTRPC } from '@/trpc/client';

const field =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge';
const label = 'mb-1.5 block text-sm font-semibold text-navy-deep';
const hint = 'mt-1 text-xs text-slate';

/** A Dossier as a picker shows it: its Client and service. */
export type DossierOption = { id: string; service: ServiceType; account: { name: string; email: string } };

/** Finds an open Dossier by its Client's name or email; once chosen, shows it with « Changer ». */
export function DossierPicker({
  id,
  value,
  invalid,
  onChange,
}: {
  id: string;
  value: DossierOption | null;
  invalid: boolean;
  onChange: (dossier: DossierOption | null) => void;
}): ReactNode {
  const t = useTranslations();
  const trpc = useTRPC();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());
  const searchable = dossierSearchInput.safeParse({ query: deferred }).success;
  const { data: matches, isPending } = useQuery({
    ...trpc.invoices.dashboard.searchDossiers.queryOptions({ query: deferred }),
    enabled: searchable && !value,
  });

  if (value) {
    return (
      <div>
        <p className={label}>{t('Invoices.editor.dossier')}</p>
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-navy-deep px-3.5 py-2.5">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-navy-deep">{value.account.name}</span>
            <span className="block truncate text-xs text-slate">
              {t(`Dossiers.services.${value.service}`)} · {value.account.email}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 text-sm font-semibold text-rouge hover:text-crimson"
          >
            {t('Invoices.editor.change')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className={label}>
        {t('Invoices.editor.dossier')}
      </label>
      <input
        id={id}
        type="search"
        autoComplete="off"
        className={field}
        value={query}
        placeholder={t('Invoices.editor.dossierSearch')}
        aria-invalid={invalid}
        aria-describedby={`${id}-hint`}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p id={`${id}-hint`} className={invalid ? 'mt-1 text-sm text-rouge' : hint}>
        {invalid ? t('Invoices.editor.dossierRequired') : t('Invoices.editor.dossierHint')}
      </p>
      {searchable ? (
        <div className="mt-2">
          {isPending ? (
            <div role="status">
              <span className="sr-only">{t('Invoices.editor.loadingDossiers')}</span>
              <Skeleton aria-hidden={true} className="h-12 rounded-xl" />
            </div>
          ) : matches && matches.length > 0 ? (
            <ul className="grid gap-1.5">
              {matches.map((match) => (
                <li key={match.id}>
                  <button
                    type="button"
                    onClick={() => onChange(match)}
                    className="flex w-full flex-col rounded-xl border border-fog-light px-3.5 py-2 text-left hover:border-navy-deep"
                  >
                    <span className="truncate text-sm font-semibold text-navy-deep">{match.account.name}</span>
                    <span className="truncate text-xs text-slate">
                      {t(`Dossiers.services.${match.service}`)} · {match.account.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate">{t('Invoices.editor.noMatch')}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
