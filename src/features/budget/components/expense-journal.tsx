'use client';

import { LockKeyhole, Receipt } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { withNext } from '@/features/auth/lib/safe-next-path';
import { CurrencyDialog } from '@/features/budget/components/currency-dialog';
import { ExpenseDrawer } from '@/features/budget/components/expense-drawer';
import { ExpenseForm } from '@/features/budget/components/expense-form';
import { ExpenseSummary } from '@/features/budget/components/expense-summary';
import { DEFAULT_CURRENCY, type Currency } from '@/features/budget/data/currencies';
import { useFormatMoney } from '@/features/budget/hooks/use-format-money';
import type { BudgetAnswers, Expense, ExpenseInput } from '@/features/budget/lib/budget-schema';
import { useBudgetEstimate } from '@/features/budget/hooks/use-budget-estimate';
import { estimateBudget, ratesFor } from '@/features/budget/lib/estimate-budget';
import { fromMinor } from '@/features/budget/lib/money';
import { LONG_DAY, noonUtc } from '@/features/budget/lib/day';
import { Link } from '@/i18n/navigation';
import { api } from '@/trpc/react';

/** Below `lg` the form lives in a drawer instead of the sidebar. */
const isPhone = () => window.matchMedia('(max-width: 1023px)').matches;

/** The browser's estimate's fees in the journal's currency, through the estimate's own rate. */
const budgetIn = (estimate: BudgetAnswers | null, currency: Currency): number | null =>
  estimate ? estimateBudget({ ...estimate, currency }, ratesFor(estimate)).feesTotal : null;

/** « Mes dépenses » for a visitor: what the journal is, and a way to sign in. */
function SignInInvite(): ReactNode {
  const t = useTranslations('Budget.journal');
  return (
    <section className="mx-auto max-w-xl rounded-2xl border-2 border-fog-light bg-white p-8 text-center">
      <span aria-hidden={true} className="mx-auto grid size-12 place-items-center rounded-2xl bg-blush text-rouge">
        <LockKeyhole className="size-6" />
      </span>
      <h2 className="mt-4 font-heading text-h4 font-bold text-navy-deep">{t('signedOutTitle')}</h2>
      <p className="mt-2 text-body text-slate">{t('signedOutText')}</p>
      <Link
        href={withNext('/connexion', '/outils/budget#depenses')}
        className="mt-6 inline-flex h-12 items-center rounded-full bg-rouge px-6 font-heading text-body font-bold text-white hover:bg-crimson"
      >
        {t('signIn')}
      </Link>
    </section>
  );
}

function ExpenseCard({ expense, currency, onEdit }: { expense: Expense; currency: Currency; onEdit: () => void }): ReactNode {
  const t = useTranslations('Budget');
  const format = useFormatter();
  const money = useFormatMoney();
  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        aria-label={t('journal.edit', { name: expense.name })}
        className="flex w-full items-start justify-between gap-4 rounded-2xl border-2 border-fog-light bg-white p-5 text-left transition-colors hover:border-navy-deep"
      >
        <span className="min-w-0">
          <span className="block font-heading text-body font-bold text-navy-deep">{expense.name}</span>
          <span className="mt-1 block text-body-sm text-slate">
            {t(`motifs.${expense.motif}`)} · {format.dateTime(noonUtc(expense.date), LONG_DAY)}
          </span>
          {expense.note && <span className="mt-2 block text-body-sm text-slate">{expense.note}</span>}
        </span>
        <span className="shrink-0 font-heading text-body font-bold text-navy-deep">
          {money(fromMinor(expense.amount, currency), currency)}
        </span>
      </button>
    </li>
  );
}

