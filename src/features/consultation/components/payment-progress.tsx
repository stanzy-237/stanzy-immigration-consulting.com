'use client';

import { Check, ExternalLink, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { OnTheWayIllustration, RefusedIllustration, SecurePageIllustration, VerifyingIllustration } from '@/features/consultation/components/payment-illustrations';
import { PhoneIllustration } from '@/features/consultation/components/step-illustrations';
import { useHoldCountdown } from '@/features/consultation/hooks/use-hold-countdown';
import { isFcfa } from '@/features/consultation/lib/money';
import { CARD_NETWORK } from '@/features/consultation/lib/payment';
import { fcfa, timeOf } from '@/features/consultation/lib/slot-format';
import { PRESS } from '@/features/consultation/lib/styles';
import { FOOTER_SOCIALS } from '@/features/landing/data/footer';
import { cn } from '@/lib/utils';
import type { RouterOutputs } from '@/trpc/types';

export type PaymentView = RouterOutputs['consultation']['payment'];

/** Still PENDING after this long: « C'est plus long que prévu ». */
export const SLOW_MS = 3 * 60 * 1000;

/** Which screen a payment shows: `Paiement v2` 1 to 5 (6 Confirmée is its own page). */
export type PaymentScreen = 'phone' | 'page' | 'verifying' | 'failed' | 'slow';

export function paymentScreen(payment: PaymentView, { returned = false, now = Date.now() } = {}): PaymentScreen {
  if (payment.status === 'FAILED') return 'failed';
  if (now - new Date(payment.createdAt).getTime() > SLOW_MS) return 'slow';
  if (returned) return 'verifying';
  if (payment.checkoutUrl) return 'page';
  // Card without a page to open (SasPay's sandbox settles it at once): nothing to do on a phone.
  return payment.network === CARD_NETWORK ? 'verifying' : 'phone';
}

const WHATSAPP = FOOTER_SOCIALS.find((s) => s.key === 'whatsapp')?.href ?? null;

type Row = { state: 'done' | 'current' | 'failed' | 'next'; text: string; side?: ReactNode };

/** The payment's three steps: done (green check), current (turning), failed (rouge cross), next (empty ring). */
function Timeline({ rows }: { rows: Row[] }): ReactNode {
  return (
    <ol className="flex flex-col gap-1">
      {rows.map((row) => (
        <li key={row.text} className="flex min-h-11 items-center gap-3.5">
          {row.state === 'done' ? (
            <span aria-hidden={true} className="flex size-6 shrink-0 items-center justify-center rounded-full bg-leaf">
              <Check className="size-3.5 text-white" strokeWidth={3} />
            </span>
          ) : row.state === 'failed' ? (
            <span aria-hidden={true} className="flex size-6 shrink-0 items-center justify-center rounded-full bg-rouge">
              <X className="size-3.5 text-white" strokeWidth={3} />
            </span>
          ) : row.state === 'current' ? (
            <svg aria-hidden={true} viewBox="0 0 24 24" className="size-6 shrink-0 animate-spin">
              <circle cx="12" cy="12" r="9.5" fill="none" className="stroke-honey-tint" strokeWidth="3" />
              <path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5" fill="none" className="stroke-honey" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <span aria-hidden={true} className="size-6 shrink-0 rounded-full border-2 border-fog" />
          )}
          <span
            className={cn(
              'flex-1 text-body-sm leading-5.5 lg:text-body',
              row.state === 'next' ? 'text-slate-mute' : row.state === 'done' ? 'text-slate' : 'font-bold text-ink',
            )}
          >
            {row.text}
            {row.state === 'current' ? <span className="sr-only">…</span> : null}
          </span>
          {row.side}
        </li>
      ))}
    </ol>
  );
}

const pill = (tone: 'honey' | 'leaf', children: ReactNode) => (
  <span
    className={cn(
      'shrink-0 rounded-full px-2.5 py-1 font-label text-caption leading-4 font-bold tabular-nums',
      tone === 'honey' ? 'bg-honey-tint text-honey' : 'bg-leaf-tint text-leaf',
    )}
  >
    {children}
  </span>
);

const button = 'flex h-13 items-center justify-center gap-2 rounded-full px-6 font-heading text-body font-bold';

/**
 * The payment followed (`Paiement v2` 1–5): an illustration and a message,
 * the three steps, what to do. Validez sur le téléphone (a push) or Finissez
 * sur la page SasPay keep turning until SasPay answers; Vérification once
 * SasPay sent them back; Refusé with « Réessayer »; C'est plus long que prévu
 * after a few minutes, with « Vérifier maintenant ». Never « paid » before
 * SasPay said `SUCCESS`. Desktop: a panel in step 3; mobile: its own screen.
 */
export function PaymentProgress({
  payment,
  screen,
  heldUntil,
  onRetry,
  onChangeMethod,
  onCheckNow,
  checking = false,
}: {
  payment: PaymentView;
  screen: PaymentScreen;
  heldUntil: Date | null;
  /** « Réessayer », « Renvoyer la demande »: the same way again; absent when it can't be (a code to type again). */
  onRetry?: () => void;
  onChangeMethod?: () => void;
  onCheckNow?: () => void;
  checking?: boolean;
}): ReactNode {
  const t = useTranslations('Consultation.reservation.progress');
  const locale = useLocale();
  const countdown = useHoldCountdown(heldUntil);
  const network = payment.networkName ?? 'SasPay';
  // SasPay's fee is known once it answered, and only adds up when it is in FCFA too.
  const total = fcfa(payment.amount + (payment.fee !== null && isFcfa(payment.settledCurrency) ? payment.fee : 0), locale);
  const startedAt = timeOf(new Date(payment.createdAt).toISOString(), locale);
  const held = heldUntil ? timeOf(heldUntil.toISOString(), locale) : null;
  const b = (chunks: ReactNode) => <b className="font-bold text-ink">{chunks}</b>;

  const content: Record<PaymentScreen, { art: ReactNode; title: string; lead: ReactNode; rows: Row[]; help: string; tint?: string }> = {
    phone: {
      art: <PhoneIllustration playing={true} className="size-full" />,
      title: t('phone.title'),
      lead: t.rich('phone.lead', { amount: total, phone: payment.phone ?? '', network, b }),
      rows: [
        { state: 'done', text: t('sent', { network }), side: <span className="text-caption text-slate tabular-nums">{startedAt}</span> },
        { state: 'current', text: t('phone.validating'), side: heldUntil ? pill('honey', t('expires', { time: countdown.text })) : null },
        { state: 'next', text: t('confirms') },
      ],
      help: t('phone.help'),
    },
    page: {
      art: <SecurePageIllustration className="size-full" />,
      title: t('page.title'),
      lead: t.rich(payment.network === CARD_NETWORK ? 'page.leadCard' : 'page.lead', { amount: total, network, b }),
      rows: [
        { state: 'done', text: t('page.opened'), side: <span className="text-caption text-slate tabular-nums">{startedAt}</span> },
        { state: 'current', text: t('page.paying'), side: held ? pill('honey', t('page.held', { time: held })) : null },
        { state: 'next', text: t('confirms') },
      ],
      help: t('page.help'),
    },
    verifying: {
      art: <VerifyingIllustration className="size-full" />,
      title: t('verifying.title'),
      lead: t.rich('verifying.lead', { network, b }),
      rows: [
        { state: 'done', text: t('verifying.done') },
        { state: 'current', text: t('verifying.checking', { network }), side: pill('honey', t('verifying.seconds')) },
        { state: 'next', text: t('verifying.confirmed') },
      ],
      help: t('verifying.help'),
    },
    failed: {
      art: <RefusedIllustration className="size-full" />,
      title: t('failed.title'),
      lead: held
        ? t.rich(payment.network === CARD_NETWORK ? 'failed.leadCard' : 'failed.lead', { network, time: held, b })
        : t.rich('failed.leadReleased', { b }),
      rows: [
        { state: 'done', text: payment.checkoutUrl ? t('page.opened') : t('sent', { network }), side: <span className="text-caption text-slate tabular-nums">{startedAt}</span> },
        { state: 'failed', text: t('failed.step'), side: pill('leaf', t('failed.nothing')) },
      ],
      help: t('failed.help'),
      tint: 'bg-blush',
    },
    slow: {
      art: <OnTheWayIllustration className="size-full" />,
      title: t('slow.title'),
      lead: t.rich('slow.lead', { amount: total, network, b }),
      rows: [
        { state: 'done', text: payment.checkoutUrl ? t('page.opened') : t('sent', { network }), side: <span className="text-caption text-slate tabular-nums">{startedAt}</span> },
        { state: 'current', text: t('slow.waiting', { network }), side: pill('honey', t('slow.held')) },
      ],
      help: t('slow.help', { network }),
    },
  };
  const { art, title, lead, rows, help } = content[screen];

  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      <motion.div
        key={screen}
        initial={screen === 'failed' || screen === 'slow' ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex flex-col items-center gap-5 text-center lg:flex-row lg:items-center lg:gap-8 lg:rounded-2xl lg:bg-off-white lg:p-8 lg:text-left"
      >
        <div className="size-36 shrink-0 lg:size-33">{art}</div>
        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-h3 leading-8.5 font-extrabold tracking-tight text-ink">{title}</h3>
          <p className="text-body leading-6 text-slate">{lead}</p>
        </div>
      </motion.div>

      <Timeline rows={rows} />

      <div className="flex flex-col gap-4 border-t border-fog-light pt-5">
        <p className="text-body-sm leading-5 text-slate">{help}</p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {screen === 'phone' && onRetry ? (
            <button type="button" onClick={onRetry} className={cn(button, 'border-2 border-navy-deep text-ink lg:flex-1', PRESS)}>
              {t('phone.resend')}
            </button>
          ) : null}
          {screen === 'page' && payment.checkoutUrl ? (
            <a
              href={payment.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(button, 'border-2 border-navy-deep text-ink lg:flex-1', PRESS)}
            >
              {t('page.reopen')}
              <ExternalLink aria-hidden={true} className="size-4" strokeWidth={2.5} />
            </a>
          ) : null}
          {screen === 'failed' && onRetry ? (
            <button type="button" onClick={onRetry} className={cn(button, 'bg-rouge text-white hover:bg-crimson lg:flex-1', PRESS)}>
              {t('failed.retry', { amount: total })}
            </button>
          ) : null}
          {screen === 'slow' && onCheckNow ? (
            <button
              type="button"
              onClick={onCheckNow}
              disabled={checking}
              className={cn(button, 'border-2 border-navy-deep text-ink disabled:opacity-60 lg:flex-1', PRESS)}
            >
              {t('slow.check')}
            </button>
          ) : null}
          {screen === 'slow' && WHATSAPP ? (
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="text-center text-body-sm font-semibold text-ink underline underline-offset-2 lg:flex-1">
              {t('slow.whatsapp')}
            </a>
          ) : onChangeMethod && screen !== 'verifying' && screen !== 'slow' ? (
            <button type="button" onClick={onChangeMethod} className="text-center text-body-sm font-semibold text-ink underline underline-offset-2 lg:flex-1">
              {t('change')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
