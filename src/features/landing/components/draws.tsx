'use client';

import { Star } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

// Cross-feature on purpose (#49): this home section shows the Tirages the draws
// feature stores, so it reads them through `api.draws` and words them with the
// draws feature's own hook. No component crosses the boundary.
import { useDrawText } from '@/features/draws/hooks/use-draw-text';
import type { DrawSummary } from '@/features/draws/lib/draw-summary';
import type { DrawGroup } from '@/features/draws/lib/draw-type';
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

/**
 * The home « Derniers tirages » section. The latest Tirage leads with its
 * minimum CRS score, then the facts that matter (category, invitations, date,
 * tie-breaking rule), after the inspiration the product owner shared; earlier
 * Tirages show their score first, their type in short on phones.
 */
export function Draws(): ReactNode {
  const t = useTranslations('Home.Draws');
  const tFacts = useTranslations('Home.Draws.facts');
  const tCardStats = useTranslations('Home.Draws.cardStats');
  const format = useFormatter();
  const text = useDrawText();
  // The latest four Tirages IRCC published, as stored by the draws ingestion (#49).
  const latest = api.draws.latest.useQuery({ take: 4 });
  const [featured, ...rest] = latest.data?.draws ?? [];

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
              <span className="font-sans text-xs font-semibold uppercase tracking-widest text-rouge lg:text-label">
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
            {/* Latest Tirage: a light card, so the rouge score reads at full
                contrast. Score on top on phones; score left, facts right on desktop. */}
            <article
              aria-labelledby="draws-latest"
              className="mt-8 rounded-3xl bg-white p-5 text-navy-deep shadow-lg sm:p-7 md:mt-10 lg:grid lg:grid-cols-5 lg:items-center lg:gap-10 lg:p-9"
            >
              <div className="lg:col-span-2">
                <h3 id="draws-latest" className="font-label font-semibold uppercase tracking-widest text-slate">
                  {t('latest')}
                </h3>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1 font-label font-bold uppercase tracking-wider text-rouge">
                    <Star aria-hidden={true} className="size-3 fill-rouge text-rouge" strokeWidth={0} />
                    {t('roundLabel')} #{featured.round}
                  </span>
                  <time
                    dateTime={featured.date}
                    className="rounded-full bg-off-white px-3 py-1 font-label font-semibold text-slate"
                  >
                    {text.date(featured)}
                  </time>
                </div>
                <p className="mt-6 flex flex-col items-center text-center lg:mt-8 lg:items-start lg:text-left">
                  <span className="font-heading text-display font-bold leading-none tracking-tight text-rouge lg:text-8xl">
                    {featured.crsMin}
                  </span>
                  <span className="mt-2 text-body-sm text-slate">{t('scoreLabel')}</span>
                </p>
              </div>

              <dl className="mt-6 grid gap-2.5 border-t border-fog-light pt-6 sm:grid-cols-2 lg:col-span-3 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
                {(
                  [
                    ['category', text.type(featured)],
                    ['invitations', format.number(featured.invitations)],
                    ['date', text.date(featured)],
                    ['tieBreak', text.tieBreak(featured) ?? tFacts('none')],
                  ] as const
                ).map(([fact, value]) => (
                  <div key={fact} className="rounded-xl bg-off-white px-4 py-3">
                    <dt className="font-label font-semibold uppercase tracking-widest text-slate">{tFacts(fact)}</dt>
                    <dd className="mt-1 font-heading text-body font-bold text-navy-deep">{value}</dd>
                  </div>
                ))}
              </dl>
            </article>

            {/* Earlier Tirages: the score first. Phones get a slim row with the
                type in short; wider screens a card with the type in full. */}
            <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              {rest.map(
                (draw: DrawSummary): ReactNode => (
                  <li key={draw.round}>
                    <Link
                      href="/outils/dernier-tirage"
                      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/4 p-4 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/8 md:block md:h-full md:px-6 md:py-5.5"
                    >
                      {/* Wider screens — head / score / type / invitations. */}
                      <div className="hidden md:block">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-heading text-base font-semibold text-white">
                            {t('roundLabel')} #{draw.round}
                          </h3>
                          <time dateTime={draw.date} className="text-xs text-white/50">
                            {text.date(draw)}
                          </time>
                        </div>
                        <p className="mt-4 flex items-baseline gap-2">
                          <span className="font-heading text-h2 font-bold leading-none text-white">{draw.crsMin}</span>
                          <span className="text-xs text-white/55">{tCardStats('crsMin')}</span>
                        </p>
                        <span
                          className={
                            'mt-3 inline-block rounded-full border px-2.25 py-1 font-sans text-label font-semibold ' +
                            categoryClasses(draw.group)
                          }
                        >
                          {text.type(draw)}
                        </span>
                        <p className="mt-4 border-t border-white/8 pt-3.5 text-sm text-white/70">
                          {format.number(draw.invitations)} {tCardStats('invitations')}
                        </p>
                      </div>

                      {/* Phones — the score where the thumbnail would be. */}
                      <span
                        aria-hidden={true}
                        className="flex size-16 shrink-0 flex-col items-center justify-center rounded-xl bg-white/8 md:hidden"
                      >
                        <span className="font-heading text-xl font-bold leading-none text-white">{draw.crsMin}</span>
                        <span className="mt-1 text-label text-white/55">CRS</span>
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1 md:hidden">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              'inline-flex h-5 w-fit items-center rounded-full border px-2 font-sans text-label font-semibold uppercase tracking-wider ' +
                              categoryClasses(draw.group)
                            }
                          >
                            {text.shortType(draw)}
                          </span>
                          <span className="text-xs text-white/50">
                            {t('roundLabel')} #{draw.round}
                          </span>
                        </div>
                        <p className="truncate font-heading text-sm font-semibold text-white transition-colors group-hover:text-rose">
                          {format.number(draw.invitations)} {tCardStats('invitations')}
                        </p>
                        <p className="text-xs text-white/50">{text.date(draw)}</p>
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
