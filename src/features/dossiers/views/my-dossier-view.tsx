'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { DossierDocuments, DossierDocumentsSkeleton } from '@/features/dossiers/components/dossier-documents';
import { DossierStatePill, StageStepper } from '@/features/dossiers/components/stage-stepper';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/**
 * One of the Client's Dossiers in « Mon espace »: its stages, its Contrat
 * and Factures (`contracts`, `invoices`, passed in by the route), then its
 * Sections and Documents.
 */
export function MyDossierView({
  id,
  invoices,
  contracts,
}: {
  id: string;
  invoices?: ReactNode;
  /** The Contrat panel (#96), passed in by the route. */
  contracts?: ReactNode;
}): ReactNode {
  const t = useTranslations('Dossiers.mySpace');
  // A Notification's link (#92): the Document to unfold, the message to highlight.
  const params = useSearchParams();
  const focus = { documentId: params.get('document'), messageId: params.get('message') };
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white px-4 py-10 md:py-14">
        <div className="mx-auto grid max-w-3xl gap-10">
          <div>
            <Link
              href="/mon-espace"
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep"
            >
              <ArrowLeft aria-hidden={true} className="size-4" />
              {t('back')}
            </Link>
            <QueryBoundary fallback={<HeaderSkeleton />}>
              <MyDossierHeader id={id} />
            </QueryBoundary>
          </div>
          {contracts}
          {invoices}
          <QueryBoundary fallback={<DossierDocumentsSkeleton />}>
            <DossierDocuments dossierId={id} viewer="client" focus={focus} />
          </QueryBoundary>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function MyDossierHeader({ id }: { id: string }): ReactNode {
  const t = useTranslations('Dossiers');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data: dossier } = useSuspenseQuery(trpc.dossiers.myDossier.queryOptions({ id }));
  const date = (value: Date) => format.dateTime(value, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <article className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">
            {t(`services.${dossier.service}`)}
          </h1>
          <p className="mt-0.5 text-sm text-slate">{t('mySpace.openedOn', { date: date(dossier.createdAt) })}</p>
        </div>
        <DossierStatePill dossier={dossier} />
      </header>
      <div id="etapes" className="scroll-mt-20">
        <StageStepper service={dossier.service} stage={dossier.stage} startStage={dossier.startStage} />
      </div>
      {dossier.state === 'CLOSED' ? (
        <p className="mt-4 border-t border-off-white pt-4 text-sm text-slate">
          {t('mySpace.closedOn', { date: date(dossier.closedAt ?? dossier.updatedAt) })}
          {dossier.closedReason ? ` · ${t('mySpace.closedReason', { reason: dossier.closedReason })}` : null}
        </p>
      ) : null}
    </article>
  );
}

function HeaderSkeleton(): ReactNode {
  const t = useTranslations('Dossiers.mySpace');
  return (
    <div role="status">
      <span className="sr-only">{t('loadingDossier')}</span>
      <Skeleton aria-hidden={true} className="h-96 rounded-2xl" />
    </div>
  );
}
