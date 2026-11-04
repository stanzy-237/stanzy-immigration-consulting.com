'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { CURRENCIES, type Currency } from '@/features/invoices/lib/money';
import { useTRPC } from '@/trpc/client';

export const field =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge';
export const area =
  'w-full rounded-xl border-2 border-fog-light bg-white px-3.5 py-2.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none';
export const labelClass = 'grid gap-1 text-sm font-semibold text-navy-deep';
export const primary =
  'inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50';
export const secondary =
  'inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-navy-deep hover:bg-off-white';

/** Re-reads every Finances query (totals, lists, rates) after a change. */
export function useFinancesRefresh(): () => void {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: trpc.finances.pathKey() });
}

/** Amount, currency and day, side by side; the amount is checked by the form. */
export function AmountFields({
  ids,
  amount,
  currency,
  day,
  invalid,
  onAmount,
  onCurrency,
  onDay,
}: {
  ids: string;
  amount: string;
  currency: Currency;
  day: string;
  invalid: boolean;
  onAmount: (value: string) => void;
  onCurrency: (value: Currency) => void;
  onDay: (value: string) => void;
}): ReactNode {
  const t = useTranslations('Finances.form');
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <label htmlFor={`${ids}-amount`} className={`col-span-2 ${labelClass}`}>
          {t('amount')}
          <input
            id={`${ids}-amount`}
            inputMode="decimal"
            required={true}
            value={amount}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${ids}-amount-error` : undefined}
            onChange={(event) => onAmount(event.target.value)}
            className={field}
          />
        </label>
        <label htmlFor={`${ids}-currency`} className={labelClass}>
          {t('currency')}
          <select
            id={`${ids}-currency`}
            value={currency}
            onChange={(event) => onCurrency(event.target.value as Currency)}
            className={field}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      </div>
      {invalid ? (
        <p id={`${ids}-amount-error`} className="-mt-2 text-sm text-crimson">
          {t('invalidAmount')}
        </p>
      ) : null}
      <label htmlFor={`${ids}-day`} className={labelClass}>
        {t('day')}
        <input
          id={`${ids}-day`}
          type="date"
          required={true}
          value={day}
          onChange={(event) => onDay(event.target.value)}
          className={field}
        />
      </label>
    </>
  );
}

/** « Supprimer cette recette / charge ? » before it goes. */
export function DeleteDialog({
  title,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  title: string;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}): ReactNode {
  const t = useTranslations('Finances.row');
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{t('deleteBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={secondary}>{t('cancel')}</AlertDialogCancel>
          <button type="button" disabled={pending} onClick={onConfirm} className={primary}>
            {t('confirm')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** A Finances list loading. */
export function FinanceListSkeleton(): ReactNode {
  const t = useTranslations('Finances');
  return (
    <div role="status" className="grid gap-2">
      <span className="sr-only">{t('loading')}</span>
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} aria-hidden={true} className="h-20 rounded-2xl" />
      ))}
    </div>
  );
}
