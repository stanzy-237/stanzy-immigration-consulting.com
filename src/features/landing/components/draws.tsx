import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { DRAWS, type Draw, type DrawCategoryColor } from '@/features/landing/data/draws';
import { Link } from '@/i18n/navigation';

function categoryClasses(color: DrawCategoryColor): string {
  switch (color) {
    case 'red':
      return 'bg-[#FCEDEF] text-rouge border-[#EE8A93]';
    case 'blue':
      return 'bg-[#E0ECFF] text-[#1E40AF] border-[#A5C4FF]';
    case 'green':
      return 'bg-[#D1FAE5] text-[#065F46] border-[#86EFAC]';
    case 'amber':
      return 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]';
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
      className="bg-[#F7F8FC] px-7 py-[88px]"
    >
      <div className="mx-auto max-w-[1280px]">
        {/* Header */}
        <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="flex-1">
            <div className="mb-[18px] inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#EE8A93] bg-[#FCEDEF] px-3.5 py-[5px]">
              <span
                aria-hidden={true}
                className="h-1 w-[18px] shrink-0 self-center rounded-full bg-rouge"
              />
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-rouge">
                {t('eyebrow')}
              </span>
            </div>
            <h2
              id="draws-title"
              className="font-heading text-[clamp(32px,4vw,50px)] font-bold leading-[1.05] tracking-[-0.03em] text-navy-deep"
            >
              {t('titleLead')}
              <br />
              <span className="text-rouge">{t('titleRest')}</span>
              <span
                aria-label={t('live')}
                className="relative ml-2 inline-block h-2.5 w-2.5 align-middle"
              >
                <span
                  aria-hidden={true}
                  className="absolute inset-0 animate-ping rounded-full bg-rouge opacity-60"
                />
                <span
                  aria-hidden={true}
                  className="absolute inset-0 rounded-full bg-rouge"
                />
              </span>
            </h2>
            <p className="mt-3 max-w-[520px] text-[15px] leading-[1.6] text-[#4A5568]">
              {t('subtitle')}
            </p>
          </div>
          <Link
            href="/outils/crs"
            className="inline-flex h-11 shrink-0 items-center rounded-full border-[1.5px] border-navy-deep bg-navy-deep px-5 font-heading text-[14px] font-semibold text-white transition-all hover:-translate-y-[1px] hover:border-rouge hover:bg-rouge"
          >
            {t('ctaScore')}
          </Link>
        </div>

        {/* Featured draw */}
        <article className="rounded-[20px] border-[1.5px] border-navy-deep bg-white p-7 shadow-[0_8px_28px_rgba(13,31,78,0.08)]">
          <div className="grid gap-6 md:grid-cols-[1fr_1.1fr_1fr]">
            {/* Round + tags */}
            <div className="flex flex-col gap-3">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4A5568]">
                {t('latest')}
              </p>
              <div className="flex items-center gap-2">
                <span className="font-heading text-[clamp(36px,4vw,52px)] font-bold leading-none text-navy-deep">
                  #{featured.round}
                </span>
                <Star
                  className="h-6 w-6 fill-rouge text-rouge"
                  strokeWidth={0}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={
                    'inline-flex h-7 items-center rounded-full border px-3 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] ' +
                    categoryClasses(featured.categoryColor)
                  }
                >
                  {tCat(featured.categoryKey)}
                </span>
                <span className="inline-flex h-7 items-center rounded-full border border-[#CBD5E0] bg-[#F7F8FC] px-3 font-sans text-[11px] font-medium text-[#4A5568]">
                  Score min : {featured.crsMin}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-5 border-y border-[#E2E8F0] py-4 md:border-x md:border-y-0 md:px-6">
              <div className="flex flex-1 flex-col items-start">
                <span className="font-heading text-[26px] font-bold text-navy-deep">
                  {featured.invitations.toLocaleString('fr-FR')}
                </span>
                <span className="text-[12px] text-[#4A5568]">
                  {tStats('invitations')}
                </span>
              </div>
              <span
                aria-hidden={true}
                className="h-10 w-px shrink-0 bg-[#E2E8F0]"
              />
              <div className="flex flex-1 flex-col items-start">
                <span className="font-heading text-[26px] font-bold text-rouge">
                  {featured.crsMin}
                </span>
                <span className="text-[12px] text-[#4A5568]">
                  {tStats('crsMin')}
                </span>
              </div>
              <span
                aria-hidden={true}
                className="h-10 w-px shrink-0 bg-[#E2E8F0]"
              />
              <div className="flex flex-1 flex-col items-start">
                <span className="font-heading text-[26px] font-bold text-navy-deep">
                  {featured.date.split(' ').slice(0, 2).join(' ')}
                </span>
                <span className="text-[12px] text-[#4A5568]">
                  {tStats('date')}
                </span>
              </div>
            </div>

            {/* Tracker */}
            <div className="flex min-w-0 flex-col gap-2">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4A5568]">
                {tTracker('label')}
              </p>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#E8EDF5]">
                <div
                  aria-hidden={true}
                  className="h-full w-[72%] rounded-full bg-[linear-gradient(90deg,#CC1627,#0D1F4E)]"
                />
              </div>
              <p className="text-[12px] text-[#4A5568]">{tTracker('note')}</p>
              <Link
                href="/outils/crs"
                className="mt-auto inline-flex w-fit items-center text-[13px] font-semibold text-rouge hover:underline"
              >
                {tTracker('cta')}
              </Link>
            </div>
          </div>
        </article>

        {/* Secondary draws grid */}
        <ul className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {rest.map(
            (draw: Draw): ReactNode => (
              <li key={draw.round}>
                <Link
                  href="/outils/dernier-tirage"
                  className="group flex h-full flex-col rounded-[20px] border-[1.5px] border-[#E2E8F0] bg-white p-5 no-underline transition-all duration-200 hover:-translate-y-[2px] hover:border-navy-deep hover:shadow-[0_8px_24px_rgba(13,31,78,0.08)]"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-[16px] font-bold text-navy-deep">
                      {t('roundLabel')} #{draw.round}
                    </h3>
                    <time className="text-[12px] text-[#4A5568]">
                      {draw.date}
                    </time>
                  </div>
                  <span
                    className={
                      'mt-3 inline-flex h-7 w-fit items-center rounded-full border px-3 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] ' +
                      categoryClasses(draw.categoryColor)
                    }
                  >
                    {tCat(draw.categoryKey)}
                  </span>
                  <div className="mt-4 flex items-center gap-4 border-t border-[#E2E8F0] pt-4">
                    <div className="flex flex-col">
                      <span className="font-heading text-[22px] font-bold text-navy-deep">
                        {draw.crsMin}
                      </span>
                      <span className="text-[11px] text-[#4A5568]">
                        {tCardStats('crsMin')}
                      </span>
                    </div>
                    <span
                      aria-hidden={true}
                      className="h-8 w-px shrink-0 bg-[#E2E8F0]"
                    />
                    <div className="flex flex-col">
                      <span className="font-heading text-[22px] font-bold text-navy-deep">
                        {draw.invitations.toLocaleString('fr-FR')}
                      </span>
                      <span className="text-[11px] text-[#4A5568]">
                        {tCardStats('invitations')}
                      </span>
                    </div>
                  </div>
                  <span className="mt-4 inline-flex items-center text-[13px] font-semibold text-rouge transition-[gap] group-hover:gap-2">
                    {t('cardCta')}
                  </span>
                </Link>
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}
