'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { FileStack } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
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
  if (services.length === 0) return <NothingYet />;
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

/** A Client with no document from Stanzy yet: say so plainly, the catalogue follows. */
function NothingYet(): ReactNode {
  const t = useTranslations('DocumentServices.underWay');
  return (
    <section aria-labelledby="nothing-yet" className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
      <span className="relative size-18 shrink-0 overflow-hidden rounded-full bg-ice-blue">
        <Image unoptimized={true} src="/stanzy/idle.svg" alt="" width={240} height={420} className="absolute -top-2 left-1/2 h-auto w-26 max-w-none -translate-x-1/2" />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="nothing-yet" className="font-heading text-body-lg font-extrabold text-navy-deep">
          {t('emptyTitle')}
        </h2>
        <p className="text-body-sm leading-5 text-slate">{t('emptyLead')}</p>
      </div>
    </section>
  );
}
