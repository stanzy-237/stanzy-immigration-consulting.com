'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, Gauge } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { InterestForm } from '@/features/accompagnement/components/interest-form';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/**
 * « Mon espace » → Accompagnement (#81): the Demande d'intérêt to fill, or
 * where the latest one stands (à l'étude with the CRS score it gave them,
 * acceptée with its Dossier, refusée with « Faire une nouvelle demande »).
 */
export function InterestView(): ReactNode {
  const t = useTranslations('Accompagnement');
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white px-4 py-10 md:py-14">
        <div className="mx-auto grid grid-cols-1 max-w-3xl gap-6">
          <Link
            href="/mon-espace"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep"
          >
            <ArrowLeft aria-hidden={true} className="size-4" />
            {t('status.title')}
          </Link>
          <div>
            <h1 className="font-heading text-h4 font-bold text-navy-deep sm:text-h3">{t('form.title')}</h1>
            <p className="mt-2 text-body text-slate">{t('form.lead')}</p>
          </div>
          <QueryBoundary fallback={<InterestSkeleton />}>
            <Interest />
          </QueryBoundary>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Interest(): ReactNode {
  const t = useTranslations('Accompagnement.status');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.accompagnement.mine.queryOptions());
  const [again, setAgain] = useState(false);
  const latest = data.latest;
  const date = (value: Date) => format.dateTime(value, { day: 'numeric', month: 'long', year: 'numeric' });
  const box = 'grid gap-3 rounded-2xl border border-fog-light bg-white p-6 shadow-sm';
  const button =
    'inline-flex h-12 w-fit items-center rounded-full bg-rouge px-7 font-heading text-body font-bold text-white hover:bg-crimson';

  if (data.dossierId) {
    return (
      <div className={box}>
        <p className="text-body text-navy-deep">{t('approved')}</p>
        <Link href={`/mon-espace/dossiers/${data.dossierId}`} className={button}>
          {t('openDossier')}
        </Link>
      </div>
    );
  }
  if (latest?.status === 'SUBMITTED') {
    return (
      <div className="grid grid-cols-1 gap-4">
        {latest.crsScore === null ? null : <CrsScore score={latest.crsScore} />}
        <p role="status" className={`${box} text-body text-navy-deep`}>
          {t('pending', { date: date(latest.createdAt) })}
        </p>
      </div>
    );
  }
  if (latest?.status === 'REJECTED' && !again) {
    return (
      <div className={box}>
        <p className="text-body text-navy-deep">{t('rejected', { date: date(latest.createdAt) })}</p>
        <button type="button" onClick={() => setAgain(true)} className={button}>
          {t('again')}
        </button>
      </div>
    );
  }
  return <InterestForm onSent={() => setAgain(false)} />;
}

/** The CRS score their Demande gave them: the end of the form. */
function CrsScore({ score }: { score: number }): ReactNode {
  const t = useTranslations('Accompagnement.status');
  return (
    <section
      aria-labelledby="interest-crs"
      className="flex flex-wrap items-center gap-5 rounded-2xl bg-navy-deep p-6 text-white shadow-md"
    >
      <span aria-hidden={true} className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
        <Gauge className="size-7 text-rose" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="interest-crs" className="text-sm font-semibold text-ice-blue">
          {t('score')}
        </h2>
        <p className="font-heading text-5xl font-bold tabular-nums">
          {score} <span className="text-base font-semibold text-ice-blue">{t('points')}</span>
        </p>
        <p className="mt-1 text-sm text-ice-blue">{t('scoreHint')}</p>
      </div>
    </section>
  );
}

function InterestSkeleton(): ReactNode {
  const t = useTranslations('Accompagnement.status');
  return (
    <div role="status" className="grid grid-cols-1 gap-4">
      <span className="sr-only">{t('loading')}</span>
      {['h-56', 'h-40', 'h-72'].map((height) => (
        <Skeleton key={height} aria-hidden={true} className={`${height} rounded-2xl`} />
      ))}
    </div>
  );
}
