import { ArrowRight, FileCheck2, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ConsultationCta } from '@/features/landing/components/consultation-cta';
import { ServicesGrid } from '@/features/landing/components/services-grid';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';

/**
 * `/services`: every service as on the home page, the Services documentaires
 * (their prices stay in « Mon espace », for Clients in Cameroon), and the
 * consultation for those who don't know where to start.
 */
export function ServicesView(): ReactNode {
  const t = useTranslations('Home.ServicesPage');
  return (
    <>
      <SiteNav />
      <main>
        <ServicesGrid heading="h1" />
        <section aria-labelledby="services-documents" className="bg-white px-5 pb-14 md:px-7 md:pb-24">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-3xl bg-navy-deep p-8 text-white md:flex-row md:items-center md:p-10">
            <span aria-hidden={true} className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <FileCheck2 className="size-7 text-rose" />
            </span>
            <div className="flex-1">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest text-rose uppercase">
                <MapPin aria-hidden={true} className="size-3.5" />
                🇨🇲 Cameroun
              </p>
              <h2 id="services-documents" className="mt-2 font-heading text-2xl font-bold">
                {t('documentsTitle')}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ice-blue">{t('documentsBody')}</p>
            </div>
            <Link
              href="/mon-espace/services"
              className="inline-flex h-12 shrink-0 items-center gap-2 self-start rounded-full bg-white px-6 font-heading text-base font-bold text-navy-deep transition-all hover:bg-ice-blue active:scale-97 md:self-center"
            >
              {t('documentsCta')}
              <ArrowRight aria-hidden={true} className="size-4" />
            </Link>
          </div>
        </section>
        <ConsultationCta />
      </main>
      <SiteFooter />
    </>
  );
}
