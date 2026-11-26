'use client';

import { CalendarPlus, ChevronDown, FileText } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { NetworkMark } from '@/features/consultation/components/payment-step';
import { calendarPath, googleCalendarUrl, outlookCalendarUrl, type CalendarEvent } from '@/features/consultation/lib/calendar-links';
import type { PaymentView } from '@/features/consultation/components/payment-progress';
import { isFcfa, money } from '@/features/consultation/lib/money';
import { CARD_NETWORK, consultationInvoicePath } from '@/features/consultation/lib/payment';
import { fcfa, timeOf } from '@/features/consultation/lib/slot-format';
import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { clientRoomPath } from '@/features/meetings/lib/meeting-schema';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const DOUALA = 'Africa/Douala';
const part = (date: Date, locale: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { timeZone: DOUALA, ...options }).format(date);

/** The confetti's spots around Stanzy: where each lands, its tone. */
const CONFETTI = [
  { x: -70, y: -40, className: 'bg-mtn' },
  { x: 76, y: -54, className: 'bg-rouge' },
  { x: 88, y: 30, className: 'bg-steel-blue' },
  { x: -82, y: 26, className: 'bg-leaf' },
  { x: 40, y: -78, className: 'bg-rose' },
];

/**
 * `6 Confirmée`: « C'est réservé, Aminata. » Only once SasPay said `SUCCESS`
 * and the Consultation is delivered. Rare, so it may delight (motion row
 * « 6 Confirmée »): the check draws, Stanzy waves, the confetti burst once.
 * The ticket leads to Mon espace and the calendar; the receipt shows what was
 * paid, with SasPay's own amounts.
 */
