'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/features/invoices/lib/money';
import { useTRPC } from '@/trpc/client';

/**
 * A Dossier's Recettes, Charges and margin in FCFA (#95), for the consultant's
 * Dossier page: the route passes it as the dossiers view's `finances` slot.
 */
export function DossierFinancesView({ dossierId }: { dossierId: string }): ReactNode {
  return (
    <QueryBoundary fallback={<Skeleton aria-hidden={true} className="h-24 rounded-2xl" />}>
      <DossierFinances dossierId={dossierId} />
    </QueryBoundary>
  );
}

function DossierFinances({ dossierId }: { dossierId: string }): ReactNode {
  const t = useTranslations('Finances.dossier');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.finances.dossier.queryOptions({ dossierId }));
  const xaf = (amount: number) => formatMoney(amount, 'XAF', locale);
  return (
    <section aria-labelledby="dossier-finances" className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="dossier-finances" className="font-heading text-lg font-bold text-navy-deep">
          {t('title')}
        </h2>
        <Link href="/finances" className="text-sm font-semibold text-rouge hover:text-crimson">
          {t('open')}
        </Link>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs font-semibold text-slate">{t('income')}</dt>
          <dd className="font-semibold text-navy-deep tabular-nums">{xaf(data.income)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate">{t('charges')}</dt>
          <dd className="font-semibold text-navy-deep tabular-nums">{xaf(data.charges)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate">{t('margin')}</dt>
          <dd className={`font-bold tabular-nums ${data.net < 0 ? 'text-crimson' : 'text-navy-deep'}`}>{xaf(data.net)}</dd>
        </div>
      </dl>
      {data.unconverted ? <p className="mt-2 text-xs text-honey">{t('unconverted')}</p> : null}
    </section>
  );
}
