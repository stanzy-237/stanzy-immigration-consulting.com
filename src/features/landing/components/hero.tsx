'use client';

import { CalendarCheck, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics';

import { FloatingScoreCard } from '@/features/landing/components/floating-score-card';
import { StatTile } from '@/features/landing/components/stat-tile';
import { HERO_STATS, type HeroStat } from '@/features/landing/data/hero-stats';

const WHATSAPP_HREF = 'https://wa.me/message/stanzycanada';
const CONSULTATION_HREF = '/services/consultation';

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
    <section
      aria-label={t('eyebrow')}
      className="bg-surface relative overflow-hidden"
    >
      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 py-16 md:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-24">
        <div className="flex flex-col gap-8">
          <span className="bg-rouge/10 text-rouge inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            <span aria-hidden={true} className="bg-rouge h-0.5 w-5" />
            {t('eyebrow')}
          </span>

          <h1 className="font-heading text-navy-deep text-5xl font-bold leading-[1.05] md:text-6xl">
            {t('headlineLead')}{' '}
            <span className="text-rouge">{t('headlineAccent')}</span>
          </h1>

          <p className="text-navy-deep/70 max-w-xl text-lg leading-relaxed">
            {t('subtitle')}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={CONSULTATION_HREF}
              onClick={handleBook}
              className="bg-rouge inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rouge/90"
            >
              <CalendarCheck aria-hidden={true} className="h-4 w-4" />
              {t('ctaBook')}
            </Link>
            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsapp}
              className="border-navy-deep/15 text-navy-deep hover:bg-navy-deep/5 inline-flex items-center gap-2 rounded-md border px-5 py-3 text-sm font-semibold transition-colors"
            >
              <MessageCircle aria-hidden={true} className="h-4 w-4" />
              {t('ctaWhatsapp')}
            </a>
          </div>

          <ul className="grid grid-cols-3 gap-3 pt-2 max-w-md">
            {HERO_STATS.map(
              (s: HeroStat): ReactNode => (
                <li key={s.key}>
                  <StatTile value={s.value} label={tStats(s.labelKey)} />
                </li>
              ),
            )}
          </ul>
        </div>

        <div className="relative hidden lg:block">
          <div
            aria-label={t('imageAlt')}
            role="img"
            className="bg-navy-deep absolute inset-0 rounded-3xl bg-gradient-to-br from-navy-deep via-navy-80 to-rouge/40 shadow-xl"
          />
          <div className="absolute -left-10 bottom-10 z-10">
            <FloatingScoreCard />
          </div>
        </div>
      </div>
    </section>
  );
}