export function PaymentConfirmed({ payment }: { payment: PaymentView }): ReactNode {
  const t = useTranslations('Consultation.reservation.confirmed');
  const locale = useLocale();
  const reduce = useReducedMotion();
  const booked = payment.consultation!;
  const startsAt = new Date(booked.startsAt);
  const end = new Date(startsAt.getTime() + booked.durationMinutes * 60_000);
  // What left the payer, in the currency SasPay charged it (card: USD at the day's rate).
  const settled = payment.settledCurrency ?? payment.currency;
  const paid = payment.charged ?? payment.amount + (payment.fee ?? 0);
  const roomPath = booked.meetingId ? clientRoomPath(booked.meetingId) : '/mon-espace';
  const paidAt = payment.settledAt ? new Date(payment.settledAt) : new Date();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 pt-10 pb-12 lg:flex-row lg:items-start lg:gap-10 lg:px-7 lg:pt-18 lg:pb-24">
      <div className="flex flex-1 flex-col gap-6">
        <div className="relative size-38 self-center lg:self-start">
          <div className="absolute inset-0 overflow-hidden rounded-full bg-leaf-tint">
            <Image
              unoptimized={true}
              src={reduce ? '/stanzy/wave.svg' : '/stanzy/wave-once.svg'}
              alt=""
              width={150}
              height={262}
              className="absolute top-3 left-1/2 h-auto w-30 -translate-x-1/2"
            />
          </div>
          {!reduce
            ? CONFETTI.map((dot, i) => (
                <motion.span
                  key={i}
                  aria-hidden={true}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.95 }}
                  animate={{ opacity: [0, 1, 0], x: dot.x, y: dot.y, scale: 1 }}
                  transition={{ duration: 0.7, delay: 0.35, ease: 'easeOut' }}
                  className={cn('absolute top-1/2 left-1/2 size-2 rounded-full', dot.className)}
                />
              ))
            : null}
          <svg aria-hidden={true} viewBox="0 0 40 40" className="absolute -top-1 left-0 size-11">
            <circle cx="20" cy="20" r="18" className="fill-leaf stroke-navy-deep" strokeWidth="3" />
            <motion.path
              d="M12 20.5l5.5 5.5 10.5-11"
              fill="none"
              className="stroke-white"
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? { opacity: 0 } : { pathLength: 0 }}
              animate={reduce ? { opacity: 1 } : { pathLength: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </svg>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: reduce ? 0 : 0.2 }}
          className="flex flex-col gap-3 text-center lg:text-left"
        >
          <h1 className="font-heading text-h2 leading-11 font-extrabold tracking-tight text-ink lg:text-h1 lg:leading-14">
            {t('title', { name: booked.firstName })}
          </h1>
          <p className="text-body leading-6 text-slate lg:text-body-lg lg:leading-7">{t('lead')}</p>
        </motion.div>

        {/* The ticket. */}
        <div className="flex flex-col gap-5 rounded-3xl bg-navy-deep p-6 text-white lg:p-7">
          <div className="flex items-center gap-4">
            <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-white py-2">
              <span className="font-label text-caption leading-4 font-bold text-rouge uppercase">{part(startsAt, locale, { month: 'short' })}</span>
              <span className="font-heading text-h3 leading-7 font-extrabold text-ink">{part(startsAt, locale, { day: 'numeric' })}</span>
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-heading text-h4 leading-6.5 font-bold first-letter:uppercase lg:text-h3 lg:leading-8">
                {t('when', { weekday: part(startsAt, locale, { weekday: 'long' }), start: timeOf(startsAt.toISOString(), locale), end: timeOf(end.toISOString(), locale) })}
              </p>
              <p className="text-body-sm leading-5 text-white/80">{t('what', { minutes: booked.durationMinutes })}</p>
            </div>
          </div>
          <p className="text-body-sm leading-5.5 text-white/90">{t('note')}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={roomPath} className={cn('flex h-13 flex-1 items-center justify-center rounded-full bg-rouge px-6 font-heading text-body font-bold text-white hover:bg-crimson', PRESS)}>
              {t('space')}
            </Link>
            <AddToCalendar
              paymentId={payment.id}
              event={{
                id: booked.meetingId ?? payment.id,
                title: t('calendarTitle'),
                details: t('calendarDetails'),
                startsAt,
                minutes: booked.durationMinutes,
                url: typeof window === 'undefined' ? roomPath : `${window.location.origin}/${locale}${roomPath}`,
              }}
            />
          </div>
        </div>
      </div>

      {/* The receipt. */}
      <section aria-labelledby="payment-receipt" className="flex w-full flex-col gap-4 rounded-3xl border border-fog-light bg-white p-6 lg:w-105 lg:p-7">
        <h2 id="payment-receipt" className={cn(LABEL_CLASS, 'text-slate')}>
          {payment.invoiceNumber ? t('receiptNumber', { number: payment.invoiceNumber }) : t('receipt')}
        </h2>
        <dl className="flex flex-col gap-3 text-body-sm leading-5">
          <div className="flex justify-between">
            <dt className="text-slate">{t('price')}</dt>
            <dd className="text-ink">{fcfa(payment.amount + payment.discount, locale)}</dd>
          </div>
          {payment.discount > 0 ? (
            <div className="flex justify-between">
              <dt className="font-semibold text-leaf">{payment.promoCode ?? t('promo')}</dt>
              <dd className="font-bold text-leaf">−{fcfa(payment.discount, locale)}</dd>
            </div>
          ) : null}
          {payment.fee ? (
            <div className="flex justify-between">
              <dt className="text-slate">{payment.network === CARD_NETWORK || !payment.networkName ? t('feesCard') : t('fees', { network: payment.networkName })}</dt>
              <dd className="text-ink">+{money(payment.fee, settled, locale)}</dd>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between border-t border-fog-light pt-4">
            <dt className="text-body font-bold text-ink">{t('paid')}</dt>
            <dd className="font-heading text-h3 leading-8 font-extrabold text-ink">{money(paid, settled, locale)}</dd>
          </div>
          {isFcfa(settled) ? null : <p className="text-caption leading-4 text-slate">{t('converted', { currency: settled })}</p>}
        </dl>
        <div className="flex items-center gap-3 rounded-xl bg-off-white p-3.5">
          <NetworkMark code={payment.network} name={payment.networkName} className="size-9" />
          <p className="flex flex-col gap-0.5 text-body-sm leading-5 text-ink">
            <span>{payment.network === CARD_NETWORK ? t('card') : [payment.networkName, payment.phone].filter(Boolean).join(' · ')}</span>
            <span className="text-caption leading-4 text-slate">
              {t('paidAt', { date: part(paidAt, locale, { day: 'numeric', month: 'short' }), time: timeOf(paidAt.toISOString(), locale) })}
            </span>
          </p>
        </div>
        {/* Opens in a new tab, in the browser's PDF viewer: read first, download from there. */}
        <a
          href={consultationInvoicePath(payment.id)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('flex h-12 items-center justify-center gap-2 rounded-full border-2 border-navy-deep font-heading text-body-sm font-bold text-ink', PRESS)}
        >
          <FileText aria-hidden={true} className="size-4" strokeWidth={2.5} />
          {t('invoice')}
        </a>
      </section>
    </div>
  );
}

/**
 * « Ajouter au calendrier »: a menu, each choice opening the payer's own
 * calendar on the event: Google and Outlook in a new tab, ready to save;
 * Apple Calendar (iPhone, Mac) from the .ics the site serves inline. Nothing
 * lands in Téléchargements.
 */
export function AddToCalendar({ paymentId, event }: { paymentId: string; event: CalendarEvent }): ReactNode {
  const t = useTranslations('Consultation.reservation.confirmed');
  const locale = useLocale();
  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn('flex h-13 flex-1 items-center justify-center gap-2 rounded-full bg-white px-6 font-heading text-body font-bold text-ink', PRESS)}
      >
        <CalendarPlus aria-hidden={true} className="size-4.5" strokeWidth={2.2} />
        {t('calendar')}
        <ChevronDown aria-hidden={true} className="size-4" strokeWidth={2.5} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-64 p-1.5">
        <DropdownMenuItem onClick={() => open(googleCalendarUrl(event))} className="px-3 py-2.5 text-body-sm font-semibold text-ink">
          {t('calendarGoogle')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => (window.location.href = calendarPath(paymentId, locale))} className="px-3 py-2.5 text-body-sm font-semibold text-ink">
          {t('calendarApple')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(outlookCalendarUrl(event))} className="px-3 py-2.5 text-body-sm font-semibold text-ink">
          {t('calendarOutlook')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
