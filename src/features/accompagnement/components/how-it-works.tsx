'use client';

import { Bell, Check, FileText, Gauge, Mail, Pause, Play, Video } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';

import { EASE_OUT } from '@/components/ui/reveal';

const STEPS = ['1', '2', '3', '4'] as const;
type Step = (typeof STEPS)[number];
/** How long each step plays, in seconds. */
const DURATION = 5;

const pop = (delay: number) => ({
  initial: { opacity: 0, y: 10, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.4, ease: EASE_OUT, delay },
});

/**
 * « Comment ça marche », told as four short scenes in a browser window: the
 * Demande filled in (the CRS score appears), Stanzy's answer, the Dossier
 * opening with its documents, then « Mon espace » coming alive. The steps
 * play one after the other; any step can be chosen, and the play can be
 * paused (and never starts with « reduce motion »).
 */
export function HowItWorks(): ReactNode {
  const t = useTranslations('Accompagnement.page');
  const reduce = useReducedMotion();
  const [active, setActive] = useState<Step>('1');
  const [paused, setPaused] = useState(false);
  const playing = !reduce && !paused;

  useEffect(() => {
    if (!playing) return;
    const next = setTimeout(() => setActive((step) => STEPS[(STEPS.indexOf(step) + 1) % STEPS.length]!), DURATION * 1000);
    return () => clearTimeout(next);
  }, [active, playing]);

  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
      <div className="grid grid-cols-1 gap-3">
        <ol className="grid grid-cols-1 gap-3">
          {STEPS.map((step) => {
            const on = step === active;
            return (
              <li key={step}>
                <button
                  type="button"
                  onClick={() => setActive(step)}
                  aria-current={on ? 'step' : undefined}
                  className={`relative flex w-full gap-4 overflow-hidden rounded-2xl p-4 text-left transition-colors duration-300 ${
                    on ? 'bg-white shadow-md' : 'hover:bg-white/60'
                  }`}
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-2xl font-heading font-bold transition-colors duration-300 ${
                      on ? 'bg-rouge text-white' : 'bg-ice-blue text-navy-deep'
                    }`}
                  >
                    {step}
                  </span>
                  <span className={`pt-2 text-body transition-colors duration-300 ${on ? 'text-navy-deep' : 'text-slate'}`}>
                    {t(`how.${step}`)}
                  </span>
                  {on && playing ? (
                    <motion.span
                      key={`${step}-progress`}
                      aria-hidden={true}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: DURATION, ease: 'linear' }}
                      className="absolute bottom-0 left-0 h-1 w-full origin-left bg-rouge"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
        {reduce ? null : (
          <button
            type="button"
            onClick={() => setPaused(!paused)}
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate hover:bg-white hover:text-navy-deep"
          >
            {paused ? <Play aria-hidden={true} className="size-3.5" /> : <Pause aria-hidden={true} className="size-3.5" />}
            {paused ? t('play') : t('pause')}
          </button>
        )}
      </div>

      <div aria-hidden={true} className="overflow-hidden rounded-3xl border border-fog-light bg-white shadow-xl">
        <div className="flex items-center gap-1.5 border-b border-fog-light bg-off-white px-4 py-3">
          <span className="size-2.5 rounded-full bg-rouge/60" />
          <span className="size-2.5 rounded-full bg-honey/60" />
          <span className="size-2.5 rounded-full bg-leaf/60" />
          <span className="ml-3 h-5 flex-1 rounded-full bg-white" />
        </div>
        <div className="relative h-96 p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {active === '1' ? <FormScene /> : active === '2' ? <MailScene /> : active === '3' ? <DossierScene /> : <SpaceScene />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function SceneTitle({ icon: Icon, children }: { icon: typeof Mail; children: ReactNode }): ReactNode {
  return (
    <motion.p {...pop(0)} className="flex items-center gap-2 font-heading font-bold text-navy-deep">
      <Icon className="size-5 text-rouge" />
      {children}
    </motion.p>
  );
}

/** The Demande filling in, then its CRS score. */
function FormScene(): ReactNode {
  const t = useTranslations('Accompagnement.page.scenes');
  return (
    <div className="grid grid-cols-1 h-full content-start gap-4">
      <SceneTitle icon={FileText}>{t('form')}</SceneTitle>
      {[0.75, 0.55, 0.9].map((width, index) => (
        <div key={index} className="grid grid-cols-1 gap-1.5">
          <span className="h-2 w-20 rounded-full bg-fog-light" />
          <div className="h-9 rounded-xl border-2 border-fog-light px-3 py-3">
            <motion.span
              className="block h-2 origin-left rounded-full bg-navy-deep/70"
              style={{ width: `${width * 100}%` }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.2 + index * 0.35 }}
            />
          </div>
        </div>
      ))}
      <motion.div
        {...pop(1.8)}
        className="flex items-center justify-between rounded-2xl bg-navy-deep px-4 py-3 text-white"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Gauge className="size-4 text-rose" />
          CRS
        </span>
        <span className="font-heading text-2xl font-bold">478</span>
      </motion.div>
    </div>
  );
}

/** Stanzy's answer landing in the inbox. */
function MailScene(): ReactNode {
  const t = useTranslations('Accompagnement.page.scenes');
  return (
    <div className="grid grid-cols-1 h-full content-center justify-items-center gap-5">
      <motion.div
        initial={{ opacity: 0, y: 40, rotate: -6 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.7, bounce: 0.25 }}
        className="relative w-64 rounded-2xl border border-fog-light bg-white p-5 shadow-lg"
      >
        <p className="flex items-center gap-2 text-sm font-bold text-navy-deep">
          <Mail className="size-4 text-rouge" />
          {t('mail')}
        </p>
        <span className="mt-3 block h-2 w-full rounded-full bg-fog-light" />
        <span className="mt-2 block h-2 w-4/5 rounded-full bg-fog-light" />
        <span className="mt-2 block h-2 w-3/5 rounded-full bg-fog-light" />
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0.4, delay: 0.7 }}
          className="absolute -top-3 -right-3 flex size-9 items-center justify-center rounded-full bg-leaf text-white shadow-md"
        >
          <Check className="size-5" strokeWidth={3} />
        </motion.span>
      </motion.div>
      <motion.p {...pop(1)} className="rounded-full bg-leaf-tint px-4 py-1.5 text-sm font-semibold text-leaf">
        {t('approved')}
      </motion.p>
    </div>
  );
}

/** The Dossier opening, its documents coming in one by one. */
function DossierScene(): ReactNode {
  const t = useTranslations('Accompagnement.page.scenes');
  const rows = [
    { width: 'w-32', state: 'bg-leaf' },
    { width: 'w-40', state: 'bg-honey' },
    { width: 'w-28', state: 'bg-leaf' },
    { width: 'w-36', state: 'bg-rouge' },
  ];
  return (
    <div className="grid grid-cols-1 h-full content-start gap-3">
      <SceneTitle icon={FileText}>{t('dossier')}</SceneTitle>
      <motion.div {...pop(0.15)} className="flex gap-1">
        {Array.from({ length: 10 }, (_, index) => (
          <motion.span
            key={index}
            initial={{ scaleY: 0.3, opacity: 0.4 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.2 + index * 0.05 }}
            className={`h-2 flex-1 rounded-full ${index < 4 ? 'bg-rouge' : 'bg-ice-blue'}`}
          />
        ))}
      </motion.div>
      <p className="mt-1 text-xs font-semibold text-slate">{t('docs')}</p>
      {rows.map((row, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.5 + index * 0.15 }}
          className="flex items-center gap-3 rounded-xl border border-fog-light px-3 py-2.5"
        >
          <FileText className="size-4 shrink-0 text-navy-deep" />
          <span className={`h-2 rounded-full bg-fog-light ${row.width}`} />
          <span className={`ml-auto size-2.5 rounded-full ${row.state}`} />
        </motion.div>
      ))}
    </div>
  );
}

/** « Mon espace » coming alive: a message and a meeting. */
function SpaceScene(): ReactNode {
  const t = useTranslations('Accompagnement.page.scenes');
  return (
    <div className="relative grid grid-cols-1 h-full content-start gap-4">
      <SceneTitle icon={Bell}>{t('space')}</SceneTitle>
      <motion.div {...pop(0.1)} className="flex gap-2">
        {['w-16', 'w-20', 'w-16', 'w-14'].map((width, index) => (
          <span key={index} className={`h-7 rounded-full ${index === 1 ? 'bg-navy-deep' : 'bg-off-white'} ${width}`} />
        ))}
      </motion.div>
      <motion.div {...pop(0.25)} className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((index) => (
          <span key={index} className="h-16 rounded-xl bg-off-white" />
        ))}
      </motion.div>
      <div className="absolute right-0 bottom-0 grid grid-cols-1 w-64 gap-2">
        <motion.p
          {...pop(0.8)}
          className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-navy-deep shadow-lg ring-1 ring-fog-light"
        >
          <Mail className="size-4 shrink-0 text-rouge" />
          {t('message')}
        </motion.p>
        <motion.p
          {...pop(1.4)}
          className="flex items-center gap-2 rounded-2xl bg-navy-deep px-4 py-3 text-sm font-semibold text-white shadow-lg"
        >
          <Video className="size-4 shrink-0 text-rose" />
          {t('meeting')}
        </motion.p>
      </div>
    </div>
  );
}
