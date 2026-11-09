'use client';

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { DossierDocuments, DossierDocumentsSkeleton } from '@/features/dossiers/components/dossier-documents';
import { DossierMessages, DossierMessagesSkeleton } from '@/features/dossiers/components/dossier-messages';
import { DossierStatePill, StageStepper } from '@/features/dossiers/components/stage-stepper';
import { DossierTabs } from '@/features/dossiers/components/dossier-tabs';
import { useDossierCounts } from '@/features/dossiers/hooks/use-dossier-counts';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/**
 * One of the Client's Dossiers in « Mon espace »: a header always in view,
 * then tabs (Aperçu, Documents, Messages, Réunions, Facturation). The top
 * of the Aperçu, the Documents tab, the Contrat, Factures and Réunions are
 * passed in by the route.
 */
export function MyDossierView({
  id,
  notice,
  documents,
  overview,
  invoices,
  contracts,
  meetings,
}: {
  id: string;
  /** Above the Dossier: the pieces still to hand over for its services, passed in by the route. */
  notice?: ReactNode;
  /** The Documents tab; by default the Dossier's Documents (`MyDossierDocumentsView`). */
  documents?: ReactNode;
  /** The top of the Aperçu (#81: CRS score, ITA countdown), passed in by the route. */
  overview?: ReactNode;
  invoices?: ReactNode;
  /** The Contrat panel (#96), passed in by the route. */
  contracts?: ReactNode;
  /** The Réunions panel (#94), passed in by the route. */
  meetings?: ReactNode;
}): ReactNode {
  const t = useTranslations('Dossiers.mySpace');
  const counts = useDossierCounts(id);
  // Prefetched by the route: known on the first render, so the right tab opens at once.
  const trpc = useTRPC();
  const { data: dossier } = useQuery(trpc.dossiers.myDossier.queryOptions({ id }));
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white px-4 py-10 md:py-14">
        <div className="mx-auto grid grid-cols-1 max-w-3xl gap-10">
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
            {notice ? <div className="mt-6">{notice}</div> : null}
          </div>
          <DossierTabs
            counts={counts}
            // A Service documentaire's Dossier is about its documents: its pieces first (ServiceStepsView).
            fallback={dossier?.service === 'SERVICE_DOCUMENTAIRE' ? 'documents' : 'apercu'}
            panels={{
              apercu: (
                <>
                  {overview}
                  <QueryBoundary fallback={<HeaderSkeleton />}>
                    <MyDossierStages id={id} />
                  </QueryBoundary>
                </>
              ),
              documents: documents ?? <MyDossierDocumentsView id={id} />,
              messages: (
                <QueryBoundary fallback={<DossierMessagesSkeleton />}>
                  <DossierMessages dossierId={id} viewer="client" />
                </QueryBoundary>
              ),
              reunions: meetings,
              facturation: (
                <>
                  {contracts}
                  {invoices}
                </>
              ),
            }}
          />
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
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">{t(`services.${dossier.service}`)}</h1>
        <p className="mt-0.5 text-sm text-slate">{t('mySpace.openedOn', { date: date(dossier.createdAt) })}</p>
        <p className="mt-1 text-sm font-semibold text-navy-deep">
          {t('tabs.stage', { stage: t(`stages.${dossier.service}.${dossier.stage}` as never) })}
        </p>
      </div>
      <DossierStatePill dossier={dossier} />
    </header>
  );
}

/** « Aperçu »: where the Dossier stands among its stages, and why it closed. */
function MyDossierStages({ id }: { id: string }): ReactNode {
  const t = useTranslations('Dossiers');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data: dossier } = useSuspenseQuery(trpc.dossiers.myDossier.queryOptions({ id }));
  const date = (value: Date) => format.dateTime(value, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <article className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
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

/** The Dossier's Documents for its Client, one unfolded when a Notification points to it (#92). */
export function MyDossierDocumentsView({ id }: { id: string }): ReactNode {
  const params = useSearchParams();
  const focus = { documentId: params.get('document'), messageId: params.get('message') };
  return (
    <QueryBoundary fallback={<DossierDocumentsSkeleton />}>
      <DossierDocuments dossierId={id} viewer="client" focus={focus} />
    </QueryBoundary>
  );
}
