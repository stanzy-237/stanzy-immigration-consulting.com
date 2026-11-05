import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileSignature,
  FolderOpen,
  Gauge,
  HandHelping,
  MessagesSquare,
  Timer,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { ReactNode } from 'react';

import { DossierArt, JourneyArt, MapleLeaf } from '@/features/accompagnement/components/accompagnement-art';
import { LEVELS, startStageOf } from '@/features/accompagnement/lib/interest-schema';
import { WORKFLOWS } from '@/features/dossiers/data/workflows';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';

// Photos from Unsplash, like the home page's.
const HERO_IMAGE = 'https://images.unsplash.com/photo-1517090504586-fde19ea6066f?w=1200&q=85';
const HOW_IMAGE = 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1000&q=85';
const CTA_IMAGE = 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&q=80';

const FEATURES: { key: string; icon: LucideIcon }[] = [
  { key: 'dossier', icon: FolderOpen },
  { key: 'crs', icon: Gauge },
  { key: 'ita', icon: Timer },
  { key: 'messages', icon: MessagesSquare },
  { key: 'meetings', icon: Video },
  { key: 'contract', icon: FileSignature },
];
const HOW = ['1', '2', '3', '4'] as const;
const BADGES = ['noConsult', 'languages', 'everywhere'] as const;

const applyClass =
  'inline-flex h-12 items-center gap-2 rounded-full bg-rouge px-7 font-heading text-body font-bold text-white shadow-lg shadow-rouge/30 transition-all hover:-translate-y-px hover:bg-crimson';

/**
 * Accompagnement Entrée Express (#81): what the service is and what it
 * includes, where each Niveau starts on the 10 stages, how a Demande
 * d'intérêt opens the Dossier, and « Faire une demande » (no consultation
 * needed first) or « Réserver une consultation ».
 */
