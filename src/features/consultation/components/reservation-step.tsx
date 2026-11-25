'use client';

import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { EASE_OUT_EXPO, PRESS } from '@/features/consultation/lib/styles';
import { cn } from '@/lib/utils';

export type StepState = 'open' | 'done' | 'closed';

/**
 * One of the three booking steps on desktop: open (its form, navy border),
 * done (a green check, a one-line summary, « Modifier ») or closed (just its
 * title). On mobile only the open step shows, as its own screen. A step that
 * opens grows to its height with its content fading, no slide
 * (docs/design/consultation-motion.md, row « Booking · desktop »).
 */
export function ReservationStep({
  number,
  title,
  state,
  summary,
  onEdit,
  aside,
  children,
}: {
  number: number;
  title: string;
  state: StepState;
  /** The done step's one line. */
  summary?: string;
  onEdit?: () => void;
  /** Beside the open step's title (« Déjà un compte ? Se connecter »). */
  aside?: ReactNode;
  children?: ReactNode;
}): ReactNode {
  const t = useTranslations('Consultation.reservation');

  if (state === 'done') {
    return (
      <section aria-label={title} className="hidden items-center gap-3.5 rounded-3xl border border-fog-light bg-white px-7 py-5.5 lg:flex">
        <span aria-hidden={true} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-leaf">
          <Check className="size-4 text-white" strokeWidth={3} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="font-heading text-h4 leading-6 font-bold text-ink">{title}</h2>
          {summary ? <p className="truncate text-body-sm leading-5 text-slate">{summary}</p> : null}
        </div>
        {onEdit ? (
          <button type="button" onClick={onEdit} className={cn('text-body-sm font-semibold text-ink underline underline-offset-2', PRESS)}>
            {t('edit')}
          </button>
        ) : null}
      </section>
    );
  }

  if (state === 'closed') {
    return (
      <section aria-label={title} className="hidden items-center gap-3.5 rounded-3xl border border-fog-light bg-white px-7 py-5.5 lg:flex">
        <span aria-hidden={true} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ice-blue font-heading text-body-sm font-extrabold text-slate">
          {number}
        </span>
        <h2 className="font-heading text-h4 leading-6 font-bold text-slate">{title}</h2>
      </section>
    );
  }

  return (
    <motion.section
      aria-labelledby={`reservation-step-${number}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
      className="flex flex-col gap-6 lg:rounded-3xl lg:border-2 lg:border-navy-deep lg:bg-white lg:p-7"
    >
      <div className="hidden items-center gap-3.5 lg:flex">
        <span aria-hidden={true} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy-deep font-heading text-body-sm font-extrabold text-white">
          {number}
        </span>
        <h2 id={`reservation-step-${number}`} className="flex-1 font-heading text-h4 leading-6 font-bold text-ink">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </motion.section>
  );
}
