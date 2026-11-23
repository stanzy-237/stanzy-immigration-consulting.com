'use client';

import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Reveal } from '@/components/ui/reveal';
import { TOPICS } from '@/features/consultation/data/topics';
import { LABEL_CLASS, PRESS, SECTION_TITLE_CLASS } from '@/features/consultation/lib/styles';
import { cn } from '@/lib/utils';

/**
 * « Ce qu'on aborde »: the four topics as tabs (a list on desktop, pills that
 * scroll on mobile) and the chosen one's preview from a sample profile.
 * Switching is instant: the motion spec gives this section no animation.
 */
export function ConsultationTopics(): ReactNode {
  const t = useTranslations('Consultation.page.topics');
  const [active, setActive] = useState(0);
  const topic = TOPICS[active]!;
  const number = (index: number) => String(index + 1).padStart(2, '0');

  return (
    <section aria-labelledby="consultation-topics" className="bg-white px-5 py-14 md:px-7 lg:py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-x-16 lg:gap-y-8">
        <Reveal className="flex flex-col gap-2.5 lg:col-start-1 lg:gap-4">
          <h2 id="consultation-topics" className={SECTION_TITLE_CLASS}>
            {t('title')}
          </h2>
          <p className="text-body-sm leading-5 text-slate lg:text-body lg:leading-6">{t('lead')}</p>
        </Reveal>

        <Reveal delay={0.06} className="-mr-5 lg:col-span-2 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mr-0">
          <div role="tablist" aria-label={t('label')} className="flex gap-2 overflow-x-auto pr-5 lg:flex-col lg:gap-1 lg:overflow-visible lg:pr-0">
            {TOPICS.map(({ key }, index) => {
              const selected = index === active;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`consultation-topic-${key}`}
                  aria-selected={selected}
                  aria-controls="consultation-topic-panel"
                  onClick={() => setActive(index)}
                  className={cn(
                    'relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-left',
                    'lg:items-baseline lg:gap-6 lg:rounded-lg lg:px-5 lg:py-6.5',
                    PRESS,
                    'lg:active:scale-100',
                    selected
                      ? 'bg-navy-deep lg:bg-off-white'
                      : 'border border-fog-light lg:rounded-none lg:border-x-0 lg:border-t-0 lg:hover:bg-off-white',
                  )}
                >
                  <span
                    className={cn(
                      'font-heading text-caption font-extrabold lg:w-12 lg:shrink-0 lg:text-body',
                      selected ? 'text-rose lg:text-rouge' : 'text-slate-mute',
                    )}
                  >
                    {number(index)}
                  </span>
                  <span className={cn('text-body-sm font-semibold whitespace-nowrap lg:hidden', selected ? 'text-white' : 'text-slate')}>
                    {t(`${key}.tab`)}
                  </span>
                  <span
                    className={cn(
                      'hidden font-heading text-h4 leading-6 font-bold lg:block lg:w-65 lg:shrink-0',
                      selected ? 'text-ink' : 'text-slate',
                    )}
                  >
                    {t(`${key}.title`)}
                  </span>
                  <span className={cn('hidden flex-1 text-body leading-6 lg:block', selected ? 'text-slate' : 'text-slate-mute')}>
                    {t(`${key}.body`)}
                  </span>
                  {selected ? (
                    <span aria-hidden={true} className="absolute inset-x-5 bottom-0 hidden h-0.5 rounded-full bg-rouge lg:block" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={0.12} className="flex flex-col gap-6 lg:col-start-1 lg:mt-4">
          <div
            role="tabpanel"
            id="consultation-topic-panel"
            aria-labelledby={`consultation-topic-${topic.key}`}
            className="flex h-66 flex-col justify-between overflow-hidden rounded-3xl bg-navy-deep p-6"
          >
            <div className="flex items-center justify-between">
              <p className={cn(LABEL_CLASS, 'text-rose')}>
                {number(active)} · {t(`${topic.key}.preview`)}
              </p>
              <p className="font-label text-caption font-semibold text-fog">
                {t('count', { current: active + 1, total: TOPICS.length })}
              </p>
            </div>
            <ul className="flex flex-col gap-3 lg:gap-3.5">
              {topic.rows.map((row) => (
                <li key={row.key} className="flex flex-col gap-2">
                  <div className="flex justify-between gap-3">
                    <span className="text-body-sm leading-5 font-semibold text-white">{t(`${topic.key}.rows.${row.key}.name`)}</span>
                    <span className="shrink-0 text-caption leading-5 whitespace-nowrap text-fog">{t(`${topic.key}.rows.${row.key}.value`)}</span>
                  </div>
                  <div aria-hidden={true} className="h-1.5 rounded-full bg-white/10">
                    <div className={cn('h-1.5 rounded-full', row.bar)} style={{ width: `${row.percent}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="flex items-center gap-2 border-t border-white/10 pt-3.5 text-caption text-fog">
              <span aria-hidden={true} className="size-1.5 shrink-0 rounded-full bg-rose" />
              {t('example')}
            </p>
          </div>

          {/* Mobile: the chosen topic written out under its preview, with where it stands among the four. */}
          <div className="flex flex-col gap-1.5 lg:hidden">
            <p className="font-heading text-body-lg leading-6 font-bold text-ink">{t(`${topic.key}.title`)}</p>
            <p className="text-body-sm leading-5 text-slate">{t(`${topic.key}.body`)}</p>
            <div aria-hidden={true} className="flex gap-1.5 pt-2.5">
              {TOPICS.map(({ key }, index) => (
                <span key={key} className={cn('h-1 rounded-full', index === active ? 'w-6 bg-rouge' : 'w-2 bg-fog')} />
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
