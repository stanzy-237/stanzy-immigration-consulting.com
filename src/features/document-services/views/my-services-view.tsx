'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Clock, FileCheck2, HandHelping, MapPin } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { ServicesUnderWayView } from '@/features/document-services/views/services-under-way-view';
import { Skeleton } from '@/components/ui/skeleton';
import { ServicePrice } from '@/features/document-services/components/service-parts';
import { textIn } from '@/features/document-services/lib/service-schema';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/**
 * « Mon espace » → Services (#80): the Services documentaires Stanzy offers
 * Clients in Cameroon, with their prices. `documentId` (from « Stanzy s'en
 * charge » on a Document no service covers yet) is carried to the one chosen.
 */
export function MyServicesView({ documentId }: { documentId: string | null }): ReactNode {
  const t = useTranslations('DocumentServices.mine');
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white">
        <section className="relative overflow-hidden bg-navy-deep px-4 pt-10 pb-24 text-white md:pt-14">
          <div aria-hidden={true} className="absolute -top-24 -right-24 size-80 rounded-full bg-rouge/30 blur-3xl" />
          <div aria-hidden={true} className="absolute -bottom-32 -left-16 size-72 rounded-full bg-steel-blue/30 blur-3xl" />
          <div className="relative mx-auto grid grid-cols-1 max-w-5xl gap-4">
            <Link
              href="/mon-espace"
              className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-ice-blue hover:text-white"
            >
              <ArrowLeft aria-hidden={true} className="size-4" />
              {t('back')}
            </Link>
            <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
              <MapPin aria-hidden={true} className="size-3.5" />
              {t('cameroon')}
            </p>
            <h1 className="max-w-2xl font-heading text-h3 font-bold sm:text-h2">{t('title')}</h1>
            <p className="max-w-2xl text-body-lg text-ice-blue">{t('lead')}</p>
          </div>
        </section>
        <div className="relative mx-auto -mt-14 grid grid-cols-1 max-w-5xl gap-6 px-4 pb-16">
          {documentId ? (
            <p className="flex items-start gap-3 rounded-2xl border-2 border-rose bg-blush px-5 py-4 text-sm font-semibold text-navy-deep shadow-sm">
              <HandHelping aria-hidden={true} className="mt-0.5 size-5 shrink-0 text-rouge" />
              {t('choose')}
            </p>
          ) : null}
          <ServicesUnderWayView />
          <QueryBoundary fallback={<ServicesSkeleton />}>
            <Services documentId={documentId} />
          </QueryBoundary>
          <ol className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-3">
            {(['choose', 'sign', 'deliver'] as const).map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy-deep font-heading text-sm font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="font-semibold text-navy-deep">{t(`steps.${step}.title`)}</p>
                  <p className="text-sm text-slate">{t(`steps.${step}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Services({ documentId }: { documentId: string | null }): ReactNode {
  const t = useTranslations('DocumentServices.mine');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.documentServices.list.queryOptions());
  if (!data.available) {
    return <p className="rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate shadow-sm">{t('unavailable')}</p>;
  }
  if (data.services.length === 0) {
    return <p className="rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate shadow-sm">{t('empty')}</p>;
  }
  const query = documentId ? `?document=${documentId}` : '';
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {data.services.map((service) => (
        <li key={service.id}>
          <Link
            href={`/mon-espace/services/${service.slug}${query}`}
            className="group flex h-full flex-col gap-4 rounded-2xl border border-fog-light bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-navy-deep hover:shadow-md"
          >
            <span aria-hidden={true} className="flex size-12 items-center justify-center rounded-2xl bg-ice-blue">
              <FileCheck2 className="size-6 text-navy-deep" />
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              <h2 className="font-heading text-lg font-bold text-navy-deep">{textIn(service.name, locale)}</h2>
              <p className="line-clamp-3 text-sm text-slate">{textIn(service.summary, locale)}</p>
            </div>
            <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-off-white pt-4">
              <div className="grid grid-cols-1 gap-1">
                <ServicePrice service={service} />
                <p className="flex items-center gap-1.5 text-xs text-slate">
                  <Clock aria-hidden={true} className="size-3.5" />
                  {textIn(service.turnaround, locale)}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-rouge group-hover:text-crimson">
                {t('see')}
                <ArrowRight aria-hidden={true} className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ServicesSkeleton(): ReactNode {
  const t = useTranslations('DocumentServices.mine');
  return (
    <div role="status" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <span className="sr-only">{t('loading')}</span>
      {[1, 2, 3, 4].map((key) => (
        <Skeleton key={key} aria-hidden={true} className="h-64 rounded-2xl" />
      ))}
    </div>
  );
}
