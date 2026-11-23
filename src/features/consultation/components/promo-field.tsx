'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { Check, CircleAlert, Plus, Tag, X } from 'lucide-react';
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { toast } from '@/components/ui/toast';
import type { BookingRef } from '@/features/consultation/hooks/use-booking-ref';
import { fcfa } from '@/features/consultation/lib/slot-format';
import { PRESS } from '@/features/consultation/lib/styles';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

export type AppliedPromo = NonNullable<RouterOutputs['consultation']['booking']['promo']>;

type PromoErrorKey = 'unknown' | 'ended' | 'soldOut' | 'used' | 'service';
const ERROR_KEYS: Record<string, PromoErrorKey> = {
  PROMO_UNKNOWN: 'unknown',
  PROMO_ENDED: 'ended',
  PROMO_SOLD_OUT: 'soldOut',
  PROMO_USED: 'used',
  PROMO_NOT_FOR_SERVICE: 'service',
};

/** « −70 % » or « −5 000 FCFA ». */
export function useReduction(): (promo: Pick<AppliedPromo, 'reductionType' | 'reductionValue'>) => string {
  const locale = useLocale();
  return (promo) => (promo.reductionType === 'PERCENT' ? `−${promo.reductionValue} %` : `−${fcfa(promo.reductionValue, locale)}`);
}

/** « Plus que 7 places sur 20 · valable jusqu'au 27 nov. », whatever of it applies. */
function useLimits(): (promo: AppliedPromo) => string | null {
  const t = useTranslations('Consultation.reservation.promo');
  const format = useFormatter();
  return (promo) => {
    const parts = [
      promo.placesLeft !== null && promo.places !== null ? t('left', { left: promo.placesLeft, places: promo.places }) : null,
      promo.endsAt ? t('until', { date: format.dateTime(new Date(promo.endsAt), { day: 'numeric', month: 'short', timeZone: 'Africa/Douala' }) }) : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  };
}

/** Applying and removing the booking's code; every change refreshes the booking (price lines, total). */
function usePromo(bookingRef: BookingRef) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const tToast = useTranslations('Consultation.reservation.toast');
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.consultation.booking.queryKey(bookingRef) });
  const [error, setError] = useState<{ key: PromoErrorKey; suggestion: string | null } | null>(null);
  const apply = useMutation(
    trpc.consultation.applyPromo.mutationOptions({
      onSuccess: async () => {
        setError(null);
        await refresh();
      },
      onError: (failure) => {
        const [code = '', suggestion = null] = failure instanceof TRPCClientError ? failure.message.split(':') : [];
        const key = ERROR_KEYS[code];
        if (key) setError({ key, suggestion });
        else toast.add({ title: tToast('error'), type: 'error' });
      },
    }),
  );
  const remove = useMutation(
    trpc.consultation.removePromo.mutationOptions({
      onSuccess: () => void refresh(),
      onError: () => toast.add({ title: tToast('error'), type: 'error' }),
    }),
  );
  return { apply, remove, error, clearError: () => setError(null) };
}

/**
 * The code field: a tag, the code in capitals, « Appliquer ». Each refusal
 * has its own message, which fades in with a 4 px lift; the field shakes
 * once when « Appliquer » is refused (docs/design/consultation-motion.md,
 * « Promo error »). An unknown code offers the one it most likely meant.
 */
