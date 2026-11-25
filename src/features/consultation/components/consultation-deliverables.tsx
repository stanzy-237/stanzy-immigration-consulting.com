'use client';

import { useInView, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef, type ReactNode } from 'react';

import { Reveal } from '@/components/ui/reveal';
import {
  FolderIllustration,
  PlanIllustration,
  ReplayIllustration,
} from '@/features/consultation/components/step-illustrations';
import { LABEL_CLASS } from '@/features/consultation/lib/styles';
import { cn } from '@/lib/utils';

const DELIVERABLES = [
  { key: 'plan', Illustration: PlanIllustration },
  { key: 'recording', Illustration: ReplayIllustration },
  { key: 'documents', Illustration: FolderIllustration },
] as const;

/**
 * « Ce que vous repartez avec »: the plan, the recording, the documents, each
 * with its illustration. Their « · anim » layers play once in view (the
 * plan's route draws, its flag tips) or breathe while in view (the
 * transcription's lines). The texts do not move beyond the section's reveal.
 */
export function ConsultationDeliverables(): ReactNode {
  const t = useTranslations('Consultation.page.deliverables');
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { margin: '0px 0px -15% 0px' });
  const reduce = useReducedMotion();

  return (
    <section ref={ref} aria-labelledby="consultation-deliverables" className="bg-off-white px-5 py-14 md:px-7 lg:py-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:gap-10">
        <h2 id="consultation-deliverables" className={cn(LABEL_CLASS, 'text-slate')}>
          {t('eyebrow')}
        </h2>
        <ul className="flex flex-col gap-6 lg:flex-row lg:gap-14">
          {DELIVERABLES.map(({ key, Illustration }, index) => (
            <li key={key} className="lg:flex-1">
              <Reveal delay={index * 0.06} className="flex items-center gap-4 lg:flex-col lg:items-start">
                <Illustration playing={inView && !reduce} className="size-16 shrink-0 lg:size-35" />
                <div className="flex flex-1 flex-col gap-1.5 lg:gap-4">
                  <h3 className="font-heading text-h4 leading-6.5 font-bold text-ink lg:text-h3 lg:leading-8.5 lg:tracking-tight">
                    {t(`${key}.title`)}
                  </h3>
                  <p className="text-body-sm leading-5 text-slate lg:text-body lg:leading-6">{t(`${key}.body`)}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
