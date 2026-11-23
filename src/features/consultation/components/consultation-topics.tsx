'use client';

import { AnimatePresence, motion, useInView, useReducedMotion, type Variants } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef, useState, type ReactNode } from 'react';

import { EASE_OUT, Reveal } from '@/components/ui/reveal';
import { TOPICS } from '@/features/consultation/data/topics';
import { EASE_OUT_EXPO, LABEL_CLASS, PRESS, SECTION_TITLE_CLASS } from '@/features/consultation/lib/styles';
import { cn } from '@/lib/utils';

/** The active marker slides with no overshoot. */
const SLIDE = { type: 'spring', duration: 0.25, bounce: 0 } as const;

/** The preview crossfades with a small shift in the direction of travel, blurred so both states read as one. */
const previewVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: 8 * direction, filter: 'blur(2px)' }),
  shown: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.2, ease: EASE_OUT } },
  leave: (direction: number) => ({ opacity: 0, x: -8 * direction, filter: 'blur(2px)', transition: { duration: 0.15, ease: EASE_OUT } }),
};

const number = (index: number) => String(index + 1).padStart(2, '0');

/**
 * « Ce qu'on aborde »: the four topics as tabs (a list on desktop, pills that
 * scroll on mobile) and the chosen one's preview from a sample profile. The
 * topics move on every 6 s, shown by a filling line, while the section is in
 * view and not hovered or focused; picking one stops that for good. Motion:
 * docs/design/consultation-motion.md, rows « Ce qu'on aborde ».
 */
