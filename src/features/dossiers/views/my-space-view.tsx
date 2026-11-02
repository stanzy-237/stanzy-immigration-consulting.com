'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight, FolderOpen } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { DossierStatePill, StageStepper } from '@/features/dossiers/components/stage-stepper';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/**
 * « Mon espace »: the signed-in Account's Dossiers, each with its stages.
 * Documents and invoices join each Dossier in later slices of #79.
 */
export function MySpaceView(): ReactNode {
  const t = useTranslations('Dossiers.mySpace');
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white px-4 py-10 md:py-14">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-heading text-3xl font-bold text-navy-deep md:text-4xl">{t('title')}</h1>
          <p className="mt-2 text-slate">{t('subtitle')}</p>
          <div className="mt-8">
            <QueryBoundary fallback={<MyDossiersSkeleton />}>
              <MyDossiers />
            </QueryBoundary>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function MyDossiers(): ReactNode {
  const t = useTranslations('Dossiers');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data: dossiers } = useSuspenseQuery(trpc.dossiers.mine.queryOptions());
  const date = (value: Date) => format.dateTime(value, { day: 'numeric', month: 'long', year: 'numeric' });

  if (dossiers.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-12 text-center">
        <FolderOpen aria-hidden={true} className="mx-auto size-10 text-slate-mute" />
        <p className="mt-3 font-semibold text-navy-deep">{t('mySpace.empty')}</p>
        <p className="mt-1 text-sm text-slate">{t('mySpace.emptyHint')}</p>
        <Link
          href="/#services"
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson"
        >
          {t('mySpace.servicesLink')}
          <ArrowRight aria-hidden={true} className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-5">
      {dossiers.map((dossier) => (
        <li key={dossier.id}>
          <article className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
            <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-bold text-navy-deep">{t(`services.${dossier.service}`)}</h2>
                <p className="mt-0.5 text-sm text-slate">{t('mySpace.openedOn', { date: date(dossier.createdAt) })}</p>
              </div>
              <DossierStatePill dossier={dossier} />
            </header>
            <StageStepper service={dossier.service} stage={dossier.stage} startStage={dossier.startStage} />
            {dossier.state === 'CLOSED' ? (
              <p className="mt-4 border-t border-off-white pt-4 text-sm text-slate">
                {t('mySpace.closedOn', {
                  date: date(dossier.closedAt ?? dossier.updatedAt),
                })}
                {dossier.closedReason ? ` · ${t('mySpace.closedReason', { reason: dossier.closedReason })}` : null}
              </p>
            ) : null}
          </article>
        </li>
      ))}
    </ul>
  );
}

function MyDossiersSkeleton(): ReactNode {
  const t = useTranslations('Dossiers.mySpace');
  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden={true} className="grid gap-5">
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}
