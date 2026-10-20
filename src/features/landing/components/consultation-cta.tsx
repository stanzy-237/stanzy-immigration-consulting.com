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
      className="bg-white px-7 py-[88px]"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="relative grid overflow-hidden rounded-[28px] bg-navy-deep shadow-[0_18px_48px_rgba(13,31,78,0.18)] lg:grid-cols-2">
          {/* Left */}
          <div className="relative z-10 flex flex-col justify-center px-8 py-12 lg:px-14 lg:py-16">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3.5 py-[5px]">
              <span
                aria-hidden={true}
                className="h-1 w-[18px] shrink-0 rounded-full bg-rouge"
              />
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                {t('eyebrow')}
              </span>
            </div>
            <h2
              id="consultation-cta-title"
              className="font-heading text-[clamp(34px,4vw,52px)] font-bold leading-[1.05] tracking-[-0.03em] text-white"
            >
              {t('titleLead')}
              <br />
              <span className="text-rouge">{t('titleAccent')}</span>
            </h2>
            <p className="mt-4 max-w-[480px] text-[16px] leading-[1.6] text-white/75">
              {t('description')}
            </p>
            <Link
              href="/services/consultation"
              onClick={handleBook}
              className="mt-7 inline-flex h-12 w-fit items-center gap-3 rounded-full bg-rouge pl-6 pr-2.5 font-heading text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(204,22,39,0.35)] transition-all hover:-translate-y-[1px] hover:bg-[#D93344]"
            >
              {t('ctaBook')}
              <span
                aria-hidden={true}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/22"
              >
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </span>
            </Link>
            <p className="mt-5 text-[13px] text-white/60">{t('note')}</p>
          </div>

          {/* Right (image + badge) */}
          <div className="relative hidden min-h-[420px] lg:block">
            <Image
              src={CONSULT_IMAGE_SRC}
              alt={t('imageAlt')}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
              unoptimized
            />
            <div
              aria-hidden={true}
              className="absolute inset-0 bg-gradient-to-l from-transparent via-navy-deep/15 to-navy-deep/80"
            />
            <div className="absolute bottom-7 right-7 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
              <p className="font-heading text-[18px] font-bold text-white">
                {tBadge('title')}
              </p>
              <p className="mt-1 text-[13px] text-white/80">
                {tBadge('sub')}
              </p>
              <div className="mt-3 flex items-center gap-[-10px]">
                <span className="h-7 w-7 shrink-0 rounded-full border-2 border-white bg-[linear-gradient(135deg,#CC1627,#0D1F4E)]" />
                <span className="-ml-2 h-7 w-7 shrink-0 rounded-full border-2 border-white bg-[linear-gradient(135deg,#0D1F4E,#CC1627)]" />
                <span className="-ml-2 h-7 w-7 shrink-0 rounded-full border-2 border-white bg-[linear-gradient(135deg,#CC1627,#F59E0B)]" />
                <span className="ml-2 text-[12px] font-semibold text-white/90">
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
