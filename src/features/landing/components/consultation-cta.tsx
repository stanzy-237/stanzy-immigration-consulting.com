'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics';

const CONSULT_IMAGE_SRC =
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=85';

export function ConsultationCta(): ReactNode {
  const t = useTranslations('Home.ConsultationCta');
  const tBadge = useTranslations('Home.ConsultationCta.badge');

  const handleBook = (): void => {
    track('consultation.cta');
  };

  return (
    <section
      aria-labelledby="consultation-cta-title"
      className="bg-[#F7F8FC] px-5 py-14 md:px-7 md:py-[72px]"
    >
      <div className="mx-auto max-w-[1280px]">
        {/* Card: 1fr + 420px columns on lg, stacked below.
            White bg, soft shadow, 1.5px border, 24px radius — matches
            `.sn-consult-card` in the MagicPath design. */}
        <div className="grid overflow-hidden rounded-3xl border-[1.5px] border-[#E2E8F0] bg-white shadow-[0_4px_32px_rgba(13,31,78,0.09)] lg:grid-cols-[1fr_420px]">
          {/* Left — copy + CTA. On mobile: tighter padding, smaller CTA, centered note. */}
          <div className="flex flex-col justify-center px-5 py-7 md:px-14 md:py-14">
            <div className="mb-4 inline-flex w-fit items-center gap-2">
              <span
                aria-hidden={true}
                className="h-1 w-5 shrink-0 rounded-full bg-rouge"
              />
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.15em] text-rouge">
                {t('eyebrow')}
              </span>
            </div>
            <h2
              id="consultation-cta-title"
              className="font-heading text-[clamp(26px,3.5vw,44px)] font-bold leading-[1.08] tracking-[-0.03em] text-navy-deep"
            >
              {t('titleLead')}
              <br />
              <span className="text-rouge">{t('titleAccent')}</span>
            </h2>
            <p className="mt-3 max-w-[440px] text-[15px] leading-[1.6] text-[#4A5568] md:text-[16px] md:leading-[1.65]">
              {t('description')}
            </p>
            <Link
              href="/services/consultation"
              onClick={handleBook}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-rouge px-5 font-heading text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(204,22,39,0.28)] transition-all hover:-translate-y-[2px] hover:bg-[#D93344] hover:shadow-[0_8px_24px_rgba(204,22,39,0.38)] sm:w-fit sm:gap-2.5 sm:pl-[26px] sm:pr-2.5 md:h-[52px] md:text-[15px]"
            >
              {t('ctaBook')}
              <span
                aria-hidden={true}
                className="hidden h-[30px] w-[30px] items-center justify-center rounded-full bg-white/22 sm:flex md:h-[34px] md:w-[34px]"
              >
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </span>
            </Link>
            <p className="mt-3 text-center text-[11px] leading-[1.5] text-[#4A5568] md:mt-3.5 md:text-left md:text-[13px]">
              {t('note')}
            </p>
          </div>

          {/* Right — 420px image column with soft gradient bg behind + badge */}
          <div className="relative min-h-[260px] overflow-hidden bg-[linear-gradient(135deg,#E8EDF5_0%,#FCEDEF_100%)] lg:min-h-full">
            <Image
              src={CONSULT_IMAGE_SRC}
              alt={t('imageAlt')}
              fill
              sizes="(min-width: 1024px) 420px, 100vw"
              className="object-cover object-top"
              unoptimized
            />
            <div
              aria-hidden={true}
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.15)_0%,transparent_40%)]"
            />
            {/* Badge */}
            <div className="absolute bottom-6 left-6 flex flex-col gap-1 rounded-xl bg-white/92 px-4 py-3 shadow-[0_4px_20px_rgba(13,31,78,0.15)] backdrop-blur-md">
              <p className="font-heading text-[13px] font-bold text-navy-deep">
                {tBadge('title')}
              </p>
              <p className="text-[11px] text-[#4A5568]">{tBadge('sub')}</p>
              <div className="mt-1.5 flex items-center">
                <span className="h-[22px] w-[22px] rounded-full border-2 border-white bg-[linear-gradient(135deg,#0D1F4E,#CC1627)]" />
                <span className="-ml-2 h-[22px] w-[22px] rounded-full border-2 border-white bg-[linear-gradient(135deg,#CC1627,#D93344)]" />
                <span className="-ml-2 h-[22px] w-[22px] rounded-full border-2 border-white bg-[linear-gradient(135deg,#6B88B5,#0D1F4E)]" />
                <span className="ml-1.5 self-center font-sans text-[10px] font-semibold text-[#4A5568]">
                  {tBadge('more')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
