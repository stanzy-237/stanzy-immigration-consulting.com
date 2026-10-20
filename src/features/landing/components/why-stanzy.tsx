import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import {
  VALUE_PROPS,
  type ValueProp,
} from '@/features/landing/data/value-props';

export function WhyStanzy(): ReactNode {
  const t = useTranslations('Home.WhyStanzy');
  const tItems = useTranslations('Home.WhyStanzy.Items');

  return (
    <section
      aria-labelledby="why-stanzy-title"
      className="bg-white px-5 py-14 md:px-7 md:py-[88px]"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-10 max-w-[640px]">
          <div className="mb-[18px] inline-flex items-center gap-2 rounded-full bg-navy-deep px-3.5 py-[6px]">
            <span
              aria-hidden={true}
              className="flex h-[14px] w-[14px] items-center justify-center rounded-full bg-rouge"
            >
              <Plus className="h-2.5 w-2.5 text-white" strokeWidth={3} />
            </span>
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
              {t('eyebrow')}
            </span>
          </div>
          <h2
            id="why-stanzy-title"
            className="font-heading text-[clamp(32px,4vw,50px)] font-bold leading-[1.05] tracking-[-0.03em] text-navy-deep"
          >
            {t('title')}
          </h2>
          <p className="mt-3 text-[15px] leading-[1.6] text-[#4A5568]">
            {t('subtitle')}
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {VALUE_PROPS.map((prop: ValueProp): ReactNode => {
            const Icon = prop.icon;
            const featured = prop.featured === true;
            return (
              <li key={prop.slug}>
                <div
                  className={
                    'flex h-full flex-col rounded-[20px] p-7 ' +
                    (featured
                      ? 'bg-navy-deep text-white shadow-[0_12px_32px_rgba(13,31,78,0.18)]'
                      : 'border-[1.5px] border-[#E2E8F0] bg-white text-navy-deep')
                  }
                >
                  <span
                    aria-hidden={true}
                    className={
                      'mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ' +
                      (featured
                        ? 'bg-rouge/18 text-rouge'
                        : 'bg-[#E8EDF5] text-navy-deep')
                    }
                  >
                    <Icon className="h-7 w-7" strokeWidth={1.75} />
                  </span>
                  <h3
                    className={
                      'font-heading text-[20px] font-bold leading-[1.3] ' +
                      (featured ? 'text-white' : 'text-navy-deep')
                    }
                  >
                    {tItems(prop.nameKey)}
                  </h3>
                  <p
                    className={
                      'mt-3 text-[14px] leading-[1.65] ' +
                      (featured ? 'text-white/75' : 'text-[#4A5568]')
                    }
                  >
                    {tItems(prop.descKey)}
                  </p>
                  {featured && prop.proofKey ? (
                    <div className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-rouge/40 bg-rouge/15 px-3.5 py-[5px]">
                      <span
                        aria-hidden={true}
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-rouge"
                      />
                      <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-white">
                        {tItems(prop.proofKey)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
