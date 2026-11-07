'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ExternalLink, FileText } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { contractPdfUrl } from '@/features/contracts/lib/contract-urls';
import { useTRPC } from '@/trpc/client';

const STATUS_STYLES = {
  SENT: 'bg-honey-tint text-honey',
  SIGNED: 'bg-leaf-tint text-leaf',
  CANCELLED: 'bg-fog-light text-slate',
} as const;

/** « Contrats » in the Tableau de bord (#96): every Contrat and Avenant sent, and the way to the templates. */
export function ContractsDashboardView(): ReactNode {
  const t = useTranslations('Contracts.dashboard');
  return (
    <div className="mx-auto grid grid-cols-1 max-w-5xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate">{t('intro')}</p>
        </div>
        <Link
          href="/contrats/modeles"
          className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
        >
          <FileText aria-hidden={true} className="size-4" />
          {t('templates')}
        </Link>
      </div>
      <QueryBoundary fallback={<ListSkeleton />}>
        <ContractList />
      </QueryBoundary>
    </div>
  );
}

function ContractList(): ReactNode {
  const t = useTranslations('Contracts');
  const services = useTranslations('Dossiers.services');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data: contracts } = useSuspenseQuery(trpc.contracts.list.queryOptions());
  const date = (value: Date) => format.dateTime(value, { day: 'numeric', month: 'short', year: 'numeric' });

  if (contracts.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-10 text-center text-sm text-slate">
        {t('dashboard.empty')}
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-2">
      {contracts.map((contract) => (
        <li
          key={contract.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fog-light bg-white p-4 shadow-sm"
        >
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-navy-deep">{contract.number}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[contract.status]}`}>
                {t(`status.${contract.status}`)}
              </span>
            </p>
            <p className="truncate text-sm text-navy-deep">
              {contract.dossier.account.name} · {services(contract.dossier.service)}
            </p>
            <p className="text-xs text-slate">
              {contract.signedAt
                ? t('panel.signedOn', { date: date(contract.signedAt), name: contract.signedName ?? '' })
                : t('panel.sentOn', { date: date(contract.sentAt) })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={contractPdfUrl(contract.id)}
              target="_blank"
              rel="noopener"
              aria-label={t('panel.pdfLabel', { number: contract.number })}
              className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-rouge hover:text-crimson"
            >
              {t('panel.pdf')}
              <ExternalLink aria-hidden={true} className="size-3.5" />
            </a>
            <Link
              href={`/dossiers/${contract.dossier.id}#contrats`}
              className="inline-flex h-10 items-center rounded-full px-3 text-sm font-semibold text-navy-deep hover:bg-off-white"
            >
              {t('dashboard.open')}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton(): ReactNode {
  const t = useTranslations('Contracts.dashboard');
  return (
    <div role="status" className="grid grid-cols-1 gap-2">
      <span className="sr-only">{t('loading')}</span>
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} aria-hidden={true} className="h-20 rounded-2xl" />
      ))}
    </div>
  );
}
