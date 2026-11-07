'use client';

import { FileSignature, ReceiptText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SCHEDULE_MAX } from '@/features/contracts/lib/contract-schema';
import { amountFor } from '@/features/document-services/lib/service-schema';

export type Terms = { locale: 'fr' | 'en'; amount: number; schedule: string };

const field =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none';

/**
 * The terms the consultant sends a service's Contrat with: the Client's
 * language, the price (a percentage service needs the amount worked out from
 * the funds to justify) and the échéancier; the same amount joins the draft
 * invoice. For taking a request on, or approving an order (#80).
 */
export function TermsDialog({
  service,
  description,
  pending,
  initialLocale,
  onSubmit,
  onClose,
}: {
  service: { priceKind: 'FIXED' | 'PERCENT'; price: number };
  description: (locale: 'fr' | 'en') => string;
  pending: boolean;
  initialLocale?: 'fr' | 'en';
  onSubmit: (terms: Terms) => void;
  onClose: () => void;
}): ReactNode {
  const t = useTranslations('Accompagnement.stanzy');
  const ids = useId();
  const locale = useLocale();
  const suggested = amountFor(service);
  const [lang, setLang] = useState<'fr' | 'en'>(initialLocale ?? (locale === 'en' ? 'en' : 'fr'));
  const [amount, setAmount] = useState(suggested === null ? '' : String(suggested));
  const [base, setBase] = useState('');
  const [schedule, setSchedule] = useState(t('defaultSchedule'));
  const [invalid, setInvalid] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(amount.replace(/\s/g, ''));
    const ok = Number.isInteger(value) && value > 0 && schedule.trim().length > 0;
    setInvalid(!ok);
    if (ok) onSubmit({ locale: lang, amount: value, schedule: schedule.trim() });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg gap-4 p-6">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('acceptTitle')}</DialogTitle>
          <DialogDescription className="text-sm text-slate">{description(lang)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4">
          <label htmlFor={`${ids}-lang`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
            {t('language')}
            <select id={`${ids}-lang`} value={lang} onChange={(event) => setLang(event.target.value as 'fr' | 'en')} className={field}>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </label>
          {service.priceKind === 'PERCENT' ? (
            <label htmlFor={`${ids}-base`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
              {t('base')}
              <input
                id={`${ids}-base`}
                inputMode="numeric"
                value={base}
                onChange={(event) => {
                  setBase(event.target.value);
                  const value = Number(event.target.value.replace(/\s/g, ''));
                  const computed = Number.isFinite(value) ? amountFor(service, value) : null;
                  if (computed !== null) setAmount(String(computed));
                }}
                className={field}
              />
            </label>
          ) : null}
          <label htmlFor={`${ids}-amount`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
            {t('amount')}
            <input
              id={`${ids}-amount`}
              inputMode="numeric"
              value={amount}
              aria-invalid={invalid && !(Number(amount) > 0)}
              onChange={(event) => setAmount(event.target.value)}
              className={field}
            />
          </label>
          <label htmlFor={`${ids}-schedule`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
            {t('schedule')}
            <input
              id={`${ids}-schedule`}
              maxLength={SCHEDULE_MAX}
              value={schedule}
              onChange={(event) => setSchedule(event.target.value)}
              className={field}
            />
          </label>
          {invalid ? (
            <p role="alert" className="text-sm font-medium text-rouge">
              {t('acceptInvalid')}
            </p>
          ) : null}
          <p className="flex items-start gap-2 rounded-xl bg-off-white px-3 py-2.5 text-xs text-slate">
            <ReceiptText aria-hidden={true} className="mt-0.5 size-4 shrink-0" />
            {t('acceptInvoice')}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className="h-11 rounded-full px-4 text-sm font-semibold text-navy-deep hover:bg-off-white">
              {t('keep')}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
            >
              <FileSignature aria-hidden={true} className="size-4" />
              {pending ? t('accepting') : t('acceptConfirm')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
