'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { InvoiceDetail } from '@/features/invoices/components/invoice-detail';
import { InvoiceForm } from '@/features/invoices/components/invoice-form';
import type { DossierOption } from '@/features/shared/components/dossier-picker';
import { useTRPC } from '@/trpc/client';

/** One Facture in the Tableau de bord: the form while it is a Brouillon, then what was sent. */
export function InvoiceDashboardView({ id }: { id: string }): ReactNode {
  return (
    <InvoicePage>
      <QueryBoundary fallback={<InvoiceSkeleton />}>
        <Invoice id={id} />
      </QueryBoundary>
    </InvoicePage>
  );
}

/** Ouvrir une facture, for a Dossier when started from one (`dossierId`). */
export function InvoiceNewView({ dossierId }: { dossierId?: string }): ReactNode {
  const t = useTranslations('Invoices.editor');
  return (
    <InvoicePage>
      <h1 className="mb-5 font-heading text-3xl font-bold text-navy-deep">{t('titleNew')}</h1>
      {dossierId ? (
        <QueryBoundary fallback={<InvoiceSkeleton />}>
          <NewForDossier dossierId={dossierId} />
        </QueryBoundary>
      ) : (
        <InvoiceForm draft={{ dossier: null, currency: 'XAF', dueDate: null, notes: null, lines: [] }} />
      )}
    </InvoicePage>
  );
}

function InvoicePage({ children }: { children: ReactNode }): ReactNode {
  const t = useTranslations('Invoices.editor');
  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/factures"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep"
      >
        <ArrowLeft aria-hidden={true} className="size-4" />
        {t('back')}
      </Link>
      {children}
    </div>
  );
}

function Invoice({ id }: { id: string }): ReactNode {
  const t = useTranslations('Invoices.editor');
  const trpc = useTRPC();
  const { data: invoice } = useSuspenseQuery(trpc.invoices.dashboard.get.queryOptions({ id }));
  if (invoice.status !== 'DRAFT') return <InvoiceDetail invoice={invoice} />;
  return (
    <>
      <h1 className="mb-5 font-heading text-3xl font-bold text-navy-deep">{t('titleDraft')}</h1>
      <InvoiceForm
        key={invoice.id}
        draft={{
          id: invoice.id,
          dossier: invoice.dossier as DossierOption,
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          notes: invoice.notes,
          lines: invoice.lines,
        }}
      />
    </>
  );
}

function NewForDossier({ dossierId }: { dossierId: string }): ReactNode {
  const trpc = useTRPC();
  const { data: dossier } = useSuspenseQuery(trpc.invoices.dashboard.dossierOption.queryOptions({ id: dossierId }));
  return <InvoiceForm draft={{ dossier, currency: 'XAF', dueDate: null, notes: null, lines: [] }} />;
}

function InvoiceSkeleton(): ReactNode {
  const t = useTranslations('Invoices.editor');
  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden={true} className="grid gap-5">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
