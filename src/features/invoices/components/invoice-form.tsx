'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Send, Trash2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useId, useState, type ReactNode } from 'react';

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
import { toast } from '@/components/ui/toast';
import type { ServiceType } from '@/features/dossiers/data/workflows';
import { useInvoiceMutation } from '@/features/invoices/hooks/use-invoice-mutation';
import {
  dossierSearchInput,
  LINE_DESCRIPTION_MAX,
  LINES_MAX,
  NOTES_MAX,
  saveInvoiceInput,
  type SaveInvoiceInput,
} from '@/features/invoices/lib/invoice-schema';
import { CURRENCIES, formatMoney, minorToInput, toMinor, type Currency } from '@/features/invoices/lib/money';
import { useTRPC } from '@/trpc/client';

const field =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge';
const label = 'mb-1.5 block text-sm font-semibold text-navy-deep';
const hint = 'mt-1 text-xs text-slate';

export type DossierOption = { id: string; service: ServiceType; account: { name: string; email: string } };

/** What the form starts from: a saved Brouillon, or a new one (maybe for a given Dossier). */
export type InvoiceDraft = {
  id?: string;
  dossier: DossierOption | null;
  currency: Currency;
  dueDate: Date | null;
  notes: string | null;
  lines: { description: string; quantity: number; unitAmount: number }[];
};

type LineState = { key: number; description: string; quantity: string; unitPrice: string };

let nextKey = 0;
const blankLine = (): LineState => ({ key: nextKey++, description: '', quantity: '1', unitPrice: '' });

/** `2026-11-15` ⇄ a Date at midnight UTC, as the due date is stored. */
const toDateInput = (date: Date | null): string => (date ? date.toISOString().slice(0, 10) : '');
const fromDateInput = (value: string): Date | null => (value ? new Date(`${value}T00:00:00Z`) : null);

/**
 * Writes a Brouillon: the Dossier, the currency, the due date, the lines and
 * the notes, with the total as it will print. « Envoyer au Client » saves
 * first, then gives it its number and emails the PDF.
 */
