'use client';

import { useSuspenseQueries } from '@tanstack/react-query';
import { FileCheck2 } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import NextLink from 'next/link';
import { useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HandOverPill } from '@/features/document-services/components/service-parts';
import { isProofOfFunds, serviceFamily, shortName } from '@/features/document-services/lib/service-families';
import { textIn } from '@/features/document-services/lib/service-schema';
import { utcDate } from '@/features/ita-countdown/lib/ita-deadline';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type UnderWay = RouterOutputs['documentServices']['dashboard']['underWay'][number];

const ALL = 'tous';

/**
 * « Services » under Clients in the Tableau de bord: the Services
 * documentaires under way for Clients, one tab per service (both proof of
 * funds together), each with where its Pièces à remettre stand. The
 * catalogue itself is managed in « Services documentaires ». `orders`: the
 * orders to approve (« Commandes »), passed in by the route; `service`: the
 * tab asked for in the address (`?service=`).
 */
export function ServicesInProgressView({
  orders,
  service = null,
}: {
  orders?: ReactNode;
  service?: string | null;
}): ReactNode {
  const t = useTranslations('DocumentServices.inProgress');
  return (
    <div className="mx-auto grid grid-cols-1 max-w-5xl gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate">
          {t.rich('intro', {
            catalogue: (chunks) => (
              <NextLink href="/services" className="font-semibold text-navy-deep underline underline-offset-2">
                {chunks}
              </NextLink>
            ),
          })}
        </p>
      </div>
      {orders}
      <QueryBoundary fallback={<InProgressSkeleton />}>
        {/* A link to another tab of this page starts it afresh on that tab. */}
        <InProgress key={service ?? ALL} asked={service} />
      </QueryBoundary>
    </div>
  );
}

function InProgress({ asked }: { asked: string | null }): ReactNode {
  const t = useTranslations('DocumentServices.inProgress');
  const locale = useLocale();
  const trpc = useTRPC();
  const [{ data }, { data: catalogue }] = useSuspenseQueries({
    queries: [trpc.documentServices.dashboard.underWay.queryOptions(), trpc.documentServices.dashboard.list.queryOptions()],
  });

  // A tab per family, in catalogue order: the active services, and any other with a request under way.
  const families = new Map<string, { label: string; rows: UnderWay[] }>();
  for (const entry of catalogue) {
    const family = serviceFamily(entry.slug);
    const underWayHere = data.some((request) => request.service?.slug === entry.slug);
    if ((!entry.active && !underWayHere) || families.has(family)) continue;
    families.set(family, {
      label: isProofOfFunds(family) ? t('proofOfFunds') : shortName(textIn(entry.name, locale)),
      rows: [],
    });
  }
  for (const request of data) {
    if (request.service) families.get(serviceFamily(request.service.slug))?.rows.push(request);
  }
  const tabs = [{ key: ALL, label: t('all'), rows: data }, ...[...families].map(([key, entry]) => ({ key, ...entry }))];
  const [tab, setTab] = useState(() => (tabs.some((entry) => entry.key === asked) ? asked! : ALL));
  const current = tabs.find((entry) => entry.key === tab) ?? tabs[0]!;

  // The tab is kept in the address, without loading anything: switching is instant.
  const choose = (next: string) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === ALL) url.searchParams.delete('service');
    else url.searchParams.set('service', next);
    window.history.replaceState(window.history.state, '', url);
  };

  return (
    <Tabs value={current.key} onValueChange={(value) => choose(String(value))} className="gap-4">
      <TabsList
        variant="line"
        aria-label={t('tabs')}
        className="w-full justify-start gap-0 overflow-x-auto border-b border-fog-light group-data-horizontal/tabs:h-auto"
      >
        {tabs.map((entry) => (
          <TabsTrigger
            key={entry.key}
            value={entry.key}
            aria-label={`${entry.label}, ${t('count', { count: entry.rows.length })}`}
            className="h-11 flex-none gap-2 rounded-none px-4 text-sm font-semibold whitespace-nowrap text-slate hover:text-navy-deep data-active:text-navy-deep group-data-horizontal/tabs:after:bottom-0 after:bg-rouge"
          >
            {entry.label}
            <span
              aria-hidden={true}
              className="inline-flex min-w-5 items-center justify-center rounded-full bg-off-white px-1.5 text-xs font-bold text-navy-deep"
            >
              {entry.rows.length}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={current.key}>
        {current.rows.length === 0 ? (
          <p className="rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate shadow-sm">{t('empty')}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {current.rows.map((request) => (
              <Row key={request.id} request={request} />
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}

function Row({ request }: { request: UnderWay }): ReactNode {
  const t = useTranslations('DocumentServices.inProgress');
  const status = useTranslations('Accompagnement.stanzy.status');
  const locale = useLocale();
  const format = useFormatter();
  // Not accepted yet: Stanzy accepts it (contract and invoice line) from the Dossier.
  const href =
    request.status === 'REQUESTED' ? `/dossiers/${request.dossierId}#stanzy` : `/dossiers/${request.dossierId}/services/${request.id}`;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fog-light bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-navy-deep">{request.client}</span>
          <span className="rounded-full bg-ice-blue px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-navy-deep">
            {status(request.status)}
          </span>
          <HandOverPill request={request} />
        </p>
        <p className="mt-1 truncate text-sm text-slate">
          {request.service ? textIn(request.service.name, locale) : null} · {t('for', { document: request.document })}
        </p>
        {request.dueOn ? (
          <p className="mt-0.5 text-xs text-slate">
            {t('due', { date: format.dateTime(utcDate(request.dueOn), { day: 'numeric', month: 'long', timeZone: 'UTC' }) })}
          </p>
        ) : null}
      </div>
      <NextLink
        href={href}
        aria-label={t('openLabel', { client: request.client })}
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
      >
        <FileCheck2 aria-hidden={true} className="size-4" />
        {t('open')}
      </NextLink>
    </li>
  );
}

function InProgressSkeleton(): ReactNode {
  const t = useTranslations('DocumentServices.inProgress');
  return (
    <div role="status" className="grid grid-cols-1 gap-4">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-11 w-full rounded-none" />
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} aria-hidden={true} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}
