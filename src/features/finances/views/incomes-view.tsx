'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { SERVICE_TYPES, type ServiceType } from '@/features/dossiers/data/workflows';
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
import { NOTE_MAX, SOURCE_MAX } from '@/features/finances/lib/finance-schema';
import { DossierPicker, type DossierOption } from '@/features/shared/components/dossier-picker';
import { formatMoney, minorToInput, toMinor, type Currency } from '@/features/invoices/lib/money';
import { doualaDay } from '@/features/notifications/lib/douala-days';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Income = RouterOutputs['finances']['incomes']['list'][number];

/** Finances' Recettes (#95): paid Factures (read only) and the ones entered by hand. */
export function IncomesView({ year }: { year: number }): ReactNode {
  const t = useTranslations('Finances');
  const [editing, setEditing] = useState<Income | 'new' | null>(null);
  return (
    <div className="mx-auto grid grid-cols-1 max-w-5xl gap-6">
      <FinancesHeader page="incomes" year={year} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate">{t('incomes.intro')}</p>
        <button type="button" onClick={() => setEditing('new')} className={primary}>
          <Plus aria-hidden={true} className="size-4" />
          {t('incomes.add')}
        </button>
      </div>
      <QueryBoundary fallback={<FinanceListSkeleton />}>
        <IncomeList year={year} onEdit={setEditing} />
      </QueryBoundary>
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent showCloseButton={false} className="max-h-dvh gap-4 overflow-y-auto p-6 sm:max-w-lg">
          {editing !== null ? (
            <IncomeForm income={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IncomeList({ year, onEdit }: { year: number; onEdit: (income: Income) => void }): ReactNode {
  const t = useTranslations('Finances');
  const services = useTranslations('Dossiers.services');
  const format = useFormatter();
  const locale = useLocale();
  const trpc = useTRPC();
  const refresh = useFinancesRefresh();
  const failed = useFinanceErrors();
  const { data: incomes } = useSuspenseQuery(trpc.finances.incomes.list.queryOptions({ year }));
  const [deleting, setDeleting] = useState<Income | null>(null);
  const remove = useMutation(
    trpc.finances.incomes.delete.mutationOptions({
      onSuccess: () => {
        refresh();
        setDeleting(null);
        toast.add({ title: t('toast.incomeDeleted'), type: 'success' });
      },
      onError: failed,
    }),
  );

  if (incomes.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-10 text-center text-sm text-slate">
        {t('incomes.empty', { year })}
      </p>
    );
  }
  return (
    <>
      <ul className="grid grid-cols-1 gap-2">
        {incomes.map((income) => {
          const label = income.service ? services(income.service) : (income.source ?? '');
          return (
            <li
              key={`${income.invoice ? 'invoice' : 'income'}-${income.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fog-light bg-white p-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-navy-deep">{label}</span>
                  {income.invoice ? (
                    <Link
                      href={`/factures/${income.invoice.id}`}
                      title={t('incomes.invoiceHint')}
                      className="rounded-full bg-leaf-tint px-2.5 py-0.5 text-xs font-semibold text-leaf hover:underline"
                    >
                      {t('incomes.invoice', { number: income.invoice.number })}
                    </Link>
                  ) : null}
                </p>
                <p className="truncate text-sm text-slate">
                  {format.dateTime(new Date(`${income.day}T00:00:00Z`), {
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'UTC',
                  })}
                  {income.dossier ? ` · ${income.dossier.account.name}` : ''}
                  {income.note ? ` · ${income.note}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="mr-2 font-semibold text-navy-deep tabular-nums">
                  {formatMoney(income.amount, income.currency, locale)}
                </span>
                {income.invoice ? null : (
                  <>
                    <button
                      type="button"
                      onClick={() => onEdit(income)}
                      aria-label={t('row.editLabel', { label })}
                      className="inline-flex size-10 items-center justify-center rounded-full text-navy-deep hover:bg-off-white"
                    >
                      <Pencil aria-hidden={true} className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(income)}
                      aria-label={t('row.deleteLabel', { label })}
                      className="inline-flex size-10 items-center justify-center rounded-full text-rouge hover:bg-off-white"
                    >
                      <Trash2 aria-hidden={true} className="size-4" />
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <DeleteDialog
        title={t('row.deleteIncome')}
        open={deleting !== null}
        pending={remove.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => deleting && remove.mutate({ id: deleting.id })}
      />
    </>
  );
}

/** A Recette by hand: amount, currency, day, a service or a source, a Dossier, a note. */
function IncomeForm({ income, onDone }: { income: Income | null; onDone: () => void }): ReactNode {
  const t = useTranslations('Finances');
  const services = useTranslations('Dossiers.services');
  const ids = useId();
  const trpc = useTRPC();
  const refresh = useFinancesRefresh();
  const failed = useFinanceErrors();
  const [amount, setAmount] = useState(income ? minorToInput(income.amount, income.currency) : '');
  const [currency, setCurrency] = useState<Currency>(income?.currency ?? 'XAF');
  const [day, setDay] = useState(income?.day ?? doualaDay(new Date()));
  const [service, setService] = useState<ServiceType | ''>(income ? (income.service ?? '') : 'ACCOMPAGNEMENT');
  const [source, setSource] = useState(income?.source ?? '');
  const [dossier, setDossier] = useState<DossierOption | null>(
    income?.dossier ? income.dossier : null,
  );
  const [note, setNote] = useState(income?.note ?? '');
  const [invalid, setInvalid] = useState(false);
  const done = {
    onSuccess: () => {
      refresh();
      toast.add({ title: t('toast.incomeSaved'), type: 'success' as const });
      onDone();
    },
    onError: failed,
  };
  const create = useMutation(trpc.finances.incomes.create.mutationOptions(done));
  const update = useMutation(trpc.finances.incomes.update.mutationOptions(done));
  const pending = create.isPending || update.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const minor = toMinor(amount, currency);
    setInvalid(!minor);
    if (!minor) return;
    const data = {
      amount: minor,
      currency,
      day,
      service: service || null,
      source: service ? null : source.trim(),
      dossierId: dossier?.id ?? null,
      note: note.trim() || null,
    };
    if (income) update.mutate({ id: income.id, income: data });
    else create.mutate(data);
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4">
      <DialogHeader>
        <DialogTitle className="font-heading text-xl font-bold text-navy-deep">
          {income ? t('incomes.edit') : t('incomes.new')}
        </DialogTitle>
        <DialogDescription className="text-sm text-slate">{t('incomes.intro')}</DialogDescription>
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
      <label htmlFor={`${ids}-service`} className={labelClass}>
        {t('incomes.service')}
        <select
          id={`${ids}-service`}
          value={service}
          onChange={(event) => setService(event.target.value as ServiceType | '')}
          className={field}
        >
          {SERVICE_TYPES.map((choice) => (
            <option key={choice} value={choice}>
              {services(choice)}
            </option>
          ))}
          <option value="">{t('incomes.otherService')}</option>
        </select>
      </label>
      {service ? null : (
        <label htmlFor={`${ids}-source`} className={labelClass}>
          {t('incomes.source')}
          <input
            id={`${ids}-source`}
            required={true}
            maxLength={SOURCE_MAX}
            value={source}
            placeholder={t('incomes.sourcePlaceholder')}
            onChange={(event) => setSource(event.target.value)}
            className={field}
          />
        </label>
      )}
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
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className={secondary}>
          {t('form.cancel')}
        </button>
        <button type="submit" disabled={pending} className={primary}>
          {pending ? t('form.saving') : t('form.save')}
        </button>
      </div>
    </form>
  );
}
