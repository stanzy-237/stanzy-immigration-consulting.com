'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { CreditCard, ExternalLink, Info, Lock } from 'lucide-react';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { LastPlaceSheet, MobilePromo, type AppliedPromo } from '@/features/consultation/components/promo-field';
import type { BookingRef } from '@/features/consultation/hooks/use-booking-ref';
import { toE164 } from '@/features/consultation/lib/booking';
import { countries } from '@/features/consultation/lib/countries';
import { feeFor } from '@/features/consultation/lib/payment-fees';
import { fcfa, timeOf } from '@/features/consultation/lib/slot-format';
import { PRESS } from '@/features/consultation/lib/styles';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

/** How the payer chose to pay, kept to « Réessayer » or « Renvoyer la demande » the same way. */
export type PayMethod =
  | { kind: 'network'; country: string; network: string; networkName: string; phone: string; otp?: string }
  | { kind: 'card'; country: string };

/** The fee line beside the total: the network's name and its fee, or null when only SasPay's page knows it. */
export type FeeLine = { label: string | null; amount: number | null };

/** A network's mark: MTN's yellow, Orange's orange, else its initials on navy. */
export function NetworkMark({ code, name, className }: { code: string | null; name: string | null; className?: string }): ReactNode {
  const mtn = code?.startsWith('mtn');
  const orange = code?.startsWith('orange');
  const initials = (name ?? 'SP')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return (
    <span
      aria-hidden={true}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg font-label text-caption font-extrabold',
        mtn ? 'bg-mtn text-ink' : orange ? 'bg-orange-money text-white' : 'bg-navy-deep text-white',
        className,
      )}
    >
      {mtn ? 'MTN' : orange ? 'OM' : code ? initials : <CreditCard className="size-4.5" strokeWidth={2.2} />}
    </span>
  );
}

/** Opens SasPay's page in a new tab, the way `2 Page SasPay` expects; false when the browser blocked it. */
export function openSasPay(url: string, tab?: Window | null): boolean {
  const target = tab ?? window.open('', '_blank');
  if (!target) return false;
  target.opener = null;
  target.location.href = url;
  return true;
}

const label = 'text-body-sm leading-5 font-semibold text-ink';

/**
 * Step 3, Paiement (`3 Paiement`, `3b Hors Mobile Money`, `3c Code de
 * paiement`): the networks SasPay offers in the payer's country (never a
 * fixed list), their number (from step 1), the USSD code when the network asks
 * for one, or card on SasPay's page where there is no Mobile Money. « Payer »
 * starts one payment; the page then follows it.
 */
export function PaymentStep(props: {
  bookingRef: BookingRef;
  contact: { country: string; phone: string };
  heldUntil: Date | null;
  /** The Code promo applied, and what is left to pay with it (the price without one). */
  promo: AppliedPromo | null;
  amount: number | null;
  onStarted: (paymentId: string, method: PayMethod, checkoutUrl: string | null) => void;
  onFee: (fee: FeeLine | null) => void;
  onExpired: () => void;
}): ReactNode {
  const [country, setCountry] = useState(props.contact.country);
  return (
    <QueryBoundary fallback={<PaymentSkeleton />}>
      {/* A new country starts the form afresh: its first network, the number only if it is theirs. */}
      <PaymentForm key={country} {...props} country={country} onCountry={setCountry} />
    </QueryBoundary>
  );
}

