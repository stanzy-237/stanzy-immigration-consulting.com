import { ArrowUpRight, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import {
  SERVICES,
  type Service,
  type ServiceTag,
} from '@/features/landing/data/services';

export function ServicesGrid(): ReactNode {
  const t = useTranslations('Home.ServicesGrid');
  const tItems = useTranslations('Home.ServicesGrid.Items');
  const tTags = useTranslations('Home.ServicesGrid.Tags');

  return (
    <section
      aria-labelledby="services-grid-title"
      className="bg-white px-5 py-14 md:px-7 md:py-[88px]"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-12 max-w-[640px]">
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
            id="services-grid-title"
            className="font-heading text-[clamp(32px,4vw,50px)] font-bold leading-[1.05] tracking-[-0.03em] text-navy-deep"
          >
            {t('titleLead')}
            <br />
            <span className="text-rouge">{t('titleAccent')}</span>
          </h2>
          <p className="mt-3 text-[15px] leading-[1.6] text-[#4A5568]">
            {t('subtitle')}
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {SERVICES.map((service: Service): ReactNode => {
            const Icon = service.icon;
            const name = tItems(service.nameKey);
            const external = service.external === true;
            const linkProps = external
              ? ({
                  href: service.href,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                } as const)
              : null;
            const content = (
              <>
                {external && service.externalLabelKey ? (
                  <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full border border-[#CBD5E0] bg-[#F7F8FC] px-2 py-[3px] font-sans text-[10px] font-semibold text-[#4A5568]">
                    <ExternalLink className="h-3 w-3" strokeWidth={2} />
                    {tItems(service.externalLabelKey)}
                  </span>
                ) : (
                  <span
                    aria-hidden={true}
                    className="absolute right-[22px] top-[22px] flex h-[34px] w-[34px] scale-[0.6] -rotate-45 items-center justify-center rounded-full bg-navy-deep opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:rotate-0 group-hover:bg-rouge group-hover:opacity-100"
                  >
                    <ArrowUpRight
                      className="h-4 w-4 text-white"
                      strokeWidth={2.5}
                    />
                  </span>
                )}
                <span
                  aria-hidden={true}
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8EDF5] text-navy-deep transition-colors duration-200 group-hover:bg-navy-deep group-hover:text-white"
                >
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <h3 className="font-heading text-[18px] font-bold leading-[1.3] text-navy-deep">
                  {name}
                </h3>
                <p className="mt-2.5 flex-1 text-[14px] leading-[1.65] text-[#4A5568]">
                  {tItems(service.descKey)}
                </p>
                <ul className="mt-5 flex flex-wrap items-center gap-1.5">
                  {service.tags.map((tag: ServiceTag): ReactNode => (
                    <li
                      key={tag.labelKey}
                      className={
                        'inline-flex h-[26px] items-center gap-[5px] rounded-full px-2.5 font-sans text-[11px] font-semibold ' +
                        (tag.variant === 'regional'
                          ? 'border border-[#EE8A93] bg-[#FCEDEF] text-rouge'
                          : 'border border-[#CBD5E0] bg-[#E8EDF5] text-navy-deep')
                      }
                    >
                      <span
                        aria-hidden={true}
                        className="h-[5px] w-[5px] shrink-0 rounded-full bg-rouge"
                      />
                      {tTags(tag.labelKey)}
                    </li>
                  ))}
                </ul>
              </>
            );
            const baseClass =
              'group relative flex h-full flex-col overflow-hidden rounded-[20px] border-[1.5px] border-[#E2E8F0] bg-white p-7 no-underline transition-all duration-200 hover:-translate-y-1 hover:border-navy-deep hover:shadow-[0_12px_36px_rgba(13,31,78,0.1)]';
            return (
              <li key={service.slug}>
                {linkProps ? (
                  <a
                    {...linkProps}
                    aria-label={t('cardAriaLabel', { name })}
                    className={baseClass}
                  >
                    {content}
                  </a>
                ) : (
                  <Link
                    href={service.href}
                    aria-label={t('cardAriaLabel', { name })}
                    className={baseClass}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
