'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Paperclip, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { DOCUMENT_FILE_TYPES } from '@/features/dossiers/lib/document-schema';
import {
  AmountFields,
  area,
  DeleteDialog,
  field,
  FinanceListSkeleton,
  labelClass,
  primary,
  secondary,
  useFinancesRefresh,
} from '@/features/finances/components/finance-fields';
import { FinancesHeader } from '@/features/finances/components/finances-header';
import { useFinanceErrors } from '@/features/finances/hooks/use-finance-errors';
import { NOTE_MAX } from '@/features/finances/lib/finance-schema';
import { receiptUrl, uploadReceipt } from '@/features/finances/lib/finance-urls';
import { DossierPicker, type DossierOption } from '@/features/shared/components/dossier-picker';
import { formatMoney, minorToInput, toMinor, type Currency } from '@/features/invoices/lib/money';
import { doualaDay } from '@/features/notifications/lib/douala-days';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Charge = RouterOutputs['finances']['charges']['list'][number];

// What a receipt can be: what Documents accept (photos from a phone included).
const ACCEPT = [...DOCUMENT_FILE_TYPES, '.heic', '.heif'].join(',');

/** Finances' Charges (#95): the practice's expenses, monthly ones repeating by themselves. */
export function ChargesView({ year }: { year: number }): ReactNode {
  const t = useTranslations('Finances');
  const [editing, setEditing] = useState<Charge | 'new' | null>(null);
  return (
    <div className="mx-auto grid grid-cols-1 max-w-5xl gap-6">
      <FinancesHeader page="charges" year={year} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate">{t('charges.intro')}</p>
        <button type="button" onClick={() => setEditing('new')} className={primary}>
          <Plus aria-hidden={true} className="size-4" />
          {t('charges.add')}
        </button>
      </div>
      <QueryBoundary fallback={<FinanceListSkeleton />}>
        <ChargeList year={year} onEdit={setEditing} />
      </QueryBoundary>
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent showCloseButton={false} className="max-h-dvh gap-4 overflow-y-auto p-6 sm:max-w-lg">
          {editing !== null ? (
            <QueryBoundary fallback={<FinanceListSkeleton />}>
              <ChargeForm charge={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
            </QueryBoundary>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChargeList({ year, onEdit }: { year: number; onEdit: (charge: Charge) => void }): ReactNode {
  const t = useTranslations('Finances');
  const format = useFormatter();
  const locale = useLocale();
  const trpc = useTRPC();
  const refresh = useFinancesRefresh();
  const failed = useFinanceErrors();
  const { data: charges } = useSuspenseQuery(trpc.finances.charges.list.queryOptions({ year }));
  const [deleting, setDeleting] = useState<Charge | null>(null);
  const remove = useMutation(
    trpc.finances.charges.delete.mutationOptions({
      onSuccess: () => {
        refresh();
        setDeleting(null);
        toast.add({ title: t('toast.chargeDeleted'), type: 'success' });
      },
      onError: failed,
    }),
  );

  if (charges.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-10 text-center text-sm text-slate">
        {t('charges.empty', { year })}
      </p>
    );
  }
  return (
    <>
      <ul className="grid grid-cols-1 gap-2">
        {charges.map((charge) => {
          const label = charge.category.name;
          return (
            <li
              key={charge.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fog-light bg-white p-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-navy-deep">{label}</span>
                  {charge.repeatsMonthly ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ice-blue px-2.5 py-0.5 text-xs font-semibold text-navy-deep">
                      <Repeat aria-hidden={true} className="size-3" />
                      {t('charges.monthly')}
                    </span>
                  ) : charge.repeatOfId ? (
                    <span className="rounded-full bg-fog-light px-2.5 py-0.5 text-xs font-semibold text-slate">
                      {t('charges.copy')}
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-sm text-slate">
                  {format.dateTime(new Date(`${charge.day}T00:00:00Z`), {
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'UTC',
                  })}
                  {charge.dossier ? ` · ${charge.dossier.account.name}` : ''}
                  {charge.note ? ` · ${charge.note}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="mr-2 font-semibold text-navy-deep tabular-nums">
                  {formatMoney(charge.amount, charge.currency, locale)}
                </span>
                {charge.receiptFileName ? (
                  <a
                    href={receiptUrl(charge.id)}
                    target="_blank"
                    rel="noopener"
                    aria-label={t('charges.openReceipt', { label })}
                    className="inline-flex size-10 items-center justify-center rounded-full text-navy-deep hover:bg-off-white"
                  >
                    <Paperclip aria-hidden={true} className="size-4" />
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => onEdit(charge)}
                  aria-label={t('row.editLabel', { label })}
                  className="inline-flex size-10 items-center justify-center rounded-full text-navy-deep hover:bg-off-white"
                >
                  <Pencil aria-hidden={true} className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(charge)}
                  aria-label={t('row.deleteLabel', { label })}
                  className="inline-flex size-10 items-center justify-center rounded-full text-rouge hover:bg-off-white"
                >
                  <Trash2 aria-hidden={true} className="size-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <DeleteDialog
        title={t('row.deleteCharge')}
        open={deleting !== null}
        pending={remove.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => deleting && remove.mutate({ id: deleting.id })}
      />
    </>
  );
}

/** A Charge: amount, currency, day, category, Dossier, note, monthly or not, and its receipt. */
function ChargeForm({ charge, onDone }: { charge: Charge | null; onDone: () => void }): ReactNode {
  const t = useTranslations('Finances');
  const ids = useId();
  const trpc = useTRPC();
  const refresh = useFinancesRefresh();
  const failed = useFinanceErrors();
  const { data: categories } = useSuspenseQuery(trpc.finances.categories.list.queryOptions());
  // Open categories, plus the archived one this Charge already has.
  const offered = categories.filter((category) => !category.archivedAt || category.id === charge?.category.id);
  const [amount, setAmount] = useState(charge ? minorToInput(charge.amount, charge.currency) : '');
  const [currency, setCurrency] = useState<Currency>(charge?.currency ?? 'XAF');
  const [day, setDay] = useState(charge?.day ?? doualaDay(new Date()));
  const [categoryId, setCategoryId] = useState(charge?.category.id ?? offered[0]?.id ?? '');
  const [dossier, setDossier] = useState<DossierOption | null>(charge?.dossier ?? null);
  const [note, setNote] = useState(charge?.note ?? '');
  const [repeats, setRepeats] = useState(charge?.repeatsMonthly ?? false);
  const [file, setFile] = useState<File | null>(null);
  const [keepReceipt, setKeepReceipt] = useState(Boolean(charge?.receiptFileName));
  const [uploading, setUploading] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const done = {
    onSuccess: () => {
      refresh();
      toast.add({ title: t('toast.chargeSaved'), type: 'success' as const });
      onDone();
    },
    onError: failed,
  };
  const create = useMutation(trpc.finances.charges.create.mutationOptions(done));
  const update = useMutation(trpc.finances.charges.update.mutationOptions(done));
  const pending = uploading || create.isPending || update.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const minor = toMinor(amount, currency);
    setInvalid(!minor);
    if (!minor) return;
    let receipt: Awaited<ReturnType<typeof uploadReceipt>> | null | undefined;
    if (file) {
      setUploading(true);
      try {
        receipt = await uploadReceipt(file);
      } catch (error) {
        failed({ message: error instanceof Error ? error.message : '' });
        return;
      } finally {
        setUploading(false);
      }
    } else if (charge?.receiptFileName && !keepReceipt) {
      receipt = null;
    }
    const data = {
      amount: minor,
      currency,
      day,
      categoryId,
      dossierId: dossier?.id ?? null,
      note: note.trim() || null,
      repeatsMonthly: repeats,
      ...(receipt !== undefined ? { receipt } : {}),
    };
    if (charge) update.mutate({ id: charge.id, charge: data });
    else create.mutate(data);
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4">
      <DialogHeader>
        <DialogTitle className="font-heading text-xl font-bold text-navy-deep">
          {charge ? t('charges.edit') : t('charges.new')}
        </DialogTitle>
        <DialogDescription className="text-sm text-slate">{t('charges.intro')}</DialogDescription>
      </DialogHeader>
      <AmountFields
        ids={ids}
        amount={amount}
        currency={currency}
        day={day}
        invalid={invalid}
        onAmount={setAmount}
        onCurrency={setCurrency}
        onDay={setDay}
      />
      <label htmlFor={`${ids}-category`} className={labelClass}>
        {t('charges.category')}
        <select
          id={`${ids}-category`}
          required={true}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className={field}
        >
          {offered.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <DossierPicker id={`${ids}-dossier`} value={dossier} invalid={false} onChange={setDossier} />
      <label htmlFor={`${ids}-note`} className={labelClass}>
        {t('form.note')}
        <textarea
          id={`${ids}-note`}
          rows={2}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={area}
        />
      </label>
      {charge?.repeatOfId ? null : (
        <label htmlFor={`${ids}-repeats`} className="flex items-start gap-3 text-sm text-navy-deep">
          <input
            id={`${ids}-repeats`}
            type="checkbox"
            checked={repeats}
            aria-describedby={`${ids}-repeats-hint`}
            onChange={(event) => setRepeats(event.target.checked)}
            className="mt-0.5 size-5 accent-rouge"
          />
          <span>
            <span className="font-semibold">{t('charges.repeats')}</span>
            <span id={`${ids}-repeats-hint`} className="block text-xs text-slate">
              {t('charges.repeatsHint')}
            </span>
          </span>
        </label>
      )}
      {charge?.receiptFileName && keepReceipt && !file ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-off-white px-3.5 py-2.5 text-sm">
          <span className="min-w-0 truncate text-navy-deep">
            {t('charges.receiptKept', { name: charge.receiptFileName })}
          </span>
          <button
            type="button"
            onClick={() => setKeepReceipt(false)}
            className="font-semibold text-rouge hover:text-crimson"
          >
            {t('charges.removeReceipt')}
          </button>
        </div>
      ) : (
        <label htmlFor={`${ids}-receipt`} className={labelClass}>
          {t('charges.receipt')}
          <input
            id={`${ids}-receipt`}
            type="file"
            accept={ACCEPT}
            aria-describedby={`${ids}-receipt-hint`}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="text-sm font-normal text-navy-deep file:mr-3 file:rounded-full file:border-0 file:bg-off-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy-deep"
          />
          <span id={`${ids}-receipt-hint`} className="text-xs font-normal text-slate">
            {t('charges.receiptHint')}
          </span>
          {charge?.receiptFileName && !keepReceipt && !file ? (
            <button
              type="button"
              onClick={() => setKeepReceipt(true)}
              className="justify-self-start text-xs font-semibold text-navy-deep underline"
            >
              {t('charges.keepReceipt')}
            </button>
          ) : null}
        </label>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className={secondary}>
          {t('form.cancel')}
        </button>
        <button type="submit" disabled={pending || !categoryId} className={primary}>
          {pending ? t('form.saving') : t('form.save')}
        </button>
      </div>
    </form>
  );
}