export function AccompagnementView(): ReactNode {
  const t = useTranslations('Accompagnement.page');
  const stages = useTranslations('Dossiers.stages.ACCOMPAGNEMENT');
  const path = WORKFLOWS.ACCOMPAGNEMENT;

  return (
    <>
      <SiteNav />
      <main className="overflow-hidden bg-off-white">
        {/* Hero */}
        <section aria-labelledby="accompagnement-title" className="relative bg-navy-deep px-4 text-white">
          <div aria-hidden={true} className="absolute -top-32 -left-24 size-96 rounded-full bg-rouge/25 blur-3xl" />
          <div aria-hidden={true} className="absolute -right-24 bottom-0 size-96 rounded-full bg-steel-blue/30 blur-3xl" />
          <MapleLeaf className="absolute top-16 right-6 size-24 rotate-12 text-white/5 md:size-40" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 py-16 md:py-24 lg:grid-cols-2">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-widest uppercase">
                <MapleLeaf className="size-3.5 text-rose" />
                {t('eyebrow')}
              </p>
              <h1
                id="accompagnement-title"
                className="mt-5 font-heading text-h3 leading-tight font-bold sm:text-h2 lg:text-5xl"
              >
                {t('title')}
              </h1>
              <p className="mt-5 max-w-xl text-body-lg text-ice-blue">{t('lead')}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/mon-espace/accompagnement" className={applyClass}>
                  {t('apply')}
                  <ArrowRight aria-hidden={true} className="size-4" />
                </Link>
                <Link
                  href="/services/consultation"
                  className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-white/40 px-7 font-heading text-body font-bold text-white hover:border-white hover:bg-white hover:text-navy-deep"
                >
                  <CalendarDays aria-hidden={true} className="size-4" />
                  {t('consult')}
                </Link>
              </div>
              <ul className="mt-8 grid gap-2 text-sm text-ice-blue sm:grid-cols-3">
                {BADGES.map((badge) => (
                  <li key={badge} className="flex items-start gap-2">
                    <CheckCircle2 aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-rose" />
                    {t(`badges.${badge}`)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="relative aspect-4/5 overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10 sm:aspect-4/3 lg:aspect-4/5">
                <Image
                  src={HERO_IMAGE}
                  alt={t('heroImageAlt')}
                  fill
                  priority
                  unoptimized
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-cover"
                />
                <div aria-hidden={true} className="absolute inset-0 bg-linear-to-t from-navy-deep/70 via-transparent" />
                <JourneyArt className="absolute right-4 bottom-4 w-40 sm:w-52" />
              </div>
              <div className="absolute top-6 -left-2 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-navy-deep shadow-xl sm:-left-8">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blush">
                  <Gauge aria-hidden={true} className="size-5 text-rouge" />
                </span>
                <span className="text-sm font-semibold leading-tight">{t('chips.crs')}</span>
              </div>
              <div className="absolute -bottom-5 left-6 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-navy-deep shadow-xl">
                <span className="flex size-10 items-center justify-center rounded-xl bg-ice-blue">
                  <Timer aria-hidden={true} className="size-5 text-navy-deep" />
                </span>
                <span className="text-sm font-semibold leading-tight">{t('chips.ita')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* What it includes */}
        <section aria-labelledby="accompagnement-features" className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-end gap-8 md:grid-cols-3">
              <div className="md:col-span-2">
                <p className="font-label text-rouge">{t('featuresEyebrow')}</p>
                <h2 id="accompagnement-features" className="mt-2 font-heading text-3xl font-bold text-navy-deep md:text-4xl">
                  {t('featuresTitle')}
                </h2>
              </div>
              <DossierArt className="hidden w-40 justify-self-end md:block" />
            </div>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ key, icon: Icon }) => (
                <li
                  key={key}
                  className="group rounded-2xl border border-fog-light bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span
                    aria-hidden={true}
                    className="flex size-12 items-center justify-center rounded-2xl bg-ice-blue transition-colors group-hover:bg-navy-deep"
                  >
                    <Icon className="size-6 text-navy-deep transition-colors group-hover:text-white" />
                  </span>
                  <h3 className="mt-4 font-heading text-lg font-bold text-navy-deep">{t(`features.${key}.title`)}</h3>
                  <p className="mt-1.5 text-sm text-slate">{t(`features.${key}.body`)}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 flex items-start gap-2 rounded-2xl bg-blush px-5 py-4 text-sm text-navy-deep">
              <HandHelping aria-hidden={true} className="mt-0.5 size-5 shrink-0 text-rouge" />
              {t('stanzyNote')}
            </p>
          </div>
        </section>

        {/* Where each Niveau starts */}
        <section aria-labelledby="accompagnement-levels" className="bg-white px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="font-label text-rouge">{t('levelsEyebrow')}</p>
              <h2 id="accompagnement-levels" className="mt-2 font-heading text-3xl font-bold text-navy-deep md:text-4xl">
                {t('levelsTitle')}
              </h2>
              <p className="mt-3 text-body text-slate">{t('levelsLead')}</p>
            </div>
            <ul className="mt-10 grid gap-5 md:grid-cols-3">
              {LEVELS.map((level) => {
                const start = path.indexOf(startStageOf(level, false));
                return (
                  <li key={level} className="relative overflow-hidden rounded-3xl bg-off-white p-6">
                    <span
                      aria-hidden={true}
                      className="absolute -top-4 -right-2 font-heading text-9xl font-bold text-navy-deep/5"
                    >
                      {level}
                    </span>
                    <h3 className="relative font-heading text-xl font-bold text-navy-deep">{t(`levels.${level}.title`)}</h3>
                    <p className="relative mt-2 text-sm text-slate">{t(`levels.${level}.body`)}</p>
                    <div className="relative mt-6">
                      <div aria-hidden={true} className="flex gap-1">
                        {path.map((stage, index) => (
                          <span
                            key={stage}
                            className={`h-2 flex-1 rounded-full ${index < start ? 'bg-fog' : index === start ? 'bg-rouge' : 'bg-navy-deep/15'}`}
                          />
                        ))}
                      </div>
                      <p className="mt-2 text-xs font-semibold text-navy-deep">
                        {t('startsAt', { stage: stages(path[start]!) })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* The 10 stages */}
        <section aria-labelledby="accompagnement-stages" className="relative bg-navy-deep px-4 py-20 text-white">
          <MapleLeaf className="absolute -bottom-10 -left-10 size-64 -rotate-12 text-white/5" />
          <div className="relative mx-auto max-w-6xl">
            <h2 id="accompagnement-stages" className="font-heading text-3xl font-bold md:text-4xl">
              {t('stagesTitle')}
            </h2>
            <p className="mt-3 max-w-2xl text-ice-blue">{t('stagesLead')}</p>
            <ol className="mt-10 grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
              {path.map((stage, index) => (
                <li key={stage} className="relative flex gap-4 lg:flex-col lg:gap-3">
                  {index < path.length - 1 ? (
                    <span
                      aria-hidden={true}
                      className="absolute top-12 bottom-0 left-5 w-px bg-white/20 sm:hidden lg:top-5 lg:left-12 lg:block lg:h-px lg:w-full"
                    />
                  ) : null}
                  <span
                    className={`relative flex size-10 shrink-0 items-center justify-center rounded-full font-heading font-bold ${
                      index === path.length - 1 ? 'bg-rouge text-white' : 'bg-white text-navy-deep'
                    }`}
                  >
                    {index === path.length - 1 ? <MapleLeaf className="size-5" /> : index + 1}
                  </span>
                  <span className="pt-2 text-sm font-semibold lg:pt-0">{stages(stage)}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="accompagnement-how" className="px-4 py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <div className="relative order-last lg:order-first">
              <div className="relative aspect-4/3 overflow-hidden rounded-3xl shadow-xl">
                <Image src={HOW_IMAGE} alt={t('howImageAlt')} fill unoptimized sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
              </div>
              <div className="absolute -right-2 -bottom-6 rounded-2xl bg-white p-4 shadow-xl sm:-right-6">
                <p className="text-xs font-semibold text-slate">{t('chips.minutes')}</p>
                <p className="font-heading text-3xl font-bold text-rouge">10 min</p>
              </div>
            </div>
            <div>
              <p className="font-label text-rouge">{t('howEyebrow')}</p>
              <h2 id="accompagnement-how" className="mt-2 font-heading text-3xl font-bold text-navy-deep md:text-4xl">
                {t('howTitle')}
              </h2>
              <ol className="mt-8 grid gap-5">
                {HOW.map((step) => (
                  <li key={step} className="flex gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-navy-deep font-heading font-bold text-white">
                      {step}
                    </span>
                    <p className="pt-2 text-body text-navy-deep">{t(`how.${step}`)}</p>
                  </li>
                ))}
              </ol>
              <Link href="/mon-espace/accompagnement" className={`mt-10 ${applyClass}`}>
                {t('apply')}
                <ArrowRight aria-hidden={true} className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Closing call */}
        <section aria-labelledby="accompagnement-cta" className="px-4 pb-20">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl">
            <Image src={CTA_IMAGE} alt="" fill unoptimized sizes="100vw" className="object-cover" />
            <div aria-hidden={true} className="absolute inset-0 bg-linear-to-r from-navy-deep via-navy-deep/90 to-navy-deep/40" />
            <div className="relative grid gap-6 px-6 py-14 text-white sm:px-12 md:max-w-2xl">
              <h2 id="accompagnement-cta" className="font-heading text-3xl font-bold md:text-4xl">
                {t('ctaTitle')}
              </h2>
              <p className="text-body-lg text-ice-blue">{t('ctaBody')}</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/mon-espace/accompagnement" className={applyClass}>
                  {t('apply')}
                  <ArrowRight aria-hidden={true} className="size-4" />
                </Link>
                <Link
                  href="/services/consultation"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 font-heading text-body font-bold text-navy-deep hover:bg-ice-blue"
                >
                  <CalendarDays aria-hidden={true} className="size-4" />
                  {t('consult')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
