'use client';

import { ArrowRight, CalendarDays, FolderOpen } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Fragment, useEffect, useState, type ReactNode } from 'react';

import { EASE_OUT } from '@/components/ui/reveal';
import { WORKFLOWS } from '@/features/dossiers/data/workflows';
import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1517090504586-fde19ea6066f?w=1200&q=85';
const STATS = [
  { key: 'stages', value: '10' },
  { key: 'days', value: '60', highlight: true },
  { key: 'online', value: '1' },
] as const;

/**
 * The Accompagnement page's opening, built like the home page's hero: the
 * eyebrow pill, the headline with its rouge accent, the two buttons, the
 * proof row, and the photo with a floating card, here a Dossier moving
 * through its stages, the story the page then tells.
 */
export function AccompagnementHero(): ReactNode {
  const t = useTranslations('Accompagnement.page');
  const enter = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: EASE_OUT, delay },
  });

  return (
    <section aria-labelledby="accompagnement-title" className="bg-white px-5 md:px-7">
      <div className="mx-auto flex max-w-7xl items-center gap-16 py-16 max-lg:flex-col max-lg:items-stretch max-lg:py-12">
        <div className="flex flex-col lg:basis-1/2">
          <motion.div
            {...enter(0)}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-rose bg-blush px-3.5 py-1.5"
          >
            <span aria-hidden={true} className="h-1 w-4 shrink-0 rounded-full bg-rouge" />
            <span className="text-xs font-semibold tracking-widest text-rouge uppercase">{t('hero.eyebrow')}</span>
          </motion.div>

          <motion.h1
            id="accompagnement-title"
            {...enter(0.06)}
            className="mt-5 font-heading text-[clamp(38px,4.5vw,56px)] leading-none font-bold tracking-tight text-navy-deep"
          >
            {t('hero.headlineLead')}
            <br />
            {t('hero.headlineRest')} <span className="text-rouge">{t('hero.headlineAccent')}</span>
          </motion.h1>

          <motion.p {...enter(0.12)} className="mt-4 max-w-md text-lg leading-relaxed text-slate">
            {t('hero.subtitle')}
          </motion.p>

          <motion.div {...enter(0.18)} className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/mon-espace/accompagnement"
              onClick={() => track('accompagnement.apply', { from: 'hero' })}
              className="inline-flex h-12 items-center gap-2.5 rounded-full bg-rouge pr-2.5 pl-6 font-heading text-base font-bold text-white shadow-lg shadow-rouge/30 transition-all hover:-translate-y-px hover:bg-crimson active:scale-97"
            >
              {t('apply')}
              <span aria-hidden={true} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20">
                <ArrowRight className="size-3.5" strokeWidth={2.5} />
              </span>
            </Link>
            <Link
              href="/services/consultation"
              className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-fog bg-transparent px-5 text-sm font-semibold text-navy-deep transition-all hover:border-navy-deep hover:bg-off-white active:scale-97"
            >
              <CalendarDays aria-hidden={true} className="size-4" />
              {t('consult')}
            </Link>
          </motion.div>

          <motion.ul {...enter(0.24)} className="mt-12 flex items-center">
            {STATS.map((stat, index) => (
              <Fragment key={stat.key}>
                {index > 0 ? <li aria-hidden={true} className="h-10 w-px shrink-0 bg-fog-light" /> : null}
                <li className={index === 0 ? 'pr-6 sm:pr-8' : index === STATS.length - 1 ? 'pl-6 sm:pl-8' : 'px-6 sm:px-8'}>
                  <p className={`font-heading text-3xl leading-none font-bold ${'highlight' in stat ? 'text-rouge' : 'text-navy-deep'}`}>
                    {stat.value}
                  </p>
                  <p className="mt-1 max-w-28 text-xs text-slate">{t(`hero.stats.${stat.key}`)}</p>
                </li>
              </Fragment>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }}
          className="relative h-96 flex-1 overflow-hidden rounded-3xl sm:h-130"
        >
          <Image
            src={HERO_IMAGE}
            alt={t('heroImageAlt')}
            fill
            priority
            unoptimized
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover"
          />
          <div aria-hidden={true} className="absolute inset-0 bg-linear-to-t from-navy-deep/30 via-transparent to-transparent" />
          <div className="absolute right-4 bottom-4 left-4 sm:right-6 sm:bottom-6 sm:left-auto">
            <DossierCard />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/** A Dossier walking its 10 stages, one every few seconds: the page's story in one card. */
function DossierCard(): ReactNode {
  const t = useTranslations('Accompagnement.page.hero.card');
  const stages = useTranslations('Dossiers.stages.ACCOMPAGNEMENT');
  const reduce = useReducedMotion();
  const path = WORKFLOWS.ACCOMPAGNEMENT;
  const [index, setIndex] = useState(3);

  useEffect(() => {
    if (reduce) return;
    const tick = setInterval(() => setIndex((current) => (current + 1) % path.length), 2600);
    return () => clearInterval(tick);
  }, [reduce, path.length]);

  return (
    <motion.div
      animate={reduce ? undefined : { y: [0, -6, 0] }}
      transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
      className="rounded-2xl bg-white px-5 py-4 shadow-xl sm:w-72"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate uppercase">
          <FolderOpen aria-hidden={true} className="size-3.5" />
          {t('tag')}
        </span>
        <span className="rounded-full bg-blush px-2 py-0.5 text-xs font-semibold text-rouge tabular-nums">
          {t('step', { current: index + 1, total: path.length })}
        </span>
      </div>
      <div className="relative mt-2 h-11 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={path[index]}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="font-heading text-base leading-tight font-bold text-navy-deep"
          >
            {stages(path[index]!)}
          </motion.p>
        </AnimatePresence>
      </div>
      <div aria-hidden={true} className="mt-2 flex gap-1">
        {path.map((stage, stageIndex) => (
          <span key={stage} className="h-1.5 flex-1 overflow-hidden rounded-full bg-ice-blue">
            <motion.span
              className="block h-full origin-left rounded-full bg-rouge"
              initial={false}
              animate={{ scaleX: stageIndex <= index ? 1 : 0 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
            />
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate">
        {t('next')} : {stages(path[(index + 1) % path.length]!)}
      </p>
    </motion.div>
  );
}