function PromoForm({ bookingRef, price, onApplied, autoFocus = false }: { bookingRef: BookingRef; price: number | null; onApplied?: () => void; autoFocus?: boolean }): ReactNode {
  const t = useTranslations('Consultation.reservation.promo');
  const locale = useLocale();
  const id = useId();
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate();
  const [code, setCode] = useState('');
  const { apply, error, clearError } = usePromo(bookingRef);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) return;
    try {
      await apply.mutateAsync({ ...bookingRef, code });
      setCode('');
      onApplied?.();
    } catch {
      if (!reduce && scope.current) void animate(scope.current, { x: [0, -4, 4, -4, 4, 0] }, { duration: 0.3 });
    }
  }

  const b = (chunks: ReactNode) => <b className="font-bold">{chunks}</b>;
  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <div className="flex gap-2">
        <div
          ref={scope}
          className={cn(
            'flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl border-2 bg-white px-3.5 focus-within:border-navy-deep',
            error ? 'border-rouge' : 'border-fog',
          )}
        >
          <Tag aria-hidden={true} className="size-4 shrink-0 text-ink" strokeWidth={2.2} />
          <label htmlFor={`${id}-code`} className="sr-only">
            {t('label')}
          </label>
          <input
            id={`${id}-code`}
            value={code}
            autoFocus={autoFocus}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={t('placeholder')}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              clearError();
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            className="min-w-0 flex-1 bg-transparent font-heading text-body font-bold tracking-wide text-ink uppercase outline-none placeholder:font-body placeholder:font-normal placeholder:tracking-normal placeholder:normal-case placeholder:text-slate-mute"
          />
          {code ? (
            <button
              type="button"
              onClick={() => {
                setCode('');
                clearError();
              }}
              aria-label={t('clear')}
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ice-blue"
            >
              <X aria-hidden={true} className="size-3 text-ink" strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={apply.isPending || !code.trim()}
          className={cn('h-12 shrink-0 rounded-xl bg-navy-deep px-4 font-heading text-body-sm font-bold text-white disabled:opacity-60', PRESS)}
        >
          {t('apply')}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            key={error.key}
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, y: reduce ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn('flex gap-2 text-caption leading-4.5', error.key === 'soldOut' || error.key === 'ended' ? 'text-honey' : 'text-rouge')}
          >
            <CircleAlert aria-hidden={true} className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} />
            <span>
              {error.key === 'unknown' && error.suggestion ? (
                <>
                  {t.rich('errors.unknownSuggest', { b })}{' '}
                  <button type="button" onClick={() => setCode(error.suggestion!)} className="font-bold underline underline-offset-2">
                    {error.suggestion}
                  </button>{' '}
                  ?
                </>
              ) : (
                t.rich(`errors.${error.key}`, { b, price: price === null ? '' : fcfa(price, locale) })
              )}
            </span>
          </motion.p>
        ) : null}
      </AnimatePresence>
    </form>
  );
}

/**
 * Desktop: the code in the summary card. Without one, « Vous avez un code
 * promo ? » opens the field; applied, a dashed green chip with ×, and its
 * places left and end. The row enters at auto height (200 ms, row « Promo
 * applied / removed »).
 */
export function SummaryPromo({ bookingRef, promo, price }: { bookingRef: BookingRef; promo: AppliedPromo | null; price: number | null }): ReactNode {
  const t = useTranslations('Consultation.reservation.promo');
  const locale = useLocale();
  const reduction = useReduction();
  const limits = useLimits();
  const [open, setOpen] = useState(false);
  const { remove } = usePromo(bookingRef);

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {promo ? (
        <motion.div
          key="applied"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex flex-col gap-2 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 rounded-full border border-dashed border-leaf bg-leaf-tint py-1 pr-1.5 pl-3 font-label text-caption leading-4 font-bold text-leaf">
              <Tag aria-hidden={true} className="size-3" strokeWidth={2.5} />
              {promo.code} · {reduction(promo)}
              <button
                type="button"
                onClick={() => remove.mutate(bookingRef)}
                aria-label={t('remove', { code: promo.code })}
                className="flex size-5 items-center justify-center rounded-full hover:bg-leaf/10"
              >
                <X aria-hidden={true} className="size-3" strokeWidth={2.8} />
              </button>
            </span>
            <span className="text-body-sm leading-5 font-bold whitespace-nowrap text-leaf">−{fcfa(promo.discount, locale)}</span>
          </div>
          {limits(promo) ? (
            <p className="flex items-center gap-2 text-caption leading-4 text-slate">
              <span aria-hidden={true} className="size-1.5 shrink-0 rounded-full bg-rouge" />
              {limits(promo)}
            </p>
          ) : null}
        </motion.div>
      ) : open ? (
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <PromoForm bookingRef={bookingRef} price={price} autoFocus={true} onApplied={() => setOpen(false)} />
        </motion.div>
      ) : (
        <button
          key="ask"
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 self-start text-body-sm font-semibold text-ink underline underline-offset-2"
        >
          <Tag aria-hidden={true} className="size-3.5" strokeWidth={2.2} />
          {t('ask')}
        </button>
      )}
    </AnimatePresence>
  );
}

/**
 * Mobile: a row « Ajouter un code promo » opening the promo sheet (`3a`);
 * applied, the green card with « Retirer » (`Code promo · appliqué`).
 */
