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
      className="bg-white px-5 py-14 md:px-7 md:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-navy-deep px-3.5 py-1.5">
            <span
              aria-hidden={true}
              className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rouge"
            >
              <Plus className="h-2.5 w-2.5 text-white" strokeWidth={3} />
            </span>
            <span className="font-sans text-xs font-semibold uppercase tracking-widest text-white">
              {t('eyebrow')}
            </span>
          </div>
          <h2
            id="why-stanzy-title"
            className="font-heading text-[clamp(32px,4vw,50px)] font-bold leading-none tracking-tight text-navy-deep"
          >
            {t('title')}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate">
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
                    'flex h-full flex-col rounded-2xl p-7 ' +
                    (featured
                      ? 'bg-navy-deep text-white shadow-[0_12px_32px_rgba(13,31,78,0.18)]'
                      : 'border-2 border-fog-light bg-white text-navy-deep')
                  }
                >
                  <span
                    aria-hidden={true}
                    className={
                      'mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ' +
                      (featured
                        ? 'bg-rouge/18 text-rouge'
                        : 'bg-ice-blue text-navy-deep')
                    }
                  >
                    <Icon className="h-7 w-7" strokeWidth={1.75} />
                  </span>
                  <h3
                    className={
                      'font-heading text-xl font-bold leading-snug ' +
                      (featured ? 'text-white' : 'text-navy-deep')
                    }
                  >
                    {tItems(prop.nameKey)}
                  </h3>
                  <p
                    className={
                      'mt-3 text-sm leading-relaxed ' +
                      (featured ? 'text-white/75' : 'text-slate')
                    }
                  >
                    {tItems(prop.descKey)}
                  </p>
                  {featured && prop.proofKey ? (
                    <div className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-rouge/40 bg-rouge/15 px-3.5 py-1.5">
                      <span
                        aria-hidden={true}
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-rouge"
                      />
                      <span className="font-sans text-xs font-semibold uppercase tracking-widest text-white">
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
