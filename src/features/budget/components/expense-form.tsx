'use client';

import { ChevronDown } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { CURRENCY_DECIMALS, type Currency } from '@/features/budget/data/currencies';
import { MAX_EXPENSE_AMOUNT, type Expense, type ExpenseInput } from '@/features/budget/lib/budget-schema';
import { MOTIFS, type Motif } from '@/features/budget/data/motifs';
import { fromMinor, parseAmount, toMinor } from '@/features/budget/lib/money';
import { todayOf } from '@/features/parcours/lib/calendar-day';

type Draft = { name: string; motif: Motif; amount: string; date: string; note: string };

const fieldLabel = 'mb-2 block font-label font-semibold uppercase tracking-widest text-slate';
const input =
  'h-12 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-body text-navy-deep outline-none transition focus:border-rouge focus:ring-4 focus:ring-rouge/10';
const errorText = 'mt-1.5 text-caption text-crimson';

type Problems = { name?: string; amount?: string; date?: string };

/**
 * Adds or edits one Dépense, amount in the Account's currency. The same form
 * sits in the desktop sidebar and the phone drawer; remount it (with a `key`)
 * to start over.
 */
export function ExpenseForm({
  expense,
  currency,
  pending,
  error,
  onSubmit,
  onDelete,
}: {
  /** The Dépense being edited, or null to add one. */
  expense: Expense | null;
  currency: Currency;
  pending: boolean;
  /** A message to show when saving failed; the draft is kept. */
  error?: string;
  onSubmit: (input: ExpenseInput) => void;
  onDelete?: () => void;
}): ReactNode {
  const t = useTranslations('Budget');
  const format = useFormatter();
  const id = useId();
  const now = useNow();
  const [draft, setDraft] = useState<Draft>(() =>
    expense
      ? {
          name: expense.name,
          motif: expense.motif,
          amount: format.number(fromMinor(expense.amount, currency), {
            useGrouping: false,
            minimumFractionDigits: 0,
            maximumFractionDigits: CURRENCY_DECIMALS[currency],
          }),
          date: expense.date,
          note: expense.note,
        }
      : { name: '', motif: MOTIFS[0], amount: '', date: '', note: '' },
  );
  const [problems, setProblems] = useState<Problems>({});
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseAmount(draft.amount);
    const amount = parsed === null ? 0 : toMinor(parsed, currency);
    const found: Problems = {
      ...(draft.name.trim() ? {} : { name: t('form.errors.name') }),
      ...(amount > 0 && amount <= MAX_EXPENSE_AMOUNT ? {} : { amount: t('form.errors.amount') }),
      ...(!draft.date
        ? { date: t('form.errors.date') }
        : draft.date > todayOf(now)
          ? { date: t('form.errors.future') }
          : {}),
    };
    setProblems(found);
    if (found.name || found.amount || found.date) return;
    onSubmit({ name: draft.name.trim(), motif: draft.motif, amount, date: draft.date, note: draft.note.trim() });
  };

  const described = (field: keyof Problems) => (problems[field] ? `${id}-${field}-error` : undefined);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div>
        <label htmlFor={`${id}-name`} className={fieldLabel}>
          {t('form.name')}
        </label>
        <input
          id={`${id}-name`}
          type="text"
          maxLength={80}
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={t('form.namePlaceholder')}
          aria-invalid={problems.name ? true : undefined}
          aria-describedby={described('name')}
          className={input}
        />
        {problems.name && (
          <p id={`${id}-name-error`} className={errorText}>
            {problems.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${id}-motif`} className={fieldLabel}>
          {t('form.motif')}
        </label>
        <span className="relative block">
          <select
            id={`${id}-motif`}
            value={draft.motif}
            onChange={(e) => set({ motif: e.target.value as Motif })}
            className={`${input} appearance-none pr-10`}
          >
            {MOTIFS.map((motif) => (
              <option key={motif} value={motif}>
                {t(`motifs.${motif}`)}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden={true}
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate"
          />
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div>
          <label htmlFor={`${id}-amount`} className={fieldLabel}>
            {t('form.amount', { currency })}
          </label>
          <input
            id={`${id}-amount`}
            type="text"
            inputMode="decimal"
            value={draft.amount}
            onChange={(e) => set({ amount: e.target.value })}
            aria-invalid={problems.amount ? true : undefined}
            aria-describedby={described('amount')}
            className={input}
          />
          {problems.amount && (
            <p id={`${id}-amount-error`} className={errorText}>
              {problems.amount}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${id}-date`} className={fieldLabel}>
            {t('form.date')}
          </label>
          <input
            id={`${id}-date`}
            type="date"
            max={todayOf(now)}
            value={draft.date}
            onChange={(e) => set({ date: e.target.value })}
            aria-invalid={problems.date ? true : undefined}
            aria-describedby={described('date')}
            className={input}
          />
          {problems.date && (
            <p id={`${id}-date-error`} className={errorText}>
              {problems.date}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-note`} className={fieldLabel}>
          {t('form.note')}
        </label>
        <textarea
          id={`${id}-note`}
          maxLength={500}
          value={draft.note}
          onChange={(e) => set({ note: e.target.value })}
          placeholder={t('form.notePlaceholder')}
          className={`${input} h-auto min-h-20 resize-y py-3`}
        />
      </div>

      {error && (
        <p role="alert" className="text-body-sm text-crimson">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-13 w-full rounded-2xl bg-rouge font-heading text-body font-bold text-white hover:bg-crimson disabled:opacity-60"
      >
        {expense ? t('form.submitEdit') : t('form.submitAdd')}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="h-11 w-full rounded-2xl border-2 border-rose bg-transparent text-body-sm font-semibold text-rouge"
        >
          {t('form.delete')}
        </button>
      )}
    </form>
  );
}