export function MobilePromo({ bookingRef, promo, price }: { bookingRef: BookingRef; promo: AppliedPromo | null; price: number | null }): ReactNode {
  const t = useTranslations('Consultation.reservation.promo');
  const reduction = useReduction();
  const limits = useLimits();
  const [open, setOpen] = useState(false);
  const { remove } = usePromo(bookingRef);

  return (
    <div className="lg:hidden">
      {promo ? (
        <div className="flex items-center gap-3.5 rounded-2xl border border-dashed border-leaf bg-leaf-tint p-4">
          <span aria-hidden={true} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-leaf">
            <Check className="size-4.5 text-white" strokeWidth={3} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="font-label text-body-sm leading-5 font-extrabold text-leaf">
              {promo.code} · {reduction(promo)}
            </p>
            {limits(promo) ? <p className="text-caption leading-4 text-leaf">{limits(promo)}</p> : null}
          </div>
          <button type="button" onClick={() => remove.mutate(bookingRef)} className="text-body-sm font-bold text-leaf underline underline-offset-2">
            {t('removeShort')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn('flex w-full items-center gap-2.5 rounded-xl border border-dashed border-fog px-4 py-3.5 text-body-sm font-semibold text-ink', PRESS)}
        >
          <Plus aria-hidden={true} className="size-4" strokeWidth={2.5} />
          {t('ask')}
        </button>
      )}
      <Drawer open={open} onOpenChange={setOpen} showSwipeHandle={true}>
        <DrawerContent className="rounded-t-3xl px-5 pt-2 pb-8 lg:hidden">
          <div className="flex items-center justify-between py-4">
            <DrawerTitle className="font-heading text-h4 font-bold text-ink">{t('sheetTitle')}</DrawerTitle>
            <DrawerClose aria-label={t('close')} className="flex size-9 items-center justify-center rounded-full bg-off-white">
              <X aria-hidden={true} className="size-4 text-ink" strokeWidth={2.5} />
            </DrawerClose>
          </div>
          <PromoForm bookingRef={bookingRef} price={price} autoFocus={true} onApplied={() => setOpen(false)} />
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/**
 * `3d Dernière place partie`: just before paying, the code's last place went
 * to someone else. Nothing was charged; the booking is back at full price and
 * one tap pays that, or they close and change their mind.
 */
export function LastPlaceSheet({
  open,
  code,
  before,
  total,
  onPay,
  onClose,
}: {
  open: boolean;
  code: string | null;
  /** What it would have been with the code. */
  before: string | null;
  /** The full price (and fee) now. */
  total: string;
  onPay: () => void;
  onClose: () => void;
}): ReactNode {
  const t = useTranslations('Consultation.reservation.promo.lastPlace');
  const b = (chunks: ReactNode) => <b className="font-bold text-ink">{chunks}</b>;
  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} showSwipeHandle={true}>
      <DrawerContent className="rounded-t-3xl px-5 pt-2 pb-8 lg:mx-auto lg:max-w-lg">
        <div className="flex items-center justify-between py-4">
          <DrawerTitle className="font-heading text-h4 font-bold text-ink">{t('title')}</DrawerTitle>
          <DrawerClose aria-label={t('close')} className="flex size-9 items-center justify-center rounded-full bg-off-white">
            <X aria-hidden={true} className="size-4 text-ink" strokeWidth={2.5} />
          </DrawerClose>
        </div>
        <p className="pb-5 text-body leading-6 text-slate">{t.rich('lead', { code: code ?? '', b })}</p>
        <div className="mb-5 flex flex-col gap-2 rounded-xl bg-ice-blue p-4 text-body-sm leading-5">
          {before ? (
            <p className="flex justify-between text-slate">
              <span>{t('with', { code: code ?? '' })}</span>
              <span className="line-through">{before}</span>
            </p>
          ) : null}
          <p className="flex justify-between text-ink">
            <span>{t('now')}</span>
            <span className="font-heading text-body font-extrabold">{total}</span>
          </p>
        </div>
        <button type="button" onClick={onPay} className={cn('h-14 w-full rounded-full bg-navy-deep font-heading text-body font-bold text-white', PRESS)}>
          {t('pay', { total })}
        </button>
      </DrawerContent>
    </Drawer>
  );
}
