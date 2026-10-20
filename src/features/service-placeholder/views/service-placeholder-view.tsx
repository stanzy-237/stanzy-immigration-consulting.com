import { ArrowLeft, Hammer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';

export type ServicePlaceholderProps = {
  nameKey: string;
  icon: LucideIcon;
};

export function ServicePlaceholderView({
  nameKey,
  icon: Icon,
}: ServicePlaceholderProps): ReactNode {
  const t = useTranslations('ServicePlaceholder');
  const tItems = useTranslations('Home.ServicesGrid.Items');

  return (
    <>
      <SiteNav />
      <main>
        <section
          aria-labelledby="service-placeholder-title"
          className="bg-[#F7F8FC] px-7 py-[120px]"
        >
          <div className="mx-auto flex max-w-[640px] flex-col items-center text-center">
            <div className="mb-7 inline-flex items-center gap-[7px] rounded-full border-[1.5px] border-[#EE8A93] bg-[#FCEDEF] px-3.5 py-[5px]">
              <Hammer className="h-3 w-3 text-rouge" strokeWidth={2.5} />
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-rouge">
                {t('status')}
              </span>
            </div>
            <span
              aria-hidden={true}
              className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_8px_28px_rgba(13,31,78,0.12)]"
            >
              <Icon className="h-8 w-8 text-navy-deep" strokeWidth={1.75} />
            </span>
            <h1
              id="service-placeholder-title"
              className="font-heading text-[clamp(30px,4vw,46px)] font-bold leading-[1.08] tracking-[-0.03em] text-navy-deep"
            >
              {tItems(nameKey)}
            </h1>
            <p className="mt-4 max-w-[520px] text-[17px] leading-[1.6] text-[#4A5568]">
              {t('description')}
            </p>
            <Link
              href="/"
              className="mt-10 inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-navy-deep bg-navy-deep px-5 font-heading text-[14px] font-semibold text-white transition-all hover:-translate-y-[1px] hover:border-rouge hover:bg-rouge"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
              {t('back')}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
