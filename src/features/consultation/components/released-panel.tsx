'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight, Timer } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { toast } from '@/components/ui/toast';
import type { Contact } from '@/features/consultation/components/contact-step';
import type { BookingRef } from '@/features/consultation/hooks/use-booking-ref';
import { slotDay, timeOf } from '@/features/consultation/lib/slot-format';
import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

/**
 * « Votre créneau a été libéré » (`4 Créneau libéré`): the 15 minutes passed
 * unpaid. Nothing was charged and the answers are kept; the next free slots
 * are offered, and keeping one holds it again for the same Compte.
 */
export function ReleasedPanel({
  previous,
  contact,
  onHeld,
}: {
  previous: BookingRef;
  contact: Contact;
  onHeld: (ref: BookingRef, start: string) => void;
}): ReactNode {
  const t = useTranslations('Consultation.reservation.released');
  const tToast = useTranslations('Consultation.reservation.toast');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.consultation.slots.queryOptions());
  const next = data.days.flatMap((day) => day.starts).slice(0, 3);
  const [chosen, setChosen] = useState(next[0]);

  const book = useMutation(
    trpc.consultation.book.mutationOptions({
      onSuccess: (held, input) => onHeld({ id: held.id, ...(held.token ? { token: held.token } : {}) }, input.start),
      onError: () => toast.add({ title: tToast('error'), type: 'error' }),
    }),
  );

  return (
    <section
      aria-labelledby="reservation-released"
      className="flex flex-col gap-5 lg:rounded-3xl lg:border-2 lg:border-rouge lg:bg-white lg:p-7"
    >
      <div className="flex items-start gap-3.5">
        <span aria-hidden={true} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blush">
          <Timer className="size-4 text-rouge" strokeWidth={2.2} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="reservation-released" className="font-heading text-h4 leading-6 font-bold text-ink">
            {t('title')}
          </h2>
          <p className="text-body-sm leading-5 text-slate">{t('lead')}</p>
        </div>
      </div>

      {next.length === 0 ? (
        <p className="rounded-xl bg-ice-blue px-4 py-3.5 text-body-sm text-ink">{t('none')}</p>
      ) : (
        <>
          <fieldset className="flex flex-col gap-2.5">
            <legend className={cn(LABEL_CLASS, 'mb-2.5 text-slate')}>{t('next')}</legend>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {next.map((iso) => {
                const on = iso === chosen;
                return (
                  <label
                    key={iso}
                    className={cn(
                      'flex cursor-pointer flex-col items-center gap-0.5 rounded-xl py-3 transition-colors duration-150 ease-standard',
                      on ? 'border-2 border-navy-deep bg-ice-blue' : 'border border-fog-light bg-white hover:border-fog',
                    )}
                  >
                    <input type="radio" name="released-slot" checked={on} onChange={() => setChosen(iso)} className="sr-only" />
                    <span className="text-caption leading-4 font-semibold text-slate first-letter:uppercase">{slotDay(iso, locale)}</span>
                    <span className="text-body leading-5.5 font-bold text-ink">{timeOf(iso, locale)}</span>
                  </label>
                );
              })}
              <Link
                href="/services/consultation"
                className="flex items-center justify-center rounded-xl bg-off-white py-3 text-body-sm font-semibold text-ink underline underline-offset-2"
              >
                {t('other')}
              </Link>
            </div>
          </fieldset>
          {chosen ? (
            <button
              type="button"
              disabled={book.isPending}
              onClick={() =>
                book.mutate({ start: chosen, contact, locale: locale === 'en' ? 'en' : 'fr', previous })
              }
              className={cn(
                'flex h-14 items-center justify-center gap-2.5 rounded-full bg-rouge font-heading text-body font-bold text-white hover:bg-crimson disabled:opacity-60',
                PRESS,
              )}
            >
              {t('keep', { day: slotDay(chosen, locale, { short: true }), time: timeOf(chosen, locale) })}
              <ArrowRight aria-hidden={true} className="size-4.5" strokeWidth={2.5} />
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
