import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { DRAWS, type Draw, type DrawCategoryColor } from '@/features/landing/data/draws';
import { Link } from '@/i18n/navigation';

// Category pill palette for the dark navy section. Each entry picks a
// translucent fill + border that reads on #0D1F4E, matching the MagicPath
// design (`.sn-draws-tag.*` and `.sn-draws-category.*`).
function categoryClasses(color: DrawCategoryColor): string {
  switch (color) {
    case 'red':
      return 'bg-rouge/20 border-rouge/40 text-rose';
    case 'blue':
      return 'bg-blue-500/20 border-blue-500/40 text-blue-300';
    case 'green':
      return 'bg-green-500/18 border-green-500/35 text-green-300';
    case 'amber':
      return 'bg-amber-500/18 border-amber-500/35 text-amber-300';
  }
}

export function Draws(): ReactNode {
  const t = useTranslations('Home.Draws');
  const tStats = useTranslations('Home.Draws.stats');
  const tTracker = useTranslations('Home.Draws.tracker');
  const tCardStats = useTranslations('Home.Draws.cardStats');
  const tCat = useTranslations('Home.Draws.cat');

  const featured = DRAWS.find((d: Draw): boolean => d.featured === true);
  const rest = DRAWS.filter((d: Draw): boolean => d.featured !== true);
  if (!featured) {
    return null;
  }

  return (
    <section
      aria-labelledby="draws-title"
      className="bg-navy-deep px-5 py-14 md:px-7 md:py-24 text-white"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="flex-1">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rouge/35 bg-rouge/15 px-3.5 py-1.5">
              <span
                aria-hidden={true}
                className="h-1 w-4 shrink-0 self-center rounded-full bg-rouge"
              />
              <span className="font-sans text-xs font-semibold uppercase tracking-widest text-rouge">
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
                className="relative ml-2 inline-block h-2 w-2 align-middle"
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

        {/* Featured draw — stacks on mobile with wrapping stats + tracker. */}
        <article className="mt-8 rounded-2xl border border-white/12 bg-white/6 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.18)] backdrop-blur-md md:mt-10 md:rounded-2xl md:p-8">
          <div className="grid gap-6 md:grid-cols-[1fr_1.1fr_1fr] md:items-center md:gap-8">
            {/* Round + tags */}
            <div className="flex flex-col gap-2.5">
              <p className="font-sans text-[10px] font-semibold uppercase tracking-widest text-white/40">
                {t('latest')}
              </p>
              <div className="flex items-start gap-1.5 font-heading text-5xl font-bold leading-none text-white sm:text-6xl md:text-[clamp(48px,5vw,72px)]">
                #{featured.round}
                <Star
                  className="mt-1 h-4 w-4 fill-rouge text-rouge"
                  strokeWidth={0}
                />
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <span
                  className={
                    'inline-flex h-7 items-center rounded-full border px-2.5 font-sans text-xs font-semibold uppercase tracking-wider ' +
                    categoryClasses(featured.categoryColor)
                  }
                >
                  {tCat(featured.categoryKey)}
                </span>
                <span className="inline-flex h-7 items-center rounded-full border border-white/15 bg-white/10 px-2.5 font-sans text-xs font-medium text-white">
                  Score min : {featured.crsMin}
                </span>
              </div>
            </div>

            {/* Stats — 3-up grid on mobile with hairline separators between. */}
            <div className="grid grid-cols-3 items-start gap-3 border-y border-white/10 py-4 md:border-x md:border-y-0 md:gap-6 md:px-6 md:py-0">
              <div className="flex flex-col gap-1">
                <span className="font-heading text-xl font-bold leading-none text-white sm:text-2xl md:text-[clamp(28px,2.8vw,36px)]">
                  {featured.invitations.toLocaleString('fr-FR')}
                </span>
                <span className="text-xs text-white/55 md:text-sm">
                  {tStats('invitations')}
                </span>
              </div>
              <div className="flex flex-col gap-1 border-x border-white/10 px-3 md:border-0 md:px-0">
                <span className="font-heading text-xl font-bold leading-none text-rouge sm:text-2xl md:text-[clamp(28px,2.8vw,36px)]">
                  {featured.crsMin}
                </span>
                <span className="text-xs text-white/55 md:text-sm">
                  {tStats('crsMin')}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-heading text-lg font-bold leading-none text-white sm:text-xl md:text-[clamp(28px,2.8vw,36px)]">
                  {featured.date.split(' ').slice(0, 2).join(' ')}
                </span>
                <span className="text-xs text-white/55 md:text-sm">
                  {tStats('date')}
                </span>
              </div>
            </div>

            {/* Tracker */}
            <div className="flex min-w-0 flex-col gap-2">
              <p className="font-sans text-[10px] font-semibold uppercase tracking-widest text-white/40">
                {tTracker('label')}
              </p>
              <div className="relative h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                <div
                  aria-hidden={true}
                  className="h-full w-[72%] rounded-full bg-[linear-gradient(90deg,#CC1627,#EE8A93)]"
                />
              </div>
              <p className="text-xs text-white/50">{tTracker('note')}</p>
              <Link
                href="/outils/crs"
                className="mt-1 inline-flex w-fit items-center text-sm font-semibold text-rouge hover:underline"
              >
                {tTracker('cta')}
              </Link>
            </div>
          </div>
        </article>

        {/* Past draws — thin horizontal cards, same rhythm as the small blog cards. */}
        <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          {rest.map(
            (draw: Draw): ReactNode => (
              <li key={draw.round}>
                <Link
                  href="/outils/dernier-tirage"
                  className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/4 p-4 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/8"
                >
                  {/* Left thumbnail — round-number badge in the slot where the
                      blog small card has its image. */}
                  <span
                    aria-hidden={true}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/8 font-heading text-base font-bold text-white"
                  >
                    #{draw.round}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span
                      className={
                        'inline-flex h-5 w-fit items-center rounded-full border px-2 font-sans text-[9px] font-semibold uppercase tracking-wider ' +
                        categoryClasses(draw.categoryColor)
                      }
                    >
                      {tCat(draw.categoryKey)}
                    </span>
                    <p className="truncate font-heading text-sm font-semibold text-white transition-colors group-hover:text-rouge">
                      {draw.crsMin} {tCardStats('crsMin')} ·{' '}
                      {draw.invitations.toLocaleString('fr-FR')}{' '}
                      {tCardStats('invitations')}
                    </p>
                    <p className="text-xs text-white/40">{draw.date}</p>
                  </div>
                </Link>
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}
