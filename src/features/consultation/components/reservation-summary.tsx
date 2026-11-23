'use client';

import { Check, Timer } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import type { FeeLine } from '@/features/consultation/components/payment-step';
import { useHoldCountdown } from '@/features/consultation/hooks/use-hold-countdown';
import { fcfa, timeOf } from '@/features/consultation/lib/slot-format';
import { LABEL_CLASS } from '@/features/consultation/lib/styles';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const DOUALA = 'Africa/Douala';
const part = (iso: Date, locale: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { timeZone: DOUALA, ...options }).format(iso);

/** « 14:52 · créneau gardé pour vous le temps de payer », or « libéré » once it runs out. */
export function HoldTimer({ heldUntil, startsAt, compact = false }: { heldUntil: Date | null; startsAt: Date; compact?: boolean }): ReactNode {
  const t = useTranslations('Consultation.reservation.hold');
  const locale = useLocale();
  const { text, warn, over } = useHoldCountdown(heldUntil);
  if (!heldUntil) return null;
  const b = (chunks: ReactNode) => <span className="font-bold tabular-nums">{chunks}</span>;
  return (
    <p
      role="timer"
      aria-live="off"
      className={cn(
        'flex items-center gap-2.5 transition-colors duration-200 ease-standard',
        compact ? 'rounded-full px-3 py-1.75 text-caption leading-4 font-semibold' : 'rounded-xl px-4.5 py-3.5 text-body-sm leading-5',
        over ? 'bg-blush text-rouge' : warn ? 'bg-blush text-rouge' : 'bg-honey-tint text-honey',
      )}
    >
      <Timer aria-hidden={true} className={cn('shrink-0', compact ? 'size-3.5' : 'size-4.5')} strokeWidth={2.2} />
      <span>
        {over
          ? t.rich('released', { time: timeOf(startsAt.toISOString(), locale), b })
          : compact
            ? t.rich('timerShort', { time: text, b })
            : t.rich('timer', { time: text, b })}
      </span>
    </p>
  );
}

/** « Votre consultation »: the slot, what is included, the price. Desktop only; mobile shows the slot as a chip. */
export function BookingSummary({
  startsAt,
  durationMinutes,
  price,
  fee = null,
  released = false,
}: {
  startsAt: Date;
  durationMinutes: number;
  price: number | null;
  /** Step 3's chosen way to pay: its fee line, or « calculés par SasPay » when only its page knows. */
  fee?: FeeLine | null;
  released?: boolean;
}): ReactNode {
  const t = useTranslations('Consultation.reservation.summary');
  const locale = useLocale();
  const end = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const included = t.raw('included') as string[];
  const weekday = part(startsAt, locale, { weekday: 'long' });

  return (
    <div className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-lg shadow-navy-deep/8">
      <div className="flex flex-col gap-1">
        <p className={cn(LABEL_CLASS, 'text-slate')}>{t('eyebrow')}</p>
        <p className="font-heading text-h4 leading-6.5 font-bold text-ink">{t('title', { minutes: durationMinutes })}</p>
      </div>
      <div className={cn('flex items-center gap-3.5 rounded-xl bg-off-white p-4', released && 'opacity-50')}>
        <div className="flex w-12 shrink-0 flex-col items-center rounded-md bg-navy-deep py-1.5">
          <span className="font-label text-label leading-3.5 font-bold text-rose uppercase">{part(startsAt, locale, { month: 'short' })}</span>
          <span className="font-heading text-h4 leading-6 font-extrabold text-white">{part(startsAt, locale, { day: 'numeric' })}</span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          <p className="text-body leading-5.5 font-bold text-ink first-letter:uppercase">
            {t('time', { weekday, start: timeOf(startsAt.toISOString(), locale), end: timeOf(end.toISOString(), locale) })}
          </p>
          <p className="text-caption leading-4 text-slate">{t('zone')}</p>
        </div>
        <Link href="/services/consultation" className="text-body-sm font-semibold text-rouge underline underline-offset-2">
          {t('change')}
        </Link>
      </div>
      <ul className="flex flex-col gap-2.5">
        {included.map((item) => (
          <li key={item} className="flex items-center gap-2.5 text-body-sm leading-5 text-ink">
            <Check aria-hidden={true} className="size-4 shrink-0 text-leaf" strokeWidth={2.5} />
            {item}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 border-t border-fog-light pt-4">
        {price === null ? (
          <p className="text-body-sm leading-5 text-slate">{t('noPrice')}</p>
        ) : (
          <>
            <p className="flex justify-between text-body-sm leading-5">
              <span className="text-slate">{t('price')}</span>
              <span className="text-ink">{fcfa(price, locale)}</span>
            </p>
            {fee ? (
              <p className="flex justify-between gap-4 text-body-sm leading-5">
                <span className="text-slate">{fee.label ? t('feesFor', { network: fee.label }) : t('feesCard')}</span>
                <span className="text-ink">{fee.amount === null ? t('feesBySasPay') : `+${fcfa(fee.amount, locale)}`}</span>
              </p>
            ) : null}
            <div className="flex items-baseline justify-between gap-4 border-t border-fog-light pt-3">
              <p className="flex flex-col gap-0.5">
                <span className="text-body leading-5.5 font-semibold text-ink">
                  {fee && fee.amount !== null ? t('totalToPay') : fee ? t('totalBeforeFees') : t('total')}
                </span>
                {fee ? null : <span className="text-caption leading-4 text-slate">{t('fees')}</span>}
              </p>
              <p className="shrink-0 font-heading text-h4 leading-6.5 font-extrabold whitespace-nowrap text-ink">
                {fcfa(price + (fee?.amount ?? 0), locale)}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Mobile: « Mer. 25 nov. · 09:00 · Vidéo avec Stanzy ». */
export function SlotChip({ startsAt }: { startsAt: Date }): ReactNode {
  const t = useTranslations('Consultation.reservation.summary');
  const locale = useLocale();
  const date = part(startsAt, locale, { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <p className="mt-1 flex items-center gap-2 self-start rounded-full bg-off-white py-1.5 pr-3 pl-1.5 text-caption leading-4 font-semibold text-ink">
      <span aria-hidden={true} className="flex size-6 items-center justify-center rounded-full bg-navy-deep">
        <svg viewBox="0 0 24 24" className="size-3">
          <rect x="3" y="5" width="18" height="16" rx="2" fill="none" className="stroke-white" strokeWidth="2.4" />
          <path d="M3 10h18M8 3v4M16 3v4" className="stroke-white" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>
      <span className="first-letter:uppercase">{t('chip', { date, time: timeOf(startsAt.toISOString(), locale) })}</span>
    </p>
  );
}