export function InvoiceForm({ draft }: { draft: InvoiceDraft }): ReactNode {
  const t = useTranslations('Invoices');
  const locale = useLocale();
  const ids = useId();
  const router = useRouter();
  const trpc = useTRPC();
  const { refresh, failed } = useInvoiceMutation();

  const [dossier, setDossier] = useState<DossierOption | null>(draft.dossier);
  const [currency, setCurrency] = useState<Currency>(draft.currency);
  const [dueDate, setDueDate] = useState(toDateInput(draft.dueDate));
  const [notes, setNotes] = useState(draft.notes ?? '');
  const [lines, setLines] = useState<LineState[]>(() =>
    draft.lines.length > 0
      ? draft.lines.map((line) => ({
          key: nextKey++,
          description: line.description,
          quantity: String(line.quantity),
          unitPrice: minorToInput(line.unitAmount, draft.currency),
        }))
      : [blankLine()],
  );
  const [errors, setErrors] = useState<{ dossier?: boolean; lines?: boolean }>({});
  const [confirm, setConfirm] = useState<'send' | 'delete' | null>(null);

  const save = useMutation(trpc.invoices.dashboard.save.mutationOptions({ onError: failed }));
  const send = useMutation(trpc.invoices.dashboard.send.mutationOptions({ onError: failed }));
  const remove = useMutation(
    trpc.invoices.dashboard.deleteDraft.mutationOptions({
      onSuccess: () => {
        void refresh();
        toast.add({ title: t('toast.deleted'), type: 'deleted' });
        router.push('/factures');
      },
      onError: failed,
    }),
  );
  const pending = save.isPending || send.isPending || remove.isPending;

  const parsedLines = lines.map((line) => ({
    description: line.description,
    quantity: Number.parseInt(line.quantity, 10),
    unitAmount: toMinor(line.unitPrice, currency),
  }));
  const total = parsedLines.reduce(
    (sum, line) =>
      sum + (Number.isFinite(line.quantity) && line.unitAmount !== null ? line.quantity * line.unitAmount : 0),
    0,
  );

  /** The form as the server takes it, or null after showing what's wrong. */
  const valid = (): SaveInvoiceInput | null => {
    const parsed = saveInvoiceInput.safeParse({
      id: draft.id,
      dossierId: dossier?.id ?? '',
      currency,
      dueDate: fromDateInput(dueDate),
      notes,
      lines: parsedLines,
    });
    const issues = parsed.success ? [] : parsed.error.issues.map((issue) => issue.path[0]);
    setErrors({ dossier: issues.includes('dossierId'), lines: issues.includes('lines') });
    return parsed.success ? parsed.data : null;
  };

  const saveDraft = async (): Promise<string | null> => {
    const input = valid();
    if (!input) return null;
    const { id } = await save.mutateAsync(input);
    void refresh();
    return id;
  };

  const onSave = async () => {
    const id = await saveDraft().catch(() => null);
    if (!id) return;
    toast.add({ title: t('toast.saved'), type: 'success' });
    if (!draft.id) router.push(`/factures/${id}`);
  };

  const onSend = async () => {
    setConfirm(null);
    const id = await saveDraft().catch(() => null);
    if (!id) return;
    const sent = await send.mutateAsync({ id }).catch(() => null);
    if (!sent) return;
    void refresh();
    toast.add({ title: t('toast.sent', { number: sent.number }), type: 'success' });
    if (!draft.id) router.push(`/factures/${id}`);
  };

  const updateLine = (key: number, patch: Partial<LineState>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  return (
    <div className="grid gap-5">
      <section className="grid gap-5 rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
        <DossierPicker
          id={`${ids}-dossier`}
          value={dossier}
          invalid={Boolean(errors.dossier)}
          onChange={(next) => {
            setDossier(next);
            if (next) setErrors((current) => ({ ...current, dossier: false }));
          }}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${ids}-currency`} className={label}>
              {t('editor.currency')}
            </label>
            <select
              id={`${ids}-currency`}
              className={field}
              value={currency}
              onChange={(event) => setCurrency(event.target.value as Currency)}
            >
              {CURRENCIES.map((value) => (
                <option key={value} value={value}>
                  {t(`currencies.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${ids}-due`} className={label}>
              {t('editor.dueDate')}
            </label>
            <input
              id={`${ids}-due`}
              type="date"
              className={field}
              value={dueDate}
              aria-describedby={`${ids}-due-hint`}
              onChange={(event) => setDueDate(event.target.value)}
            />
            <p id={`${ids}-due-hint`} className={hint}>
              {t('editor.dueHint')}
            </p>
          </div>
        </div>
      </section>

      <fieldset
        aria-describedby={errors.lines ? `${ids}-lines-error` : undefined}
        className="grid gap-3 rounded-2xl border border-fog-light bg-white p-5 shadow-sm"
      >
        <legend className="sr-only">{t('editor.lines')}</legend>
        <p aria-hidden={true} className="font-heading text-lg font-bold text-navy-deep">
          {t('editor.lines')}
        </p>
        <ol className="grid gap-4">
          {lines.map((line, index) => {
            const parsed = parsedLines[index]!;
            const amount =
              Number.isFinite(parsed.quantity) && parsed.unitAmount !== null
                ? parsed.quantity * parsed.unitAmount
                : null;
            return (
              <li
                key={line.key}
                aria-label={t('editor.lineNumber', { number: index + 1 })}
                className="grid gap-3 border-b border-off-white pb-4 sm:grid-cols-12 sm:items-end"
              >
                <div className="sm:col-span-6">
                  <label htmlFor={`${ids}-${line.key}-description`} className={label}>
                    {t('editor.description')}
                  </label>
                  <input
                    id={`${ids}-${line.key}-description`}
                    className={field}
                    value={line.description}
                    maxLength={LINE_DESCRIPTION_MAX}
                    onChange={(event) => updateLine(line.key, { description: event.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`${ids}-${line.key}-quantity`} className={label}>
                    {t('editor.quantity')}
                  </label>
                  <input
                    id={`${ids}-${line.key}-quantity`}
                    inputMode="numeric"
                    className={field}
                    value={line.quantity}
                    onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor={`${ids}-${line.key}-price`} className={label}>
                    {t('editor.unitPrice')}
                  </label>
                  <input
                    id={`${ids}-${line.key}-price`}
                    inputMode="decimal"
                    className={field}
                    value={line.unitPrice}
                    onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                  />
                  <p className={hint}>
                    {t('editor.lineAmount', { amount: amount === null ? '—' : formatMoney(amount, currency, locale) })}
                  </p>
                </div>
                <div className="sm:col-span-1 sm:pb-6">
                  <button
                    type="button"
                    disabled={lines.length === 1}
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                    className="inline-flex size-11 items-center justify-center rounded-full text-slate hover:text-rouge disabled:opacity-40"
                  >
                    <X aria-hidden={true} className="size-4" />
                    <span className="sr-only">{t('editor.removeLine', { number: index + 1 })}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        {errors.lines ? (
          <p id={`${ids}-lines-error`} className="text-sm text-rouge">
            {t('editor.lineError')}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={lines.length >= LINES_MAX}
            onClick={() => setLines((current) => [...current, blankLine()])}
            className="inline-flex h-11 items-center gap-1.5 rounded-full border-2 border-fog-light px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep disabled:opacity-50"
          >
            <Plus aria-hidden={true} className="size-4" />
            {t('editor.addLine')}
          </button>
          <p className="font-heading text-xl font-bold text-navy-deep">
            {t('editor.total')} <output>{formatMoney(total, currency, locale)}</output>
          </p>
        </div>
      </fieldset>

      <div className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
        <label htmlFor={`${ids}-notes`} className={label}>
          {t('editor.notes')}
        </label>
        <textarea
          id={`${ids}-notes`}
          rows={3}
          value={notes}
          maxLength={NOTES_MAX}
          aria-describedby={`${ids}-notes-hint`}
          onChange={(event) => setNotes(event.target.value)}
          className="w-full rounded-xl border-2 border-fog-light px-3 py-2 text-sm text-navy-deep focus:border-navy-deep focus:outline-none"
        />
        <p id={`${ids}-notes-hint`} className={hint}>
          {t('editor.notesHint')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void onSave()}
          className="inline-flex h-11 items-center rounded-full border-2 border-navy-deep px-5 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white disabled:opacity-50"
        >
          {t('editor.save')}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => valid() && setConfirm('send')}
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
        >
          <Send aria-hidden={true} className="size-4" />
          {t('editor.send')}
        </button>
        {draft.id ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirm('delete')}
            className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-slate hover:text-rouge disabled:opacity-50"
          >
            <Trash2 aria-hidden={true} className="size-4" />
            {t('editor.delete')}
          </button>
        ) : null}
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent className="gap-5 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">
              {confirm === 'delete' ? t('editor.deleteTitle') : t('editor.sendTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate">
              {confirm === 'delete' ? t('editor.deleteBody') : t('editor.sendBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t('editor.cancel')}</AlertDialogCancel>
            <button
              type="button"
              disabled={pending}
              onClick={() => (confirm === 'delete' ? draft.id && remove.mutate({ id: draft.id }) : void onSend())}
              className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
            >
              {confirm === 'delete' ? t('editor.confirmDelete') : t('editor.confirmSend')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Finds an open Dossier by its Client's name or email; once chosen, shows it with « Changer ». */
export function DossierPicker({
  id,
  value,
  invalid,
  onChange,
}: {
  id: string;
  value: DossierOption | null;
  invalid: boolean;
  onChange: (dossier: DossierOption | null) => void;
}): ReactNode {
  const t = useTranslations();
  const trpc = useTRPC();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());
  const searchable = dossierSearchInput.safeParse({ query: deferred }).success;
  const { data: matches, isPending } = useQuery({
    ...trpc.invoices.dashboard.searchDossiers.queryOptions({ query: deferred }),
    enabled: searchable && !value,
  });

  if (value) {
    return (
      <div>
        <p className={label}>{t('Invoices.editor.dossier')}</p>
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-navy-deep px-3.5 py-2.5">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-navy-deep">{value.account.name}</span>
            <span className="block truncate text-xs text-slate">
              {t(`Dossiers.services.${value.service}`)} · {value.account.email}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 text-sm font-semibold text-rouge hover:text-crimson"
          >
            {t('Invoices.editor.change')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className={label}>
        {t('Invoices.editor.dossier')}
      </label>
      <input
        id={id}
        type="search"
        autoComplete="off"
        className={field}
        value={query}
        placeholder={t('Invoices.editor.dossierSearch')}
        aria-invalid={invalid}
        aria-describedby={`${id}-hint`}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p id={`${id}-hint`} className={invalid ? 'mt-1 text-sm text-rouge' : hint}>
        {invalid ? t('Invoices.editor.dossierRequired') : t('Invoices.editor.dossierHint')}
      </p>
      {searchable ? (
        <div className="mt-2">
          {isPending ? (
            <div role="status">
              <span className="sr-only">{t('Invoices.editor.loadingDossiers')}</span>
              <Skeleton aria-hidden={true} className="h-12 rounded-xl" />
            </div>
          ) : matches && matches.length > 0 ? (
            <ul className="grid gap-1.5">
              {matches.map((match) => (
                <li key={match.id}>
                  <button
                    type="button"
                    onClick={() => onChange(match)}
                    className="flex w-full flex-col rounded-xl border border-fog-light px-3.5 py-2 text-left hover:border-navy-deep"
                  >
                    <span className="truncate text-sm font-semibold text-navy-deep">{match.account.name}</span>
                    <span className="truncate text-xs text-slate">
                      {t(`Dossiers.services.${match.service}`)} · {match.account.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate">{t('Invoices.editor.noMatch')}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
