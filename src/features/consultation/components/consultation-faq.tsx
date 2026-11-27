'use client';

import { ArrowRight, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Reveal } from '@/components/ui/reveal';
import { EASE_OUT_EXPO, PRESS } from '@/features/consultation/lib/styles';
import { FOOTER_SOCIALS } from '@/features/landing/data/footer';
import { cn } from '@/lib/utils';

const QUESTIONS = ['app', 'refused', 'move', 'recording'] as const;

const WHATSAPP = FOOTER_SOCIALS.find((social) => social.key === 'whatsapp')?.href;

/**
 * The Consultation's questions, in the home page's FAQ look. « Poser une
 * question » opens WhatsApp. An answer opens to its height with its text
 * fading in, and the « + » turns into a « × » (docs/design/consultation-motion.md, row « FAQ »).
 */
export function ConsultationFaq({ moveCutoffHours }: { moveCutoffHours: number }): ReactNode {
  const t = useTranslations('Consultation.page.faq');
  const [open, setOpen] = useState<string | null>(QUESTIONS[0]);

  return (
    <section aria-labelledby="consultation-faq" className="bg-navy-deep px-5 py-14 text-white md:px-7 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
        <Reveal className="relative">
          {/* Stanzy, thinking about your question. Not animated. */}
          <div
            aria-hidden={true}
            className="absolute top-0 right-0 flex size-19 justify-center overflow-hidden rounded-full border-3 border-white bg-ice-blue lg:top-7.5 lg:right-10 lg:size-30 lg:border-4"
          >
            <Image
              unoptimized={true}
              src="/stanzy/think.svg"
              alt=""
              width={144}
              height={252}
              className="h-40 w-23 max-w-none shrink-0 translate-y-1.5 lg:h-63 lg:w-36 lg:translate-y-2"
            />
          </div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3.5 py-1.5">
            <span aria-hidden={true} className="h-1 w-4 shrink-0 rounded-full bg-rouge" />
            <span className="text-caption font-semibold tracking-widest uppercase">{t('eyebrow')}</span>
          </div>
          <h2 id="consultation-faq" className="font-heading text-h2 leading-none font-bold tracking-tight lg:text-5xl">
            {t('titleLead')}{' '}
            <br />
            <span className="text-rouge">{t('titleAccent')}</span>
          </h2>
          <p className="mt-4 max-w-md text-body leading-relaxed text-white/70">{t('lead')}</p>
          {WHATSAPP ? (
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 font-heading text-body-sm font-semibold hover:bg-crimson',
                PRESS,
              )}
            >
              {t('cta')}
              <ArrowRight aria-hidden={true} className="size-4" strokeWidth={2.5} />
            </a>
          ) : null}
        </Reveal>

        <Reveal delay={0.06}>
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {QUESTIONS.map((key) => {
              const expanded = open === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={expanded ? `consultation-faq-${key}` : undefined}
                    onClick={() => setOpen(expanded ? null : key)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left font-heading text-body leading-snug font-semibold"
                  >
                    {t(`${key}.q`)}
                    <span
                      aria-hidden={true}
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full border transition duration-200 ease-standard',
                        expanded ? 'rotate-45 border-rouge bg-rouge' : 'border-white/20 hover:border-white/40',
                      )}
                    >
                      <Plus className="size-4" strokeWidth={2.5} />
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {expanded ? (
                      <motion.div
                        id={`consultation-faq-${key}`}
                        key="answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1, transition: { duration: 0.25, ease: EASE_OUT_EXPO } }}
                        exit={{ height: 0, opacity: 0, transition: { duration: 0.15, ease: EASE_OUT_EXPO } }}
                        className="overflow-hidden"
                      >
                        <p className="pr-10 pb-5 text-body-sm leading-relaxed text-white/70">{t(`${key}.a`, { hours: moveCutoffHours })}</p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
