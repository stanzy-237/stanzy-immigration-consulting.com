'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { FileStack } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { HandOverPill } from '@/features/document-services/components/service-parts';
import { textIn } from '@/features/document-services/lib/service-schema';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type UnderWay = RouterOutputs['documentServices']['requirements']['mine'][number];


/**
 * « Mes services en cours » (`#en-cours`), above the catalogue in « Mon
 * espace » → Services: each Service documentaire under way for the Client,
 * where its Pièces à remettre stand, and the way to it. Nothing when none.
 */
export function ServicesUnderWayView(): ReactNode {
  return (
    <QueryBoundary fallback={null}>
      <UnderWayList />
    </QueryBoundary>
  );
}

function UnderWayList(): ReactNode {
  const t = useTranslations('DocumentServices.underWay');
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.documentServices.requirements.mine.queryOptions());
  const services = data.filter((request) => request.service);
  if (services.length === 0) return null;
  return (
    <section id="en-cours" aria-labelledby="en-cours-title" className="grid scroll-mt-24 grid-cols-1 gap-3 rounded-2xl bg-white p-6 shadow-sm">
      <h2 id="en-cours-title" className="flex items-center gap-2 font-heading text-xl font-bold text-navy-deep">
        <FileStack aria-hidden={true} className="size-5 text-rouge" />
        {t('title')}
      </h2>
      <ul className="grid grid-cols-1 gap-2">
        {services.map((request) => (
          <Row key={request.id} request={request} />
        ))}
      </ul>
    </section>
  );
}

function Row({ request }: { request: UnderWay }): ReactNode {
  const t = useTranslations('DocumentServices.underWay');
  const locale = useLocale();
  const name = textIn(request.service!.name, locale);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-off-white px-4 py-3">
      <div className="min-w-0">
        <p className="font-semibold text-navy-deep">{name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate">
          {t('for', { document: request.document })}
          <HandOverPill request={request} fallback={t('underWay')} />
        </p>
      </div>
      <Link
        href={`/mon-espace/services/demandes/${request.id}`}
        aria-label={t('openLabel', { service: name })}
        className="inline-flex h-10 items-center rounded-full border border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
      >
        {t('open')}
      </Link>
    </li>
  );
}
