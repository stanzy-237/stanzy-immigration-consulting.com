'use client';

import { Star } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { drawTypeKey } from '@/features/draws/lib/draw-type';
import type { DrawGroup } from '@/features/draws/lib/normalize-ircc-rounds';
import type { DrawSummary } from '@/features/draws/server/draws-router';
import { Link } from '@/i18n/navigation';
import { api } from '@/trpc/react';

// Category pill palette for the dark navy section. Each entry picks a
// translucent fill + border that reads on #0D1F4E, matching the MagicPath
// design (`.sn-draws-tag.*` and `.sn-draws-category.*`).
function categoryClasses(group: DrawGroup): string {
  switch (group) {
    case 'FRENCH':
      return 'bg-rouge/20 border-rouge/40 text-rose';
    case 'PNP':
      return 'bg-blue-500/20 border-blue-500/40 text-blue-300';
    case 'CEC':
      return 'bg-green-500/18 border-green-500/35 text-green-300';
    case 'CATEGORY':
      return 'bg-amber-500/18 border-amber-500/35 text-amber-300';
    case 'GENERAL':
      return 'bg-white/10 border-white/20 text-white';
  }
}

// Desktop (lg+) values below are lifted 1:1 from the MagicPath design
// (`.sn-draws-featured`, `.sn-draws-stat*`, `.sn-draws-card*`); everything
// without an `lg:` prefix is the mobile/tablet layout and must stay as is.
export function Draws(): ReactNode {
  const t = useTranslations('Home.Draws');
  const tStats = useTranslations('Home.Draws.stats');
  const tTracker = useTranslations('Home.Draws.tracker');
  const tCardStats = useTranslations('Home.Draws.cardStats');
  const tTypes = useTranslations('Draws.types');
  const locale = useLocale();
  const format = useFormatter();
  // The latest four Tirages IRCC published, as stored by the draws ingestion (#49).
  const latest = api.draws.latest.useQuery({ take: 4 });
  const [featured, ...rest] = latest.data?.draws ?? [];

  const category = (draw: DrawSummary): string => {
    const key = locale === 'fr' ? drawTypeKey(draw.typeLabel) : null;
    return key && tTypes.has(key) ? tTypes(key) : draw.typeLabel;
  };
  const day = (draw: DrawSummary, withYear = true): string =>
    format.dateTime(new Date(`${draw.date}T12:00:00Z`), {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    });

  return (
    <section
      aria-labelledby="draws-title"
      className="bg-navy-deep px-5 py-14 md:px-7 md:py-24 lg:py-22 text-white"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end lg:gap-8">
          <div className="flex-1">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rouge/35 bg-rouge/15 px-3.5 py-1.5 lg:mb-4.5 lg:gap-1.75 lg:py-1.25">
              <span
                aria-hidden={true}
                className="h-1 w-4 shrink-0 self-center rounded-full bg-rouge lg:hidden"
              />
              <span className="font-sans text-xs font-semibold uppercase tracking-widest text-rouge lg:text-label lg:tracking-widest">
                {t('eyebrow')}
              </span>
            </div>
            <h2
              id="draws-title"
              className="font-heading text-[clamp(32px,4vw,48px)] font-bold leading-none tracking-tight text-white"
            >
              {t('titleLead')}
              <br />
              {t('titleRest')}
              <span
                aria-label={t('live')}
                className="relative ml-2 inline-block h-2 w-2 align-middle lg:ml-0 lg:mr-0.5"
              >
                <span
                  aria-hidden={true}
                  className="absolute inset-0 animate-ping rounded-full bg-green-500 opacity-70"
                />
                <span
                  aria-hidden={true}
                  className="absolute inset-0 rounded-full bg-green-500"
                />
              </span>
              .
            </h2>
            <p className="mt-3 max-w-lg text-base leading-normal text-white/60">
              {t('subtitle')}
            </p>
          </div>
          <Link
            href="/outils/dernier-tirage"
            className="inline-flex h-11 shrink-0 items-center rounded-full bg-rouge px-5 font-heading text-sm font-bold text-white transition-colors hover:bg-crimson"
          >
            {t('ctaScore')}
          </Link>
        </div>

        {featured && (
          <>
            {/* Featured draw — stacks on mobile with wrapping stats + tracker;
                on desktop a single row: round | stats | tracker. */}
            <article className="mt-8 rounded-2xl border border-white/12 bg-white/6 p-5 shadow-lg backdrop-blur-md md:mt-10 md:rounded-2xl md:p-8 lg:rounded-2xl lg:px-9 lg:py-8 lg:shadow-none">
              <div className="grid gap-6 md:grid-cols-3 md:items-center md:gap-8 lg:flex lg:items-center lg:justify-between lg:gap-8">
                {/* Round + tags */}
                <div className="flex flex-col gap-2.5 lg:gap-0">
                  <p className="font-sans text-label font-semibold uppercase tracking-widest text-white/40 lg:tracking-widest">
                    {t('latest')}
                  </p>
                  <div className="flex items-start gap-1.5 font-heading text-5xl font-bold leading-none text-white sm:text-6xl md:text-[clamp(48px,5vw,72px)] lg:mt-2 lg:gap-0 lg:text-display">
                    #{featured.round}
                    <Star
                      className="mt-1 h-4 w-4 fill-rouge text-rouge lg:ml-1.25 lg:mt-0.75 lg:h-4.5 lg:w-4.5"
                      strokeWidth={0}
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 lg:mt-3.5 lg:gap-1.75">
                    <span
                      className={
                        'inline-flex h-7 items-center rounded-full border px-2.5 font-sans text-xs font-semibold uppercase tracking-wider lg:h-auto lg:py-1.25 lg:text-label lg:normal-case lg:tracking-normal ' +
                        categoryClasses(featured.group)
                      }
                    >
                      {category(featured)}
                    </span>
                    <span className="inline-flex h-7 items-center rounded-full border border-white/15 bg-white/10 px-2.5 font-sans text-xs font-medium text-white lg:h-auto lg:py-1.25 lg:text-label lg:font-semibold">
                      Score min<span className="hidden lg:inline">imum</span>
                      <span className="lg:hidden">&nbsp;</span>: {featured.crsMin}
                    </span>
                  </div>
                </div>

                {/* Stats — 3-up grid on mobile with hairline separators between;
                    flex row with 48px dividers on desktop. */}
                <div className="grid grid-cols-3 items-start gap-3 border-y border-white/10 py-4 md:border-x md:border-y-0 md:gap-6 md:px-6 md:py-0 lg:flex lg:items-center lg:gap-7 lg:border-0 lg:p-0">
                  <div className="flex flex-col gap-1 lg:min-w-25">
                    <span className="font-heading text-xl font-bold leading-none text-white sm:text-2xl md:text-[clamp(28px,2.8vw,36px)] lg:text-4xl">
                      {format.number(featured.invitations)}
                    </span>
                    <span className="text-xs text-white/55 md:text-sm lg:text-sm">
                      {tStats('invitations')}
                    </span>
                  </div>
                  <span aria-hidden={true} className="hidden h-12 w-px bg-white/10 lg:block" />
                  <div className="flex flex-col gap-1 border-x border-white/10 px-3 md:border-0 md:px-0 lg:min-w-25">
                    <span className="font-heading text-xl font-bold leading-none text-rouge sm:text-2xl md:text-[clamp(28px,2.8vw,36px)] lg:text-4xl">
                      {featured.crsMin}
                    </span>
                    <span className="text-xs text-white/55 md:text-sm lg:text-sm">
                      {tStats('crsMin')}
                    </span>
                  </div>
                  <span aria-hidden={true} className="hidden h-12 w-px bg-white/10 lg:block" />
                  <div className="flex flex-col gap-1 lg:min-w-25">
                    <span className="font-heading text-lg font-bold leading-none text-white sm:text-xl md:text-[clamp(28px,2.8vw,36px)] lg:text-4xl">
                      {day(featured, false)}
                    </span>
                    <span className="text-xs text-white/55 md:text-sm lg:text-sm">
                      {tStats('date')}
                    </span>
                  </div>
                </div>

                {/* Tracker */}
                <div className="flex min-w-0 flex-col gap-2 lg:min-w-50 lg:gap-0">
                  <p className="font-sans text-label font-semibold uppercase tracking-widest text-white/40 lg:tracking-widest">
                    {tTracker('label')}
                  </p>
                  <div className="relative h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10 lg:mt-2.5 lg:w-50">
                    <div
                      aria-hidden={true}
                      className="h-full w-18/25 rounded-full bg-linear-to-r from-rouge to-rose"
                    />
                  </div>
                  <p className="text-xs text-white/50 lg:mt-2">{tTracker('note')}</p>
                  <Link
                    href="/outils/crs"
                    className="mt-1 inline-flex w-fit items-center text-sm font-semibold text-rouge hover:underline lg:mt-3 lg:text-sm"
                  >
                    {tTracker('cta')}
                  </Link>
                </div>
              </div>
            </article>

            {/* Past draws — thin horizontal cards on mobile (same rhythm as the
                small blog cards); full stat cards on desktop. */}
            <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              {rest.map(
                (draw: DrawSummary): ReactNode => (
                  <li key={draw.round}>
                    <Link
                      href="/outils/dernier-tirage"
                      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/4 p-4 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/8 lg:block lg:h-full lg:border-white/9 lg:px-6 lg:py-5.5 lg:hover:border-white/18"
                    >
                      {/* Desktop card — head / category / stats / foot. */}
                      <div className="hidden lg:block">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-heading text-base font-semibold text-white">
                            {t('roundLabel')} #{draw.round}
                          </h3>
                          <time dateTime={draw.date} className="text-xs text-white/40">{day(draw)}</time>
                        </div>
                        <span
                          className={
                            'mt-4 inline-block rounded-full border px-2.25 py-1 font-sans text-label font-semibold ' +
                            categoryClasses(draw.group)
                          }
                        >
                          {category(draw)}
                        </span>
                        <div className="mt-5 flex items-center gap-5">
                          <div className="flex flex-col gap-0.75">
                            <span className="font-heading text-h3 font-bold leading-none text-white">
                              {draw.crsMin}
                            </span>
                            <span className="text-label text-white/50">
                              {tCardStats('crsMin')}
                            </span>
                          </div>
                          <span aria-hidden={true} className="h-8.5 w-px bg-white/10" />
                          <div className="flex flex-col gap-0.75">
                            <span className="font-heading text-h3 font-bold leading-none text-white">
                              {format.number(draw.invitations)}
                            </span>
                            <span className="text-label text-white/50">
                              {tCardStats('invitations')}
                            </span>
                          </div>
                        </div>
                        <p className="mt-5 border-t border-white/8 pt-3.5 text-xs text-white/40">
                          {t('cardCta')}
                        </p>
                      </div>

                      {/* Left thumbnail — round-number badge in the slot where the
                          blog small card has its image. */}
                      <span
                        aria-hidden={true}
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/8 font-heading text-base font-bold text-white lg:hidden"
                      >
                        #{draw.round}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1 lg:hidden">
                        <span
                          className={
                            'inline-flex h-5 w-fit items-center rounded-full border px-2 font-sans text-label font-semibold uppercase tracking-wider ' +
                            categoryClasses(draw.group)
                          }
                        >
                          {category(draw)}
                        </span>
                        <p className="truncate font-heading text-sm font-semibold text-white transition-colors group-hover:text-rouge">
                          {draw.crsMin} {tCardStats('crsMin')} ·{' '}
                          {format.number(draw.invitations)}{' '}
                          {tCardStats('invitations')}
                        </p>
                        <p className="text-xs text-white/40">{day(draw)}</p>
                      </div>
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
