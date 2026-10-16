'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Fragment, type ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics';

import { FloatingScoreCard } from '@/features/landing/components/floating-score-card';
import { StatTile } from '@/features/landing/components/stat-tile';
import { HERO_STATS, type HeroStat } from '@/features/landing/data/hero-stats';

const WHATSAPP_HREF: string = 'https://wa.me/message/stanzycanada';
const CONSULTATION_HREF: string = '/services/consultation';
// Pixel-perfect hero image taken from the MagicPath design.
const HERO_IMAGE_SRC: string =
  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200&q=85';

function WhatsAppGlyph(): ReactNode {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="#25D366"
      aria-hidden={true}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function Hero(): ReactNode {
  const t = useTranslations('Home.Hero');
  const tStats = useTranslations('Home.Hero.Stats');

  const handleBook = (): void => {
    track('hero.cta.book');
  };
  const handleWhatsapp = (): void => {
    track('hero.cta.whatsapp');
  };

  return (
    <section aria-label={t('eyebrow')} className="bg-white px-7">
      <div className="mx-auto flex min-h-[620px] max-w-[1280px] items-center gap-[60px] py-[60px] max-lg:flex-col max-lg:items-stretch max-lg:py-12">
        {/* LEFT */}
        <div className="flex basis-[55%] flex-col max-lg:basis-auto">
          {/* Eyebrow pill */}
          <div className="border-[#EE8A93] bg-[#FCEDEF] inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-[5px]">
            <span
              aria-hidden={true}
              className="bg-rouge h-1 w-[18px] shrink-0 rounded-full"
            />
            <span className="text-rouge text-[11px] font-semibold uppercase tracking-[0.13em]">
              {t('eyebrow')}
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-heading text-navy-deep mt-5 text-[clamp(38px,4.5vw,56px)] font-bold leading-[1.05] tracking-[-0.03em]">
            {t('headlineLead')}
            <br />
            {t('headlineRest')}{' '}
            <span className="text-rouge">{t('headlineAccent')}</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-4 max-w-[460px] text-[18px] leading-[1.65] text-[#4A5568]">
            {t('subtitle')}
          </p>

          {/* CTA row */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={CONSULTATION_HREF}
              onClick={handleBook}
              className="bg-rouge hover:bg-[#D93344] inline-flex h-12 items-center gap-2.5 rounded-full pl-6 pr-2.5 font-heading text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(204,22,39,0.28)] transition-all hover:-translate-y-[1px] hover:shadow-[0_6px_20px_rgba(204,22,39,0.38)]"
            >
              {t('ctaBook')}
              <span
                aria-hidden={true}
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-white/[0.22]"
              >
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            </Link>
            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsapp}
              className="border-[#CBD5E0] text-navy-deep hover:border-navy-deep inline-flex h-12 items-center gap-2 rounded-full border-[1.5px] bg-transparent px-[22px] text-[14px] font-semibold transition-all hover:bg-[#F7F8FC]"
            >
              <WhatsAppGlyph />
              {t('ctaWhatsapp')}
            </a>
          </div>

          {/* Stats row with vertical dividers between items */}
          <ul className="mt-12 flex items-center">
            {HERO_STATS.map((s: HeroStat, i: number): ReactNode => (
              <Fragment key={s.key}>
                {i > 0 ? (
                  <li
                    aria-hidden={true}
                    className="mx-0 h-10 w-px shrink-0 bg-[#E2E8F0]"
                  />
                ) : null}
                <li
                  className={
                    i === 0
                      ? 'pr-8'
                      : i === HERO_STATS.length - 1
                        ? 'pl-8'
                        : 'px-8'
                  }
                >
                  <StatTile
                    value={s.value}
                    label={tStats(s.labelKey)}
                    highlight={s.highlight}
                  />
                </li>
              </Fragment>
            ))}
          </ul>
        </div>

        {/* RIGHT */}
        <div className="relative hidden h-[520px] flex-1 overflow-hidden rounded-3xl lg:block">
          <Image
            src={HERO_IMAGE_SRC}
            alt={t('imageAlt')}
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover"
            unoptimized
            priority
          />
          <div
            aria-hidden={true}
            className="absolute inset-0 rounded-3xl bg-gradient-to-t from-navy-deep/30 via-transparent to-transparent"
          />
          <div className="absolute bottom-6 right-6 z-10">
            <FloatingScoreCard />
          </div>
        </div>
      </div>
    </section>
  );
}