/** The signed-in User's journal: summary, Dépenses newest first, and the add/edit form. */
function Journal({ currency, estimate }: { currency: Currency | null; estimate: BudgetAnswers | null }): ReactNode {
  const t = useTranslations('Budget');
  const { data = [] } = api.budget.expenses.list.useQuery();
  // Newest first; same-day Dépenses keep the server's order.
  const expenses = useMemo(() => [...data].sort((a, b) => b.date.localeCompare(a.date)), [data]);
  const utils = api.useUtils();
  const refresh = { onSuccess: () => void utils.budget.expenses.list.invalidate() };
  const add = api.budget.expenses.add.useMutation(refresh);
  const update = api.budget.expenses.update.useMutation(refresh);
  const remove = api.budget.expenses.delete.useMutation(refresh);
  const setCurrency = api.budget.profile.setCurrency.useMutation({
    onSuccess: () => void utils.budget.profile.get.invalidate(),
  });

  const [picking, setPicking] = useState(currency === null);
  const [currencyError, setCurrencyError] = useState<string>();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [failure, setFailure] = useState<string>();
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const shown = currency ?? DEFAULT_CURRENCY;
  const budget = useMemo(() => budgetIn(estimate, shown), [estimate, shown]);

  const done = () => {
    setEditing(null);
    setFailure(undefined);
    setFormKey((k) => k + 1);
    setDrawerOpen(false);
  };
  const startAdding = () => {
    done();
    if (isPhone()) setDrawerOpen(true);
  };
  const edit = (expense: Expense) => {
    setEditing(expense);
    setFailure(undefined);
    if (isPhone()) setDrawerOpen(true);
  };
  const failed = (error: { message: string }) =>
    setFailure(
      error.message === 'BUDGET_LIMIT'
        ? t('form.errors.limit')
        : error.message === 'BUDGET_FUTURE_DATE'
          ? t('form.errors.future')
          : t('form.errors.save'),
    );
  const save = (input: ExpenseInput) => {
    setFailure(undefined);
    const outcome = { onSuccess: done, onError: failed };
    if (editing) update.mutate({ id: editing.id, ...input }, outcome);
    else add.mutate(input, outcome);
  };
  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate({ id: deleting.id }, { onSuccess: done, onError: failed });
    setDeleting(null);
  };
  const chooseCurrency = (next: Currency) => {
    setCurrencyError(undefined);
    setCurrency.mutate(
      { currency: next },
      { onSuccess: () => setPicking(false), onError: () => setCurrencyError(t('currencyDialog.error')) },
    );
  };

  const form = (
    <ExpenseForm
      key={`${editing?.id ?? `new-${formKey}`}-${shown}`}
      expense={editing}
      currency={shown}
      pending={add.isPending || update.isPending}
      error={failure}
      onSubmit={save}
      onDelete={editing ? () => setDeleting(editing) : undefined}
    />
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-fog-light bg-white px-5 py-3">
        <p className="text-body-sm text-slate">
          {currency ? t('journal.currencyLabel', { currency: t(`currencies.${currency}`) }) : t('currencyDialog.firstText')}
        </p>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="text-body-sm font-semibold text-rouge underline-offset-2 hover:underline"
        >
          {currency ? t('journal.changeCurrency') : t('currencyDialog.firstTitle')}
        </button>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 pb-24 lg:grid-cols-3 lg:pb-0">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <ExpenseSummary expenses={expenses} currency={shown} budget={budget} />
          <section aria-labelledby="budget-list-title">
            <h2 id="budget-list-title" className="mb-3 font-heading text-h4 font-bold text-navy-deep">
              {t('journal.listTitle')}
            </h2>
            {expenses.length > 0 ? (
              <ul className="space-y-3">
                {expenses.map((expense) => (
                  <ExpenseCard key={expense.id} expense={expense} currency={shown} onEdit={() => edit(expense)} />
                ))}
              </ul>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-fog bg-white p-8 text-center">
                <Receipt aria-hidden={true} className="mx-auto size-8 text-steel-blue" />
                <h3 className="mt-3 font-heading text-body font-bold text-navy-deep">{t('journal.empty.title')}</h3>
                <p className="mt-1 text-body-sm text-slate">{t('journal.empty.text')}</p>
              </div>
            )}
          </section>
        </div>

        <aside className="hidden flex-col gap-4 lg:sticky lg:top-20 lg:flex">
          <section aria-labelledby="budget-form-title" className="rounded-2xl border-2 border-fog-light bg-white p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="budget-form-title" className="font-heading text-body font-bold text-navy-deep">
                {editing ? t('form.editTitle') : t('form.addTitle')}
              </h2>
              {editing && (
                <button type="button" onClick={done} className="text-caption font-semibold text-rouge">
                  {t('form.cancelEdit')}
                </button>
              )}
            </div>
            {form}
          </section>
        </aside>
      </div>

      <button
        type="button"
        onClick={startAdding}
        className="fixed right-4 bottom-4.5 z-40 inline-flex min-h-13 items-center rounded-full bg-rouge px-4.5 font-heading text-body font-bold text-white shadow-lg lg:hidden"
      >
        {t('journal.fab')}
      </button>
      <ExpenseDrawer open={drawerOpen} onOpenChange={setDrawerOpen} editing={editing !== null}>
        {form}
      </ExpenseDrawer>

      <CurrencyDialog
        key={`${currency ?? 'none'}-${String(picking)}`}
        open={picking}
        onOpenChange={setPicking}
        current={currency}
        pending={setCurrency.isPending}
        error={currencyError}
        onConfirm={chooseCurrency}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent className="gap-5 p-6">
          <AlertDialogHeader>
            {/* Canonical sizes: the primitive's class merge drops the text-h4 / text-body-sm tokens. */}
            <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">
              {t('deleteConfirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate">
              {t('deleteConfirm.text', { name: deleting?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t('deleteConfirm.cancel')}</AlertDialogCancel>
            <button
              type="button"
              onClick={confirmDelete}
              className="rounded-full bg-rouge px-5 py-2 text-body-sm font-semibold text-white transition-colors hover:bg-crimson"
            >
              {t('deleteConfirm.confirm')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * « Mes dépenses »: needs an Account. A visitor is invited to sign in; a User
 * without a currency yet is asked to choose one first.
 */
export function ExpenseJournal(): ReactNode {
  const t = useTranslations('Budget.journal');
  const { account, pending } = useCurrentAccount();
  const profile = api.budget.profile.get.useQuery(undefined, { enabled: account !== null });
  // The « dépensé X sur Y » bar reads the estimate this browser keeps.
  const [estimate] = useBudgetEstimate();

  if (pending) return null;
  if (!account) return <SignInInvite />;
  if (profile.isPending) return <p className="text-center text-body text-slate">{t('loading')}</p>;
  return (
    <Journal
      currency={profile.data?.currency ?? null}
      estimate={estimate}
    />
  );
}
