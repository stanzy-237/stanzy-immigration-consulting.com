'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useFinanceErrors } from '@/features/finances/hooks/use-finance-errors';
import { formatMoney, toMinor } from '@/features/invoices/lib/money';
import { useTRPC } from '@/trpc/client';

/**
 * A Dossier's Recettes, Charges and margin in FCFA (#95), for the consultant's
 * Dossier page: the route passes it as the dossiers view's `finances` slot.
 * With #158, also its « Prix du service », what is left to pay, the « Part du
 * partenaire » and the Bénéfice, the first two editable.
 */
export function DossierFinancesView({ dossierId }: { dossierId: string }): ReactNode {
  return (
    <QueryBoundary fallback={<Skeleton aria-hidden={true} className="h-48 rounded-2xl" />}>
      <DossierFinances dossierId={dossierId} />
    </QueryBoundary>
  );
}

function Figure({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate">{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-bold' : 'font-semibold'} ${danger ? 'text-crimson' : 'text-navy-deep'}`}>
        {value}
      </dd>
    </div>
  );
}

function DossierFinances({ dossierId }: { dossierId: string }): ReactNode {
  const t = useTranslations('Finances.dossier');
  const tb = useTranslations('Invoices.balance');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.finances.dossier.queryOptions({ dossierId }));
  const [editing, setEditing] = useState(false);
  const xaf = (amount: number) => formatMoney(amount, 'XAF', locale);
  const orNone = (amount: number | null) => (amount === null ? t('noPrice') : xaf(amount));
  return (
    <section aria-labelledby="dossier-finances" className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="dossier-finances" className="font-heading text-lg font-bold text-navy-deep">
          {t('title')}
        </h2>
        <Link href="/finances" className="text-sm font-semibold text-rouge hover:text-crimson">
          {t('open')}
        </Link>
      </div>

      {editing ? (
        <PricingForm
          dossierId={dossierId}
          price={data.price}
          partnerShare={data.partnerShare}
          onDone={() => setEditing(false)}
        />
      ) : (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-fog-light pb-4">
          <dl className="grid flex-1 grid-cols-3 gap-3">
            <Figure label={t('servicePrice')} value={orNone(data.price)} />
            <Figure label={t('partnerShare')} value={orNone(data.partnerShare)} />
            <div>
              <dt className="text-xs font-semibold text-slate" title={t('profitHint')}>
                {t('profit')}
              </dt>
              <dd className={`font-bold tabular-nums ${data.profit !== null && data.profit < 0 ? 'text-crimson' : 'text-navy-deep'}`}>
                {orNone(data.profit)}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-fog px-3 py-1.5 text-sm font-semibold text-navy-deep hover:bg-fog-light"
          >
            <Pencil aria-hidden={true} className="size-3.5" />
            {t('edit')}
          </button>
        </div>
      )}

      {data.balance ? (
        <dl aria-label={tb('title')} className="mb-4 grid grid-cols-3 gap-3 border-b border-fog-light pb-4">
          <Figure label={tb('invoiced')} value={xaf(data.balance.invoiced)} />
          <Figure label={tb('paid')} value={xaf(data.balance.paid)} />
          <Figure label={tb('remaining')} value={xaf(data.balance.remaining)} strong={true} danger={data.balance.remaining > 0} />
        </dl>
      ) : (
        <p className="mb-4 border-b border-fog-light pb-4 text-sm text-slate">{tb('none')}</p>
      )}

      <dl className="grid grid-cols-3 gap-3">
        <Figure label={t('income')} value={xaf(data.income)} />
        <Figure label={t('charges')} value={xaf(data.charges)} />
        <Figure label={t('margin')} value={xaf(data.net)} strong={true} danger={data.net < 0} />
      </dl>
      {data.unconverted ? <p className="mt-2 text-xs text-honey">{t('unconverted')}</p> : null}
    </section>
  );
}

/** « Prix du service » and « Part du partenaire », in whole FCFA; empty goes back to the prefill. */
function PricingForm({
  dossierId,
  price,
  partnerShare,
  onDone,
}: {
  dossierId: string;
  price: number | null;
  partnerShare: number | null;
  onDone: () => void;
}): ReactNode {
  const t = useTranslations('Finances.dossier');
  const ids = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const failed = useFinanceErrors();
  const [priceText, setPriceText] = useState(price === null ? '' : String(price));
  const [shareText, setShareText] = useState(partnerShare === null ? '' : String(partnerShare));
  const [invalid, setInvalid] = useState(false);
  const save = useMutation(
    trpc.finances.setPricing.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.finances.dossier.queryKey({ dossierId }) });
        toast.add({ title: t('saved'), type: 'success' });
        onDone();
      },
      onError: failed,
    }),
  );
  const parse = (text: string): number | null | undefined => (text.trim() === '' ? null : (toMinor(text, 'XAF') ?? undefined));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const servicePrice = parse(priceText);
    const share = parse(shareText);
    if (servicePrice === undefined || share === undefined || (servicePrice ?? 0) < 0 || (share ?? 0) < 0) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    save.mutate({ dossierId, servicePrice, partnerShare: share });
  };

  const field = 'w-full rounded-lg border border-fog px-3 py-2 tabular-nums text-navy-deep focus:border-navy-deep focus:outline-none';
  return (
    <form onSubmit={submit} noValidate={true} className="mb-4 grid gap-3 border-b border-fog-light pb-4 sm:grid-cols-2">
      <label htmlFor={`${ids}-price`} className="grid gap-1 text-xs font-semibold text-slate">
        {t('servicePrice')}
        <input
          id={`${ids}-price`}
          inputMode="numeric"
          value={priceText}
          onChange={(event) => setPriceText(event.target.value)}
          aria-invalid={invalid}
          className={field}
        />
      </label>
      <label htmlFor={`${ids}-share`} className="grid gap-1 text-xs font-semibold text-slate">
        {t('partnerShare')}
        <input
          id={`${ids}-share`}
          inputMode="numeric"
          value={shareText}
          onChange={(event) => setShareText(event.target.value)}
          aria-invalid={invalid}
          className={field}
        />
      </label>
      {invalid ? (
        <p role="alert" className="text-sm text-crimson sm:col-span-2">
          {t('amountError')}
        </p>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-full bg-rouge px-4 py-2 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-60"
        >
          {t('save')}
        </button>
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2 text-sm font-semibold text-navy-deep hover:bg-fog-light">
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
