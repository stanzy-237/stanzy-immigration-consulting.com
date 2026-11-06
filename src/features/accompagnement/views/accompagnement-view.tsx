'use client';

import {
  ArrowRight,
  CalendarDays,
  FileSignature,
  FolderOpen,
  Gauge,
  HandHelping,
  MessagesSquare,
  Timer,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { ReactNode } from 'react';

import { Reveal } from '@/components/ui/reveal';
import { AccompagnementHero } from '@/features/accompagnement/components/accompagnement-hero';
import { ApplyLink } from '@/features/accompagnement/components/apply-link';
import { HowItWorks } from '@/features/accompagnement/components/how-it-works';
import { StoryStages } from '@/features/accompagnement/components/story-stages';
import { LEVELS, startStageOf } from '@/features/accompagnement/lib/interest-schema';
import { WORKFLOWS } from '@/features/dossiers/data/workflows';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';

const CTA_IMAGE = 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&q=80';

const FEATURES: { key: string; icon: LucideIcon }[] = [
  { key: 'dossier', icon: FolderOpen },
  { key: 'crs', icon: Gauge },
  { key: 'ita', icon: Timer },
  { key: 'messages', icon: MessagesSquare },
  { key: 'meetings', icon: Video },
  { key: 'contract', icon: FileSignature },
];

const applyClass =
  'inline-flex h-12 items-center gap-2.5 rounded-full bg-rouge pr-2.5 pl-6 font-heading text-base font-bold text-white shadow-lg shadow-rouge/30 transition-all hover:-translate-y-px hover:bg-crimson active:scale-97';

/** The home page's section heading: the eyebrow pill, then the title. */
function Heading({ id, eyebrow, title, lead }: { id: string; eyebrow: string; title: string; lead?: string }): ReactNode {
  return (
    <Reveal className="mb-12 max-w-2xl">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-rose bg-blush px-3.5 py-1.5">
        <span aria-hidden={true} className="h-1 w-4 shrink-0 rounded-full bg-rouge" />
        <span className="text-xs font-semibold tracking-widest text-rouge uppercase">{eyebrow}</span>
      </div>
      <h2 id={id} className="font-heading text-[clamp(30px,3.6vw,46px)] leading-none font-bold tracking-tight text-navy-deep">
        {title}
      </h2>
      {lead ? <p className="mt-3 text-base leading-relaxed text-slate">{lead}</p> : null}
    </Reveal>
  );
}

/**
 * Accompagnement Entrée Express (#81), told as a story: where the reader
 * starts (their Niveau), the 10 stages drawn as they scroll, what goes with
 * them, how it begins (four animated scenes), and the last chapter, the
 * COPR. Motion follows the reader's « reduce motion » setting.
 */
export function AccompagnementView(): ReactNode {
  const t = useTranslations('Accompagnement.page');
  const stages = useTranslations('Dossiers.stages.ACCOMPAGNEMENT');
  const path = WORKFLOWS.ACCOMPAGNEMENT;

  return (
    <MotionConfig reducedMotion="user">
      <SiteNav />
      <main className="overflow-hidden bg-off-white">
        <AccompagnementHero />

        {/* Chapter 1: where you start */}
        <section aria-labelledby="accompagnement-levels" className="bg-white px-5 pb-20 md:px-7">
          <div className="mx-auto max-w-7xl border-t border-fog-light pt-20">
            <Heading id="accompagnement-levels" eyebrow={t('chapters.one')} title={t('storyLevelsTitle')} lead={t('levelsLead')} />
            <ul className="grid gap-5 md:grid-cols-3">
              {LEVELS.map((level, index) => {
                const start = path.indexOf(startStageOf(level, false));
                return (
                  <li key={level}>
                    <Reveal
                      delay={index * 0.08}
                      className="relative h-full overflow-hidden rounded-3xl border-2 border-fog-light bg-white p-7 transition-colors hover:border-navy-deep"
                    >
                      <span aria-hidden={true} className="absolute -top-6 -right-2 font-heading text-9xl font-bold text-navy-deep/5">
                        {level}
                      </span>
                      <h3 className="relative font-heading text-xl font-bold text-navy-deep">{t(`levels.${level}.title`)}</h3>
                      <p className="relative mt-2 text-sm leading-relaxed text-slate">{t(`levels.${level}.body`)}</p>
                      <div aria-hidden={true} className="relative mt-6 flex gap-1">
                        {path.map((stage, stageIndex) => (
                          <span
                            key={stage}
                            className={`h-2 flex-1 rounded-full ${stageIndex < start ? 'bg-fog' : stageIndex === start ? 'bg-rouge' : 'bg-navy-deep/15'}`}
                          />
                        ))}
                      </div>
                      <p className="relative mt-2 text-xs font-semibold text-navy-deep">
                        {t('startsAt', { stage: stages(path[start]!) })}
                      </p>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Chapter 2: the path */}
        <section aria-labelledby="accompagnement-stages" className="px-5 py-20 md:px-7">
          <div className="mx-auto max-w-7xl">
            <Heading id="accompagnement-stages" eyebrow={t('chapters.two')} title={t('storyStagesTitle')} lead={t('storyStagesLead')} />
            <StoryStages />
          </div>
        </section>

        {/* What goes with every stage */}
        <section aria-labelledby="accompagnement-features" className="bg-white px-5 py-20 md:px-7">
          <div className="mx-auto max-w-7xl">
            <Heading id="accompagnement-features" eyebrow={t('featuresEyebrow')} title={t('featuresTitle')} />
            <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ key, icon: Icon }, index) => (
                <li key={key}>
                  <Reveal
                    delay={(index % 3) * 0.06}
                    className="group h-full rounded-2xl border-2 border-fog-light bg-white p-7 transition-all duration-200 hover:-translate-y-1 hover:border-navy-deep hover:shadow-lg"
                  >
                    <span
                      aria-hidden={true}
                      className="mb-4 flex size-12 items-center justify-center rounded-xl bg-ice-blue text-navy-deep transition-colors duration-200 group-hover:bg-navy-deep group-hover:text-white"
                    >
                      <Icon className="size-6" strokeWidth={2} />
                    </span>
                    <h3 className="font-heading text-lg leading-snug font-bold text-navy-deep">{t(`features.${key}.title`)}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate">{t(`features.${key}.body`)}</p>
                  </Reveal>
                </li>
              ))}
            </ul>
            <Reveal className="mt-6 flex items-start gap-2 rounded-2xl border border-rose bg-blush px-5 py-4 text-sm text-navy-deep">
              <HandHelping aria-hidden={true} className="mt-0.5 size-5 shrink-0 text-rouge" />
              {t('stanzyNote')}
            </Reveal>
          </div>
        </section>

        {/* Chapter 3: how it begins */}
        <section aria-labelledby="accompagnement-how" className="px-5 py-20 md:px-7">
          <div className="mx-auto max-w-7xl">
            <Heading id="accompagnement-how" eyebrow={t('chapters.three')} title={t('storyHowTitle')} />
            <HowItWorks />
            <Reveal className="mt-10">
              <ApplyLink from="how" className={applyClass}>
                {t('apply')}
                <span aria-hidden={true} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <ArrowRight className="size-3.5" strokeWidth={2.5} />
                </span>
              </ApplyLink>
            </Reveal>
          </div>
        </section>

        {/* The last chapter */}
        <section aria-labelledby="accompagnement-cta" className="px-5 pb-20 md:px-7">
          <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl">
            <Image src={CTA_IMAGE} alt="" fill unoptimized sizes="100vw" className="object-cover" />
            <div aria-hidden={true} className="absolute inset-0 bg-linear-to-r from-navy-deep via-navy-deep/90 to-navy-deep/40" />
            <div className="relative grid gap-6 px-6 py-16 text-white sm:px-12 md:max-w-2xl">
              <p className="text-xs font-semibold tracking-widest text-rose uppercase">{t('chapters.end')}</p>
              <h2 id="accompagnement-cta" className="font-heading text-[clamp(30px,3.6vw,46px)] leading-none font-bold tracking-tight">
                {t('storyEndTitle')}
              </h2>
              <p className="text-body-lg text-ice-blue">{t('storyEndBody')}</p>
              <div className="flex flex-wrap gap-3">
                <ApplyLink from="cta" className={applyClass}>
                  {t('apply')}
                  <span aria-hidden={true} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20">
                    <ArrowRight className="size-3.5" strokeWidth={2.5} />
                  </span>
                </ApplyLink>
                <Link
                  href="/services/consultation"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-heading text-base font-bold text-navy-deep transition-all hover:bg-ice-blue active:scale-97"
                >
                  <CalendarDays aria-hidden={true} className="size-4" />
                  {t('consult')}
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </MotionConfig>
  );
}
