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
import type { RouterOutputs } from '@/trpc/types';

type Finances = RouterOutputs['finances']['dossier'];
type Line = Finances['lines'][number];

/**
 * A Dossier's Recettes, Charges and margin in FCFA (#95), for the consultant's
 * Dossier page: the route passes it as the dossiers view's `finances` slot.
 * With #158, each service sold on it (its own, then each « Stanzy s'en
 * charge » request) with the price negotiated with the Client and what the
 * partner is paid, both editable whatever the catalogue says; what is left to
 * pay; and the Bénéfice.
 */
export function DossierFinancesView({ dossierId }: { dossierId: string }): ReactNode {
  return (
    <QueryBoundary fallback={<Skeleton aria-hidden={true} className="h-64 rounded-2xl" />}>
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
  const services = useTranslations('Dossiers.services');
  const locale = useLocale() as 'fr' | 'en';
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.finances.dossier.queryOptions({ dossierId }));
  const [editing, setEditing] = useState<string | null>(null);
  const xaf = (amount: number) => formatMoney(amount, 'XAF', locale);
  const nameOf = (line: Line) =>
    line.kind === 'DOSSIER' ? services(data.service as never) : (line.name?.[locale] ?? line.name?.fr ?? '');

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

      <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate uppercase">{t('services')}</h3>
      {data.lines.length === 0 ? (
        <p className="mb-4 text-sm text-slate">{t('noServices')}</p>
      ) : (
        <ul className="mb-4 grid grid-cols-1 divide-y divide-fog-light border-y border-fog-light">
          {data.lines.map((line) => (
            <li key={`${line.kind}-${line.id}`} className="py-3">
              {editing === line.id ? (
                <PricingForm dossierId={dossierId} line={line} name={nameOf(line)} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="min-w-40 flex-1 font-semibold text-navy-deep">{nameOf(line)}</p>
                  <dl className="grid flex-2 grid-cols-2 gap-3">
                    <Priced label={t('agreedPrice')} amount={line.price} source={line.priceSource} />
                    <Priced label={t('partnerPrice')} amount={line.partnerPrice} source={line.partnerSource} />
                  </dl>
                  <button
                    type="button"
                    onClick={() => setEditing(line.id)}
                    aria-label={t('editFor', { service: nameOf(line) })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-fog px-3 py-1.5 text-sm font-semibold text-navy-deep hover:bg-fog-light"
                  >
                    <Pencil aria-hidden={true} className="size-3.5" />
                    {t('edit')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <dl className="mb-4 grid grid-cols-3 gap-3 border-b border-fog-light pb-4">
        <Figure label={`${t('agreedPrice')} · ${t('total')}`} value={data.price === null ? t('noPrice') : xaf(data.price)} />
        <Figure label={`${t('partnerPrice')} · ${t('total')}`} value={xaf(data.partnerPrice)} />
        <div>
          <dt className="text-xs font-semibold text-slate" title={t('profitHint')}>
            {t('profit')}
          </dt>
          <dd className={`font-bold tabular-nums ${data.profit !== null && data.profit < 0 ? 'text-crimson' : 'text-navy-deep'}`}>
            {data.profit === null ? t('noPrice') : xaf(data.profit)}
          </dd>
        </div>
      </dl>

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

/** An amount and where it comes from (négocié, du contrat, du catalogue). */
function Priced({ label, amount, source }: { label: string; amount: number | null; source: Line['priceSource'] }): ReactNode {
  const t = useTranslations('Finances.dossier');
  const locale = useLocale();
  return (
    <div>
      <dt className="text-xs font-semibold text-slate">{label}</dt>
      <dd className="font-semibold text-navy-deep tabular-nums">
        {amount === null ? t('noPrice') : formatMoney(amount, 'XAF', locale)}
        {amount !== null && source ? (
          <>
            {' '}
            <span className="text-xs font-normal text-slate">({t(`source.${source}`)})</span>
          </>
        ) : null}
      </dd>
    </div>
  );
}

/** A service's negotiated price and its partner's, in whole FCFA; empty goes back to the Contrat / catalogue. */
function PricingForm({ dossierId, line, name, onDone }: { dossierId: string; line: Line; name: string; onDone: () => void }): ReactNode {
  const t = useTranslations('Finances.dossier');
  const ids = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const failed = useFinanceErrors();
  // Only what was typed starts the fields: a prefilled figure stays a prefill until changed.
  const [priceText, setPriceText] = useState(line.priceSource === 'TYPED' && line.price !== null ? String(line.price) : '');
  const [partnerText, setPartnerText] = useState(line.partnerSource === 'TYPED' && line.partnerPrice !== null ? String(line.partnerPrice) : '');
  const [invalid, setInvalid] = useState(false);
  const done = {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.finances.dossier.queryKey({ dossierId }) });
      void queryClient.invalidateQueries({ queryKey: trpc.invoices.serviceBalance.queryKey({ dossierId }) });
      toast.add({ title: t('saved'), type: 'success' });
      onDone();
    },
    onError: failed,
  };
  const forDossier = useMutation(trpc.finances.setDossierPricing.mutationOptions(done));
  const forRequest = useMutation(trpc.finances.setRequestPricing.mutationOptions(done));
  const pending = forDossier.isPending || forRequest.isPending;
  const parse = (text: string): number | null | undefined => (text.trim() === '' ? null : (toMinor(text, 'XAF') ?? undefined));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const price = parse(priceText);
    const partnerPrice = parse(partnerText);
    if (price === undefined || partnerPrice === undefined) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (line.kind === 'DOSSIER') forDossier.mutate({ dossierId, price, partnerPrice });
    else forRequest.mutate({ requestId: line.id, price, partnerPrice });
  };

  const field = 'w-full rounded-lg border border-fog px-3 py-2 tabular-nums text-navy-deep focus:border-navy-deep focus:outline-none';
  return (
    <form onSubmit={submit} noValidate={true} aria-label={t('editFor', { service: name })} className="grid gap-3 sm:grid-cols-2">
      <p className="font-semibold text-navy-deep sm:col-span-2">{name}</p>
      <label htmlFor={`${ids}-price`} className="grid gap-1 text-xs font-semibold text-slate">
        {t('agreedPrice')}
        <input
          id={`${ids}-price`}
          inputMode="numeric"
          value={priceText}
          placeholder={line.price === null ? '' : String(line.price)}
          onChange={(event) => setPriceText(event.target.value)}
          aria-invalid={invalid}
          aria-describedby={`${ids}-hint`}
          className={field}
        />
      </label>
      <label htmlFor={`${ids}-partner`} className="grid gap-1 text-xs font-semibold text-slate">
        {t('partnerPrice')}
        <input
          id={`${ids}-partner`}
          inputMode="numeric"
          value={partnerText}
          placeholder={line.partnerPrice === null ? '' : String(line.partnerPrice)}
          onChange={(event) => setPartnerText(event.target.value)}
          aria-invalid={invalid}
          aria-describedby={`${ids}-hint`}
          className={field}
        />
      </label>
      <p id={`${ids}-hint`} className="text-xs text-slate sm:col-span-2">
        {t('emptyHint')}
      </p>
      {invalid ? (
        <p role="alert" className="text-sm text-crimson sm:col-span-2">
          {t('amountError')}
        </p>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
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
