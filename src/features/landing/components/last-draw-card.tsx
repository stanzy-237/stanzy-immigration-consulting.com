'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/**
 * « Dernier tirage » on a phone (`PWA · Visiteur`): the round and its
 * minimum CRS in one navy line, its date and invitations under, « Tirages ».
 * Same query as the home page's prefetch, so it is there at once.
 */
export function LastDrawCard(): ReactNode {
  return (
    <QueryBoundary fallback={<div aria-hidden={true} className="h-24 rounded-2xl bg-navy-deep" />}>
      <LastDraw />
    </QueryBoundary>
  );
}

function LastDraw(): ReactNode {
  const t = useTranslations('Home.Phone');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.draws.latest.queryOptions({ take: 4 }));
  const draw = data.draws[0];
  if (!draw) return null;
  const date = format.dateTime(new Date(`${draw.date}T12:00:00Z`), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <section aria-labelledby="last-draw" className="flex items-center gap-3 rounded-2xl bg-navy-deep px-4 py-3.5 text-white">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 id="last-draw" className="font-label text-label font-bold tracking-wide text-rose uppercase">
          {t('lastDraw')}
        </h2>
        <p className="truncate font-heading text-body font-extrabold">{t('drawLine', { round: draw.round, crs: draw.crsMin })}</p>
        <p className="text-caption text-white/70">{t('drawFacts', { date, invitations: format.number(draw.invitations) })}</p>
      </div>
      <Link href="/outils/dernier-tirage" className="flex h-9 shrink-0 items-center rounded-full bg-white px-3.5 font-heading text-body-sm font-bold text-navy-deep">
        {t('draws')}
      </Link>
    </section>
  );
}
