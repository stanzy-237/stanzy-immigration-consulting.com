import { ArrowUpRight, CircleCheck, MessageCircle, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { FswCalculator } from '@/features/fsw/components/fsw-calculator';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { WHATSAPP_CHANNEL_URL } from '@/features/shared/data/links';
import { Link } from '@/i18n/navigation';

/** The Calculateur 67 points page: header, calculator and "À savoir" band. */
export function FswView(): ReactNode {
  const t = useTranslations('Fsw');
  return (
    <>
      <SiteNav />
      <main className="bg-off-white">
        <header className="border-b border-fog bg-white">
          <div className="mx-auto max-w-6xl px-5 pb-12 pt-14 sm:px-8 lg:pb-16 lg:pt-20">
            <p className="mb-5 font-label text-rouge">{t('eyebrow')}</p>
            <h1 className="font-heading text-h2 font-bold leading-tight text-navy-deep sm:text-h1">
              {t('title')} <span className="text-rouge">{t('titleAccent')}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-body-lg text-slate">{t('lead')}</p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-blush px-3 py-2 text-body-sm font-semibold text-rouge">
                <ShieldCheck aria-hidden={true} className="size-4" />
                {t('threshold')}
              </span>
              <span className="text-body-sm text-steel-blue">{t('notCrs')}</span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
          <FswCalculator />
        </div>

        <section aria-labelledby="fsw-guide-title" className="border-t border-fog bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <p className="font-label text-rouge">{t('guide.eyebrow')}</p>
              <h2 id="fsw-guide-title" className="mt-3 font-heading text-h3 font-bold text-navy-deep">
                {t('guide.title')}
              </h2>
              <p className="mt-4 text-body text-slate">{t('guide.text')}</p>
              <p className="mt-6 text-body font-semibold text-navy-deep">{t('guide.needsIntro')}</p>
              <ul className="mt-3 space-y-3">
                {(['experience', 'funds'] as const).map((need) => (
                  <li key={need} className="flex items-start gap-3 text-body text-slate">
                    <CircleCheck aria-hidden={true} className="mt-0.5 size-5 shrink-0 text-rouge" />
                    <span>{t(`guide.needs.${need}`)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-body text-navy-deep">{t('guide.support')}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/services"
                  className="rounded-full bg-rouge px-5 py-2.5 text-body-sm font-semibold text-white transition-colors hover:bg-crimson"
                >
                  {t('guide.consultation')}
                </Link>
                <Link
                  href="/outils/crs"
                  className="rounded-full border border-fog px-5 py-2.5 text-body-sm font-semibold text-navy-deep transition-colors hover:bg-ice-blue"
                >
                  {t('guide.crs')}
                </Link>
                <a
                  href={t('guide.fundsUrl')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-body-sm font-semibold text-steel-blue underline-offset-2 hover:underline"
                >
                  {t('guide.fundsLink')}
                  <ArrowUpRight aria-hidden={true} className="size-4" />
                </a>
              </div>
            </div>

            <aside className="rounded-2xl bg-navy-deep p-6 text-white shadow-lg lg:col-span-2 lg:self-start">
              <MessageCircle aria-hidden={true} className="size-8 text-whatsapp" />
              <h3 className="mt-4 font-heading text-h4 font-bold">{t('guide.whatsappTitle')}</h3>
              <p className="mt-2 text-body-sm text-white/80">{t('guide.whatsappText')}</p>
              <a
                href={WHATSAPP_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-whatsapp px-5 py-2.5 text-body-sm font-semibold text-navy-deep transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {t('guide.whatsappCta')}
                <ArrowUpRight aria-hidden={true} className="size-4" />
              </a>
            </aside>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