function PaymentForm({
  bookingRef,
  contact,
  heldUntil,
  onStarted,
  onFee,
  onExpired,
  promo,
  amount,
  country,
  onCountry,
}: Parameters<typeof PaymentStep>[0] & { country: string; onCountry: (country: string) => void }): ReactNode {
  const t = useTranslations('Consultation.reservation.payment');
  const locale = useLocale();
  const trpc = useTRPC();
  const id = useId();
  const [picking, setPicking] = useState(false);
  const { data } = useSuspenseQuery(trpc.consultation.paymentOptions.queryOptions({ country }));
  const all = countries(locale);
  const countryName = all.find((c) => c.code === country)?.name ?? country;
  const dial = all.find((c) => c.code === country)?.dial ?? '';

  const [chosen, setChosen] = useState<string>(data.networks[0]?.code ?? 'card');
  const network = data.networks.find((n) => n.code === chosen) ?? null;
  const ownNumber = country === contact.country ? (parsePhoneNumberFromString(contact.phone)?.formatNational() ?? '') : '';
  const [phone, setPhone] = useState(ownNumber);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<'phone' | 'otp' | 'refused' | null>(null);

  // The fee is on what is left to pay: with a Code promo, on the reduced amount.
  const toPay = amount ?? data.price ?? 0;
  const fee = network?.tiers ? feeFor(toPay, network.tiers) : (network?.fee ?? null);
  const [lastPlace, setLastPlace] = useState<{ code: string; before: string | null } | null>(null);
  const [promoEnded, setPromoEnded] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const refreshBooking = () => queryClient.invalidateQueries({ queryKey: trpc.consultation.booking.queryKey(bookingRef) });
  useEffect(() => {
    onFee(data.open ? { label: network?.name ?? null, amount: fee } : null);
  }, [data.open, network?.name, fee, onFee]);

  const pay = useMutation(trpc.consultation.pay.mutationOptions());

  if (!data.open || data.price === null) {
    return (
      <p className="rounded-xl bg-ice-blue px-4 py-3.5 text-body-sm leading-5 text-ink lg:-mt-2">
        {t('soon', { time: heldUntil ? timeOf(heldUntil.toISOString(), locale) : '' })}
      </p>
    );
  }
  const price = data.price;
  const total = fee === null ? null : toPay + fee;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    let method: PayMethod;
    // SasPay's page opens in a tab made now, in the click, so the browser doesn't block it.
    let tab: Window | null = null;
    if (network) {
      if (!toE164(phone, country)) return setError('phone');
      if (network.otpRequired && !/^\d{4,8}$/.test(otp.trim())) return setError('otp');
      method = { kind: 'network', country, network: network.code, networkName: network.name, phone, ...(network.otpRequired ? { otp: otp.trim() } : {}) };
    } else {
      if (!data.card) return;
      method = { kind: 'card', country };
      tab = window.open('', '_blank');
    }
    try {
      const started = await pay.mutateAsync({ ...bookingRef, locale: locale === 'en' ? 'en' : 'fr', method: sentMethod(method) });
      if (started.checkoutUrl) openSasPay(started.checkoutUrl, tab);
      else tab?.close();
      onStarted(started.paymentId, method, started.checkoutUrl);
    } catch (failure) {
      tab?.close();
      const code = failure instanceof TRPCClientError ? failure.message : null;
      if (code === 'HOLD_EXPIRED') return onExpired();
      if (code === 'OTP_REQUIRED') return setError('otp');
      if (code === 'PAYMENT_REFUSED' || code === 'NETWORK_UNAVAILABLE') return setError('refused');
      // The code was taken off the booking; the page shows the full price before anything is sent.
      if (code === 'PROMO_LAST_PLACE') {
        setLastPlace({ code: promo?.code ?? '', before: total === null ? fcfa(toPay, locale) : fcfa(total, locale) });
        return void refreshBooking();
      }
      if (code === 'PROMO_ENDED' || code === 'PROMO_UNKNOWN') {
        setPromoEnded(promo?.code ?? '');
        return void refreshBooking();
      }
      toast.add({ title: t('error'), type: 'error' });
    }
  }

  const fieldError = (key: 'phone' | 'otp') =>
    error === key ? (
      <p id={`${id}-${key}-error`} role="alert" className="text-caption leading-4 font-semibold text-rouge">
        {t(`errors.${key}`)}
      </p>
    ) : null;

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-1 flex-col gap-6 pb-28 lg:pb-0">
      {/* Where one pays from: the step 1 country, or another (« Payer depuis un autre pays »). */}
      <div className="flex flex-col gap-3 rounded-xl bg-off-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-body-sm leading-5 text-ink">{t.rich('country', { country: countryName, b: (c) => <b>{c}</b> })}</p>
          <button
            type="button"
            onClick={() => setPicking((open) => !open)}
            aria-expanded={picking}
            className="shrink-0 text-body-sm font-semibold text-ink underline underline-offset-2"
          >
            {t('otherCountry')}
          </button>
        </div>
        {picking ? (
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">{t('countryLabel')}</span>
            <select
              value={country}
              onChange={(e) => onCountry(e.target.value)}
              className="h-12 rounded-lg border border-fog bg-white px-3 text-body text-ink"
            >
              {all.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {data.networks.length === 0 ? (
        <>
          <div className="flex gap-3 rounded-xl bg-iris-tint px-4 py-3.5 text-iris">
            <Info aria-hidden={true} className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
            <div className="flex flex-col gap-1 text-body-sm leading-5">
              <p className="font-bold">{t('noMobileMoney', { country: countryName })}</p>
              <p>{t('noMobileMoneyLead')}</p>
            </div>
          </div>
          {data.card ? (
            <div className="flex flex-col gap-3 rounded-2xl border-2 border-navy-deep p-5">
              <div className="flex items-center gap-3">
                <span aria-hidden={true} className="size-4.5 shrink-0 rounded-full border-5 border-navy-deep bg-white" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-body leading-5.5 font-bold text-ink">{t('card')}</p>
                  <p className="text-caption leading-4 text-slate">{t('cardHint', { currency: data.card.currency })}</p>
                </div>
              </div>
              <p className="flex items-center gap-2.5 rounded-lg bg-off-white px-3.5 py-3 text-body-sm leading-5 text-slate">
                <ExternalLink aria-hidden={true} className="size-4 shrink-0" strokeWidth={2.2} />
                {t('cardSafe')}
              </p>
            </div>
          ) : (
            <p role="alert" className="rounded-xl bg-blush px-4 py-3.5 text-body-sm leading-5 text-rouge">
              {t('noWay')}
            </p>
          )}
        </>
      ) : (
        <>
          <fieldset className="flex flex-col gap-2.5">
            <legend className={cn(label, 'mb-2.5')}>{t('payWith')}</legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {data.networks.map((n) => {
                const on = n.code === chosen;
                return (
                  <label
                    key={n.code}
                    className={cn(
                      'flex cursor-pointer items-center gap-3.5 rounded-2xl bg-white p-4 transition-colors duration-150 ease-standard',
                      on ? 'border-2 border-navy-deep' : 'border border-fog-light hover:border-fog',
                    )}
                  >
                    <input type="radio" name={`${id}-network`} checked={on} onChange={() => setChosen(n.code)} className="peer sr-only" />
                    <NetworkMark code={n.code} name={n.name} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-body leading-5.5 font-bold text-ink">{n.name}</span>
                      <span className="text-caption leading-4 text-slate">{n.otpRequired ? t('withCode') : t('onPhone')}</span>
                    </span>
                    <span
                      aria-hidden={true}
                      className={cn(
                        'size-5 shrink-0 rounded-full bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-navy-deep',
                        on ? 'border-6 border-navy-deep' : 'border-2 border-fog',
                      )}
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>

          {network ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-phone`} className={label}>
                {t('number', { network: network.name })}
              </label>
              <div
                className={cn(
                  'flex h-14 items-center gap-3 rounded-xl border-2 bg-white px-4 focus-within:border-navy-deep',
                  error === 'phone' ? 'border-rouge' : 'border-fog',
                )}
              >
                <span className="border-r border-fog-light pr-3 text-body leading-5.5 font-bold text-ink">{dial}</span>
                <input
                  id={`${id}-phone`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={error === 'phone'}
                  aria-describedby={error === 'phone' ? `${id}-phone-error` : `${id}-phone-hint`}
                  className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
                />
              </div>
              {fieldError('phone') ?? (
                <p id={`${id}-phone-hint`} className="text-caption leading-4 text-slate">
                  {ownNumber && phone === ownNumber ? t('numberHint') : t('numberHintOther')}
                </p>
              )}
            </div>
          ) : null}

          {network?.otpRequired ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-off-white p-5">
              <p className="flex gap-3 text-body-sm leading-5 text-ink">
                <span aria-hidden={true} className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-orange-money text-caption font-bold text-white">
                  1
                </span>
                {network.otpInstructions || t('otpFallback')}
              </p>
              <label htmlFor={`${id}-otp`} className="flex gap-3 text-body-sm leading-5 text-ink">
                <span aria-hidden={true} className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-orange-money text-caption font-bold text-white">
                  2
                </span>
                {t('otpEnter')}
              </label>
              <input
                id={`${id}-otp`}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                aria-invalid={error === 'otp'}
                aria-describedby={error === 'otp' ? `${id}-otp-error` : undefined}
                className={cn(
                  'ml-8.5 h-14 w-56 rounded-xl border-2 bg-white px-4 font-heading text-h4 font-bold tracking-wide text-ink outline-none focus:border-navy-deep',
                  error === 'otp' ? 'border-rouge' : 'border-fog',
                )}
              />
              <div className="ml-8.5">{fieldError('otp')}</div>
            </div>
          ) : null}
        </>
      )}

      <MobilePromo bookingRef={bookingRef} promo={promo} price={price} />

      {/* Mobile: the price lines above the bottom bar (desktop: in the summary). */}
      <dl className="flex flex-col gap-2.5 text-body-sm leading-5 lg:hidden">
        <div className="flex justify-between">
          <dt className="text-slate">{t('price')}</dt>
          <dd className={cn('text-ink', promo && 'text-slate line-through')}>{fcfa(price, locale)}</dd>
        </div>
        {promo ? (
          <div className="flex justify-between">
            <dt className="text-leaf">{promo.code}</dt>
            <dd className="font-bold text-leaf">−{fcfa(promo.discount, locale)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-slate">{network ? t('feesFor', { network: network.name }) : t('fees')}</dt>
          <dd className="text-ink">{fee === null ? t('feesBySasPay') : `+${fcfa(fee, locale)}`}</dd>
        </div>
      </dl>

      {promoEnded !== null ? (
        <p role="alert" className="rounded-xl bg-honey-tint px-4 py-3.5 text-body-sm leading-5 text-honey">
          {t('promoEnded', { code: promoEnded })}
        </p>
      ) : null}

      {error === 'refused' ? (
        <p role="alert" className="rounded-xl bg-blush px-4 py-3.5 text-body-sm leading-5 text-rouge">
          {t('errors.refused')}
        </p>
      ) : null}

      {/* Mobile: total and « Payer » in the bottom bar; desktop: the button closes the step. */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-4 border-t border-fog-light bg-white px-5 pt-4 pb-6 lg:static lg:flex-col lg:items-stretch lg:border-0 lg:p-0">
        <p className="flex flex-col lg:hidden">
          <span className="text-caption leading-4 text-slate">{total === null ? t('totalBeforeFees') : t('total')}</span>
          <span className="font-heading text-h4 leading-6 font-extrabold whitespace-nowrap text-ink">{fcfa(total ?? toPay, locale)}</span>
        </p>
        <button
          type="submit"
          disabled={pay.isPending || (!network && !data.card)}
          className={cn(
            'flex h-14 flex-1 items-center justify-center gap-2.5 rounded-full bg-rouge px-6 font-heading text-body font-bold text-white hover:bg-crimson disabled:opacity-60 lg:flex-none',
            PRESS,
          )}
        >
          <Lock aria-hidden={true} className="size-4" strokeWidth={2.5} />
          <span className="lg:hidden">{t('payShort')}</span>
          <span className="hidden lg:inline">{network ? t('pay', { amount: fcfa(total ?? toPay, locale) }) : t('payCard')}</span>
        </button>
        <p className="hidden text-center text-caption leading-4 text-slate lg:block">{network ? t('fine') : t('fineCard')}</p>
      </div>
      <p className="text-caption leading-4 text-slate lg:hidden">{network ? t('fine') : t('fineCard')}</p>

      <LastPlaceSheet
        open={lastPlace !== null}
        code={lastPlace?.code ?? null}
        before={lastPlace?.before ?? null}
        total={fcfa((data.price ?? 0) + (network?.tiers ? (feeFor(data.price ?? 0, network.tiers) ?? 0) : 0), locale)}
        onClose={() => setLastPlace(null)}
        onPay={() => {
          setLastPlace(null);
          formRef.current?.requestSubmit();
        }}
      />
    </form>
  );
}

/** What `consultation.pay` takes: the method without the network's display name. */
export function sentMethod(method: PayMethod) {
  return method.kind === 'network'
    ? { kind: 'network' as const, country: method.country, network: method.network, phone: method.phone, ...(method.otp ? { otp: method.otp } : {}) }
    : { kind: 'card' as const, country: method.country };
}

/** Step 3's shape while SasPay's networks load. */
function PaymentSkeleton(): ReactNode {
  return (
    <div aria-hidden={true} className="flex flex-col gap-6">
      <Skeleton className="h-11 rounded-xl" />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Skeleton className="h-19 rounded-2xl" />
        <Skeleton className="h-19 rounded-2xl" />
      </div>
      <Skeleton className="h-14 rounded-xl" />
      <Skeleton className="h-14 rounded-full" />
    </div>
  );
}
