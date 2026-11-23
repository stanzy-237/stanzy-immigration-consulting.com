'use client';

import { ArrowRight, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Reveal } from '@/components/ui/reveal';
import { PRESS } from '@/features/consultation/lib/styles';
import { FOOTER_SOCIALS } from '@/features/landing/data/footer';
import { cn } from '@/lib/utils';

const QUESTIONS = ['app', 'refused', 'move', 'recording'] as const;

const WHATSAPP = FOOTER_SOCIALS.find((social) => social.key === 'whatsapp')?.href;

/**
 * The Consultation's questions, in the home page's FAQ look. « Poser une
 * question » opens WhatsApp. Answers open and close at once: the motion spec
 * gives the FAQ no animation.
 */
export function ConsultationFaq({ moveCutoffHours }: { moveCutoffHours: number }): ReactNode {
  const t = useTranslations('Consultation.page.faq');
  const [open, setOpen] = useState<string | null>(QUESTIONS[0]);

  return (
    <section aria-labelledby="consultation-faq" className="bg-navy-deep px-5 py-14 text-white md:px-7 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
        <Reveal>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3.5 py-1.5">
            <span aria-hidden={true} className="h-1 w-4 shrink-0 rounded-full bg-rouge" />
            <span className="text-caption font-semibold tracking-widest uppercase">{t('eyebrow')}</span>
          </div>
          <h2 id="consultation-faq" className="font-heading text-h2 leading-none font-bold tracking-tight lg:text-5xl">
            {t('titleLead')}
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
                    aria-controls={`consultation-faq-${key}`}
                    onClick={() => setOpen(expanded ? null : key)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left font-heading text-body leading-snug font-semibold"
                  >
                    {t(`${key}.q`)}
                    <span
                      aria-hidden={true}
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full border',
                        expanded ? 'rotate-45 border-rouge bg-rouge' : 'border-white/20',
                      )}
                    >
                      <Plus className="size-4" strokeWidth={2.5} />
                    </span>
                  </button>
                  <div id={`consultation-faq-${key}`} hidden={!expanded}>
                    <p className="pr-10 pb-5 text-body-sm leading-relaxed text-white/70">{t(`${key}.a`, { hours: moveCutoffHours })}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