export function ConsultationTopics(): ReactNode {
  const t = useTranslations('Consultation.page.topics');
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { amount: 0.4 });
  const [[active, direction], setShown] = useState<[number, number]>([0, 1]);
  const [picked, setPicked] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const advancing = !picked && !reduceMotion;
  const running = advancing && inView && !hovered && !focused;
  const topic = TOPICS[active]!;

  const pick = (index: number) => {
    setPicked(true);
    setShown([index, index >= active ? 1 : -1]);
  };

  const advance = () => {
    const next = (active + 1) % TOPICS.length;
    setShown([next, 1]);
    // Mobile: bring the next pill into the strip's view, without moving the page.
    const list = listRef.current;
    const tab = list?.children[next] as HTMLElement | undefined;
    if (list && tab && list.scrollWidth > list.clientWidth) {
      list.scrollTo({ left: tab.offsetLeft - list.offsetLeft, behavior: 'smooth' });
    }
  };

  /** The line that fills while a topic is shown; when it ends, the next topic comes. */
  const progress = (className: string) =>
    advancing ? (
      <span
        key={active}
        data-testid="topic-progress"
        aria-hidden={true}
        onAnimationEnd={advance}
        className={cn('absolute inset-0 origin-left animate-topic-progress rounded-full bg-rouge', className)}
        style={{ animationPlayState: running ? 'running' : 'paused' }}
      />
    ) : null;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="consultation-topics"
      onPointerEnter={(event) => event.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      className="bg-white px-5 py-14 md:px-7 lg:py-24"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-x-16 lg:gap-y-8">
        <Reveal className="flex flex-col gap-2.5 lg:col-start-1 lg:gap-4">
          <h2 id="consultation-topics" className={SECTION_TITLE_CLASS}>
            {t('title')}
          </h2>
          <p className="text-body-sm leading-5 text-slate lg:text-body lg:leading-6">{t('lead')}</p>
        </Reveal>

        <Reveal delay={0.06} className="-mr-5 lg:col-span-2 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mr-0">
          <div
            ref={listRef}
            role="tablist"
            aria-label={t('label')}
            className="relative flex gap-2 overflow-x-auto pr-5 lg:flex-col lg:gap-1 lg:overflow-visible lg:pr-0"
          >
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
                  onClick={() => pick(index)}
                  className={cn(
                    'relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-left',
                    'lg:items-baseline lg:gap-6 lg:rounded-lg lg:px-5 lg:py-6.5',
                    PRESS,
                    'lg:active:scale-100',
                    selected ? 'border border-transparent' : 'border border-fog-light lg:rounded-none lg:border-x-0 lg:border-t-0 lg:hover:bg-off-white',
                  )}
                >
                  {selected ? (
                    <>
                      {/* Mobile: the navy pill slides to the chosen topic. */}
                      <motion.span
                        layoutId="consultation-topic-pill"
                        transition={SLIDE}
                        aria-hidden={true}
                        className="absolute -inset-px bg-navy-deep lg:hidden"
                        style={{ borderRadius: 9999 }}
                      />
                      {/* Desktop: the row's tint and its rouge line slide to the chosen topic. */}
                      <motion.span
                        layoutId="consultation-topic-row"
                        transition={SLIDE}
                        aria-hidden={true}
                        className="absolute -inset-px hidden bg-off-white lg:block"
                        style={{ borderRadius: 8 }}
                      >
                        <span className="absolute inset-x-5 bottom-0 h-0.5 overflow-hidden rounded-full bg-fog-light">
                          {advancing ? progress('') : <span className="absolute inset-0 rounded-full bg-rouge" />}
                        </span>
                      </motion.span>
                    </>
                  ) : null}
                  <span
                    className={cn(
                      'relative font-heading text-caption font-extrabold transition-colors duration-200 ease-standard lg:w-12 lg:shrink-0 lg:text-body',
                      selected ? 'text-rose lg:text-rouge' : 'text-slate-mute',
                    )}
                  >
                    {number(index)}
                  </span>
                  <span
                    className={cn(
                      'relative text-body-sm font-semibold whitespace-nowrap transition-colors duration-200 ease-standard lg:hidden',
                      selected ? 'text-white' : 'text-slate',
                    )}
                  >
                    {t(`${key}.tab`)}
                  </span>
                  <span
                    className={cn(
                      'relative hidden font-heading text-h4 leading-6 font-bold transition-colors duration-200 ease-standard lg:block lg:w-65 lg:shrink-0',
                      selected ? 'text-ink' : 'text-slate',
                    )}
                  >
                    {t(`${key}.title`)}
                  </span>
                  <span
                    className={cn(
                      'relative hidden flex-1 text-body leading-6 transition-colors duration-200 ease-standard lg:block',
                      selected ? 'text-slate' : 'text-slate-mute',
                    )}
                  >
                    {t(`${key}.body`)}
                  </span>
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
            className="relative h-66 overflow-hidden rounded-3xl bg-navy-deep"
          >
            <AnimatePresence mode="popLayout" custom={direction}>
              <motion.div
                key={topic.key}
                custom={direction}
                variants={previewVariants}
                initial="enter"
                animate="shown"
                exit="leave"
                className="flex h-full flex-col justify-between p-6"
              >
                <div className="flex items-center justify-between">
                  <p className={cn(LABEL_CLASS, 'text-rose')}>
                    {number(active)} · {t(`${topic.key}.preview`)}
                  </p>
                  <p className="font-label text-caption font-semibold text-fog">{t('count', { current: active + 1, total: TOPICS.length })}</p>
                </div>
                <ul className="flex flex-col gap-3 lg:gap-3.5">
                  {topic.rows.map((row, index) => (
                    <li key={row.key} className="flex flex-col gap-2">
                      <div className="flex justify-between gap-3">
                        <span className="text-body-sm leading-5 font-semibold text-white">{t(`${topic.key}.rows.${row.key}.name`)}</span>
                        <span className="shrink-0 text-caption leading-5 whitespace-nowrap text-fog">
                          {t(`${topic.key}.rows.${row.key}.value`)}
                        </span>
                      </div>
                      <div aria-hidden={true} className="h-1.5 rounded-full bg-white/10">
                        <motion.div
                          className={cn('h-1.5 origin-left rounded-full', row.bar)}
                          style={{ width: `${row.percent}%` }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 0.4, ease: EASE_OUT_EXPO, delay: 0.1 + index * 0.04 }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="flex items-center gap-2 border-t border-white/10 pt-3.5 text-caption text-fog">
                  <span aria-hidden={true} className="size-1.5 shrink-0 rounded-full bg-rose" />
                  {t('example')}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mobile: the chosen topic written out under its preview, with where it stands among the four. */}
          <div className="flex flex-col gap-1.5 lg:hidden">
            <p className="font-heading text-body-lg leading-6 font-bold text-ink">{t(`${topic.key}.title`)}</p>
            <p className="text-body-sm leading-5 text-slate">{t(`${topic.key}.body`)}</p>
            <div aria-hidden={true} className="flex gap-1.5 pt-2.5">
              {TOPICS.map(({ key }, index) => (
                <motion.span
                  key={key}
                  layout
                  transition={SLIDE}
                  className={cn('relative h-1 overflow-hidden', index === active ? 'w-6 bg-fog' : 'w-2 bg-fog')}
                  style={{ borderRadius: 9999 }}
                >
                  {index === active ? (advancing ? progress('') : <span className="absolute inset-0 bg-rouge" />) : null}
                </motion.span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
