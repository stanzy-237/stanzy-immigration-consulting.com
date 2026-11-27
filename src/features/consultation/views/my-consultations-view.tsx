'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { SpaceTabs } from '@/features/consultation/components/space-parts';
import { money } from '@/features/consultation/lib/money';
import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { TAB_BAR_ROOM } from '@/features/shared/components/space-tab-bar';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Item = RouterOutputs['consultationSpace']['list']['upcoming'][number];
const DOUALA = 'Africa/Douala';

/** « Mes consultations » (`Mon espace v2 · 5 Mes consultations`, `6 Aucune consultation`). */
export function MyConsultationsView(): ReactNode {
  const t = useTranslations('Consultation.space');
  return (
    <>
      <SiteNav />
      <main className={cn('min-h-screen bg-off-white px-4 py-8 sm:py-10 md:py-14', TAB_BAR_ROOM)}>
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:gap-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-2">
              <p className={cn(LABEL_CLASS, 'text-slate max-sm:hidden')}>{t('eyebrow')}</p>
              <h1 className="font-heading text-h3 leading-9 font-extrabold tracking-tight text-navy-deep sm:text-h2 sm:leading-11">
                <span className="sm:hidden">{t('phoneTitle')}</span>
                <span className="max-sm:hidden">{t('listTitle')}</span>
              </h1>
            </div>
            <div className="max-sm:hidden">
              <SpaceTabs />
            </div>
          </div>
          <QueryBoundary fallback={<Skeleton className="h-64 rounded-3xl" />}>
            <List />
          </QueryBoundary>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function List(): ReactNode {
  const t = useTranslations('Consultation.space');
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.consultationSpace.list.queryOptions());
  if (data.upcoming.length === 0 && data.past.length === 0) return <NoConsultation />;
  return (
    <div className="flex flex-col gap-8">
      {/* Phone: « Réserver » sits above the tab bar. */}
      <div className="flex justify-end max-sm:fixed max-sm:inset-x-4 max-sm:bottom-24 max-sm:z-30">
        <Link
          href="/services/consultation/reserver"
          className={cn('flex h-12 items-center justify-center rounded-full bg-rouge px-6 font-heading text-body-sm font-bold text-white hover:bg-crimson max-sm:h-14 max-sm:w-full max-sm:text-body max-sm:shadow-lg', PRESS)}
        >
          {t('book')}
        </Link>
      </div>
      {data.upcoming.length ? (
        <section aria-labelledby="upcoming" className="flex flex-col gap-3">
          <h2 id="upcoming" className={cn(LABEL_CLASS, 'text-slate')}>
            {t('upcoming')}
          </h2>
          {data.upcoming.map((item, i) => (
            <Row key={item.id} item={item} first={i === 0} />
          ))}
        </section>
      ) : null}
      {data.past.length ? (
        <section aria-labelledby="past" className="flex flex-col gap-3">
          <h2 id="past" className={cn(LABEL_CLASS, 'text-slate')}>
            {t('past')}
          </h2>
          {data.past.map((item) => (
            <Row key={item.id} item={item} first={false} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function Row({ item, first }: { item: Item; first: boolean }): ReactNode {
  const t = useTranslations('Consultation.space');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const starts = new Date(item.startsAt);
  const ends = new Date(starts.getTime() + item.durationMinutes * 60_000);
  const time = (d: Date) => format.dateTime(d, { hour: '2-digit', minute: '2-digit', timeZone: DOUALA });
  const pending = item.status === 'HELD';
  const title = item.over
    ? t('row.pastTitle', { minutes: item.minutes })
    : t('row.title', { day: format.dateTime(starts, { weekday: 'long', timeZone: DOUALA }), start: time(starts), end: time(ends) });
  const detail = pending
    ? t('row.pending', { network: item.pendingNetwork ?? 'SasPay' })
    : item.over
      ? item.published
        ? t('row.published', { steps: item.steps.total, done: item.steps.done })
        : t('row.preparing')
      : item.paid
        ? t('row.paid', { amount: money(item.paid.amount, item.paid.currency, 'fr-FR') })
        : '';
  const badge = pending
    ? { text: t('badge.pending'), tone: 'bg-honey-tint text-honey' }
    : item.over
      ? item.published
        ? { text: t('badge.recording'), tone: 'bg-iris-tint text-iris' }
        : { text: t('badge.preparing'), tone: 'bg-ice-blue text-ink' }
      : { text: format.relativeTime(starts, now), tone: 'bg-honey-tint text-honey' };
  // Phone: « Mer. 09:00 – 09:45 », or « 42 min · 1 étape sur 3 ».
  const phoneTitle = item.over
    ? item.published && item.steps.total
      ? t('row.phonePast', { minutes: item.minutes, done: item.steps.done, total: item.steps.total })
      : t('row.pastTitle', { minutes: item.minutes })
    : `${format.dateTime(starts, { weekday: 'short', timeZone: DOUALA }).replace('.', '')} ${time(starts)} – ${time(ends)}`;
  const cta = pending ? t('cta.see') : item.over ? t('cta.review') : t('cta.prepare');
  const href = pending ? '/services/consultation/reserver' : `/mon-espace/consultations/${item.id}`;
  return (
    <article
      className={cn(
        'relative flex items-center gap-4 rounded-3xl bg-white p-4 sm:p-5',
        first && !item.over ? 'border-2 border-navy-deep' : 'border border-fog-light',
      )}
    >
      <span aria-hidden={true} className={cn('flex size-15 shrink-0 flex-col items-center justify-center rounded-xl', first && !item.over ? 'bg-navy-deep text-white' : 'bg-off-white text-navy-deep')}>
        <span className={cn('font-label text-label font-bold uppercase', item.over ? 'text-slate' : 'text-rose')}>{format.dateTime(starts, { month: 'short', timeZone: DOUALA })}</span>
        <span className="font-heading text-h4 leading-6 font-extrabold">{format.dateTime(starts, { day: '2-digit', timeZone: DOUALA })}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 sm:gap-1">
        <h3 className="text-body font-bold text-navy-deep">
          {/* Phone: the whole card opens it. */}
          <Link href={href} className="after:absolute after:inset-0 after:rounded-3xl sm:hidden">
            {phoneTitle}
          </Link>
          <span className="max-sm:hidden">{title}</span>
        </h3>
        <p className="text-body-sm text-slate max-sm:hidden">{detail}</p>
        <span className={cn('rounded-full px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap sm:hidden', badge.tone)}>{badge.text}</span>
      </div>
      <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap max-sm:hidden', badge.tone)}>{badge.text}</span>
      <ChevronRight aria-hidden={true} className="size-5 shrink-0 text-navy-deep sm:hidden" strokeWidth={2.4} />
      <Link
        href={href}
        className={cn(
          'flex h-11 shrink-0 items-center justify-center rounded-full px-6 font-heading text-body-sm font-bold max-sm:hidden',
          first && !item.over ? 'bg-navy-deep text-white' : 'border-2 border-navy-deep text-navy-deep',
          PRESS,
        )}
      >
        {cta}
      </Link>
    </article>
  );
}

/** « Pas encore de consultation » (`6 Aucune consultation`), with Stanzy. */
export function NoConsultation(): ReactNode {
  const t = useTranslations('Consultation.space.empty');
  return (
    <section className="flex flex-col items-center gap-6 rounded-3xl border border-fog-light bg-white p-6 text-center md:flex-row md:p-12 md:text-left">
      <span className="flex size-40 shrink-0 items-end justify-center rounded-3xl bg-ice-blue md:size-52">
        <Image src="/stanzy/wave.svg" alt="" width={180} height={200} className="h-36 w-auto md:h-48" />
      </span>
      <div className="flex flex-col gap-4">
        <h2 className="font-heading text-h4 font-extrabold text-navy-deep md:text-h3">{t('title')}</h2>
        <p className="text-body leading-6 text-slate">{t('lead')}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/services/consultation/reserver" className={cn('flex h-12 items-center justify-center rounded-full bg-rouge px-6 font-heading text-body-sm font-bold text-white hover:bg-crimson', PRESS)}>
            {t('book')}
          </Link>
          <Link href="/outils/crs" className={cn('flex h-12 items-center justify-center rounded-full border-2 border-navy-deep px-6 font-heading text-body-sm font-bold text-navy-deep', PRESS)}>
            {t('crs')}
          </Link>
        </div>
      </div>
    </section>
  );
}
