'use client';

import { motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Reveal } from '@/components/ui/reveal';
import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { cn } from '@/lib/utils';

type Note = { time: string; chapter: string; text: string; short: string };

/** `mm:ss` as seconds. */
const seconds = (time: string) => {
  const [m = 0, s = 0] = time.split(':').map(Number);
  return m * 60 + s;
};

/**
 * « Un aperçu de votre récap »: what a Client finds in Mon espace once the
 * recap is published, to try (docs/design/consultation-motion.md, row « Demo »).
 * Tapping a moment moves the progress bar there at once and tints its note;
 * ticking a step draws its check, then strikes it through. Nothing is saved:
 * it is an example, and says so.
 */
export function RecapPreview(): ReactNode {
  const t = useTranslations('Consultation.page.recap');
  const notes = t.raw('notes') as Note[];
  const steps = t.raw('steps') as string[];
  const features = t.raw('features') as string[];
  const tabs = t.raw('tabs') as string[];
  const [current, setCurrent] = useState(1);
  const [done, setDone] = useState<boolean[]>(() => steps.map((_, index) => index === 0));
  const note = notes[current] ?? notes[0]!;
  const at = seconds(note.time) / seconds(t('length'));
  const toggle = (index: number) => setDone((all) => all.map((d, i) => (i === index ? !d : d)));

  return (
    <section aria-labelledby="consultation-recap" className="bg-ice-blue px-5 py-14 md:px-7 lg:py-24">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-center lg:gap-16">
        <Reveal className="flex flex-col gap-2 lg:w-100 lg:shrink-0 lg:gap-4">
          <p className={cn(LABEL_CLASS, 'text-rouge')}>{t('eyebrow')}</p>
          <h2 id="consultation-recap" className="font-heading text-h3 leading-8 font-extrabold tracking-tight text-ink lg:text-h2 lg:leading-11">
            {t('title')}
          </h2>
          <p className="text-body-sm leading-5.5 text-slate lg:text-body lg:leading-6">
            <span className="lg:hidden">{t('leadShort')}</span>
            <span className="hidden lg:inline">{t('lead')}</span>
          </p>
          <ul className="hidden flex-col gap-3 pt-2 lg:flex">
            {features.map((feature, index) => (
              <li key={feature} className="flex items-center gap-3 text-body-sm leading-5.5 text-ink">
                <span aria-hidden={true} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white">
                  <FeatureIcon index={index} />
                </span>
                {feature}
              </li>
            ))}
          </ul>
          <p className="hidden pt-1 text-caption leading-4.5 text-slate lg:block">{t('readOnly')}</p>
        </Reveal>

        <Reveal
          delay={0.06}
          role="group"
          aria-label={t('demo')}
          className="relative flex flex-col gap-3 overflow-hidden rounded-3xl bg-off-white pb-4 shadow-xl shadow-navy-deep/15 lg:flex-1 lg:gap-4 lg:overflow-visible lg:bg-white lg:px-5 lg:pt-5 lg:pb-6"
        >
          {/* The video: Stanzy behind the play button, the bar at the moment shown. */}
          <div className="flex flex-col overflow-hidden bg-navy-deep lg:rounded-3xl">
            <div aria-hidden={true} className="relative flex h-44 items-center justify-center overflow-hidden lg:h-75">
              <div className="absolute inset-0 hidden lg:block">
                <div className="absolute -bottom-65 left-65 size-130 -translate-x-1/2 rounded-full bg-navy-80" />
                <Image
                  unoptimized={true}
                  src="/stanzy/idle.svg"
                  alt=""
                  width={190}
                  height={332}
                  className="absolute bottom-0 left-37.5 h-83 w-47.5 translate-y-51.5"
                />
              </div>
              <span className="relative flex size-15 items-center justify-center rounded-full bg-rouge lg:size-19">
                <svg viewBox="0 0 24 24" className="size-5.5 lg:size-6.5">
                  <path d="M8 5v14l11-7z" className="fill-white" />
                </svg>
              </span>
            </div>
            <div className="flex flex-col gap-1.5 px-3.5 pb-3 lg:gap-2.5 lg:px-5.5 lg:pt-4 lg:pb-4.5">
              <div aria-hidden={true} className="relative h-1 rounded-xs bg-navy-80 lg:h-1.5">
                {/* Seeking is instant: the bar jumps, it does not slide. */}
                <div className="absolute inset-0 origin-left rounded-xs bg-rouge" style={{ transform: `scaleX(${at})` }} />
                {notes.map((n) => (
                  <span
                    key={n.time}
                    className="absolute -top-0.75 hidden h-3 w-0.75 rounded-xs bg-white lg:block"
                    style={{ left: `${(seconds(n.time) / seconds(t('length'))) * 100}%` }}
                  />
                ))}
              </div>
              <p className="flex justify-between text-caption leading-4 text-ice-blue lg:leading-4.5">
                <span aria-live="polite">{t('position', { time: note.time, chapter: note.chapter })}</span>
                <span>{t('length')}</span>
              </p>
            </div>
          </div>

          {/* Desktop: the recap's tabs, as Mon espace shows them; the notes are open. */}
          <div aria-hidden={true} className="hidden gap-7 border-b border-fog-light lg:flex">
            {tabs.map((tab, index) => (
              <span
                key={tab}
                className={cn(
                  'pb-3 text-body-sm leading-5',
                  index === 0 ? '-mb-px border-b-2 border-rouge font-bold text-ink' : 'font-medium text-slate',
                )}
              >
                {tab}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-3 px-3.5 pt-1 lg:px-0 lg:pt-0">
            <p className={cn(LABEL_CLASS, 'hidden text-caption leading-4 text-slate lg:block')}>{t('seen')}</p>
            <ul className="flex flex-col gap-3">
              {notes.map((n, index) => {
                const active = index === current;
                return (
                  // Mobile shows the first two moments.
                  <li key={n.time} className={cn(index > 1 && 'hidden lg:block')}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      aria-label={`${t('seek', { time: n.time })} · ${n.text}`}
                      onClick={() => setCurrent(index)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-lg py-1.5 text-left transition-colors duration-150 ease-standard lg:-ml-2 lg:gap-3.5 lg:px-2',
                        active ? 'bg-blush' : 'bg-transparent hover:bg-white/60 lg:hover:bg-off-white',
                      )}
                    >
                      <span className="flex w-12.5 shrink-0 justify-center rounded-md bg-ice-blue py-0.75 font-label text-caption leading-4 font-bold text-ink lg:w-13.5">
                        {n.time}
                      </span>
                      <span className="text-body-sm leading-5 text-ink lg:leading-5.5">
                        <span className="lg:hidden">{n.short}</span>
                        <span className="hidden lg:inline">{n.text}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <StepsCard steps={steps} done={done} onToggle={toggle} />

          <span className="absolute top-3.5 left-3.5 flex -rotate-3 items-center gap-1.5 rounded-full bg-white px-2.5 py-1.25 shadow-md lg:top-9 lg:left-9 lg:px-3 lg:py-1.5">
            <span aria-hidden={true} className="size-1.5 shrink-0 rounded-full bg-rouge" />
            <span className={cn(LABEL_CLASS, 'font-extrabold text-ink')}>{t('example')}</span>
          </span>
        </Reveal>
        <p className="text-caption leading-4.5 text-slate lg:hidden">{t('readOnly')}</p>
      </div>
    </section>
  );
}

/** The next steps to tick: under the notes on mobile; a card tilted over the demo's edge on desktop. */
function StepsCard({ steps, done, onToggle }: { steps: string[]; done: boolean[]; onToggle: (index: number) => void }): ReactNode {
  const t = useTranslations('Consultation.page.recap');
  const count = done.filter(Boolean).length;
  return (
    <div className="flex flex-col gap-3 px-3.5 lg:absolute lg:top-52.5 lg:-right-9 lg:w-85 lg:rotate-2 lg:rounded-3xl lg:border lg:border-fog-light lg:bg-white lg:p-6 lg:shadow-xl lg:shadow-navy-deep/20">
      <p className={cn(LABEL_CLASS, 'pt-1.5 text-caption leading-4 text-slate lg:hidden')} aria-live="polite">
        {t('stepsCount', { done: count, total: steps.length })}
      </p>
      <p className="hidden font-heading text-h4 leading-6.5 font-bold text-ink lg:block">{t('stepsTitle')}</p>
      <ul className="flex flex-col rounded-xl border border-fog-light bg-white lg:gap-3 lg:rounded-none lg:border-0 lg:bg-transparent">
        {steps.map((step, index) => (
          <li key={step} className="border-b border-fog-light last:border-b-0 lg:border-0">
            <StepRow label={step} checked={done[index] ?? false} onToggle={() => onToggle(index)} />
          </li>
        ))}
      </ul>
      <p className="hidden text-caption leading-4.5 text-slate lg:block">{t('stepsNote')}</p>
    </div>
  );
}

/** A step: pressing it scales to 0.97; its check draws (200 ms), the strike-through follows 150 ms later. */
function StepRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }): ReactNode {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn('flex h-12 w-full items-center gap-3 px-3.5 text-left lg:h-auto lg:items-start lg:px-0', PRESS)}
    >
      <span
        aria-hidden={true}
        className={cn(
          'flex size-5.5 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-150 ease-standard',
          checked ? 'border-leaf bg-leaf' : 'border-navy-deep bg-white',
        )}
      >
        <svg viewBox="0 0 24 24" className="size-3.5">
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            className="stroke-white"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : 0.2, ease: 'easeOut' }}
          />
        </svg>
      </span>
      <span
        className={cn(
          'text-body-sm leading-4.5 line-through transition-colors duration-150 ease-standard lg:leading-5.5',
          checked ? 'text-slate-mute decoration-slate-mute delay-150' : 'text-ink decoration-transparent',
        )}
      >
        {label}
      </span>
    </button>
  );
}

function FeatureIcon({ index }: { index: number }): ReactNode {
  if (index === 0) {
    return (
      <svg viewBox="0 0 24 24" className="size-4">
        <path d="M8 5v14l11-7z" className="fill-rouge" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg viewBox="0 0 24 24" className="size-4">
        <path d="M5 7h14M5 12h10M5 17h12" fill="none" className="stroke-navy-deep" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" className="stroke-leaf" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
