'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { CURRENCIES, DEFAULT_CURRENCY, type Currency } from '@/features/budget/data/currencies';
import { SelectField } from '@/features/shared/components/calculator-fields';

/**
 * Picks the journal's currency: on first use, with XAF preselected, or later
 * from the settings row, with the warning that nothing is converted.
 */
export function CurrencyDialog({
  open,
  onOpenChange,
  current,
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The Account's currency, or null on first use. */
  current: Currency | null;
  pending: boolean;
  error?: string;
  onConfirm: (currency: Currency) => void;
}): ReactNode {
  const t = useTranslations('Budget');
  const first = current === null;
  const [choice, setChoice] = useState<Currency>(current ?? DEFAULT_CURRENCY);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-5 bg-white p-6 sm:max-w-md">
        <div className="space-y-2">
          <DialogTitle className="font-heading text-xl font-bold text-navy-deep">
            {first ? t('currencyDialog.firstTitle') : t('currencyDialog.changeTitle')}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate">
            {t('currencyDialog.firstText')}
          </DialogDescription>
        </div>
        <SelectField<Currency>
          label={t('currencyDialog.currency')}
          value={choice}
          options={CURRENCIES.map((code) => ({ value: code, label: t(`currencies.${code}`) }))}
          onChange={setChoice}
        />
        {!first && (
          <p className="flex gap-2.5 rounded-xl border border-rose bg-blush p-3.5 text-body-sm text-navy-deep">
            <TriangleAlert aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-rouge" />
            {t('currencyDialog.warning')}
          </p>
        )}
        {error && (
          <p role="alert" className="text-body-sm text-crimson">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-full border-2 border-fog-light px-5 text-body-sm font-semibold text-navy-deep"
          >
            {t('currencyDialog.cancel')}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onConfirm(choice)}
            className="h-11 rounded-full bg-rouge px-6 text-body-sm font-semibold text-white hover:bg-crimson disabled:opacity-60"
          >
            {t('currencyDialog.confirm')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
