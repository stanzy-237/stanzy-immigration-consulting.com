'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { ExternalLink, Plus, Upload } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useId, useState, type ChangeEvent, type ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { DOCUMENT_FILE_TYPES } from '@/features/dossiers/lib/document-schema';
import { InvoicePayments } from '@/features/invoices/components/invoice-payments';
import { InvoiceStatusPill } from '@/features/invoices/components/invoice-status-pill';
import { useInvoiceMutation } from '@/features/invoices/hooks/use-invoice-mutation';
import { invoicePdfUrl, uploadProofFile } from '@/features/invoices/lib/invoice-urls';
import { isAwaitingPayment } from '@/features/invoices/lib/invoice-status';
import { formatMoney } from '@/features/invoices/lib/money';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Invoice = RouterOutputs['invoices']['forDossier'][number];

const ACCEPT = [...DOCUMENT_FILE_TYPES, '.heic', '.heif'].join(',');

/**
 * A Dossier's Factures. The consultant opens each one in « Factures » and
 * starts a new one for this Dossier; the Client reads the sent ones, opens
 * their PDF and uploads a Preuve de paiement.
 */
export function DossierInvoices({
  dossierId,
  viewer,
}: {
  dossierId: string;
  viewer: 'consultant' | 'client';
}): ReactNode {
  const t = useTranslations('Invoices.dossier');
  const trpc = useTRPC();
  const { data: invoices } = useSuspenseQuery(trpc.invoices.forDossier.queryOptions({ dossierId }));
  const consultant = viewer === 'consultant';

  return (
    <section id="factures" aria-labelledby={`${dossierId}-invoices`} className="grid grid-cols-1 scroll-mt-20 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={`${dossierId}-invoices`} className="font-heading text-2xl font-bold text-navy-deep">
          {t('title')}
        </h2>
        {consultant ? (
          <Link
            href={`/factures/nouvelle?dossier=${dossierId}`}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-navy-deep px-4 text-sm font-semibold text-white hover:bg-navy-80"
          >
            <Plus aria-hidden={true} className="size-4" />
            {t('new')}
          </Link>
        ) : null}
      </div>
      {invoices.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-8 text-center text-sm text-slate">
          {consultant ? t('empty') : t('emptyClient')}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <InvoiceRow invoice={invoice} consultant={consultant} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InvoiceRow({ invoice, consultant }: { invoice: Invoice; consultant: boolean }): ReactNode {
  const t = useTranslations('Invoices');
  const locale = useLocale();
  const format = useFormatter();
  const name = invoice.number ?? t('list.draft');

  return (
    <article className="rounded-2xl border border-fog-light bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {consultant ? (
            <Link href={`/factures/${invoice.id}`} className="font-semibold text-navy-deep hover:text-rouge">
              {name}
            </Link>
          ) : (
            <p className="font-semibold text-navy-deep">{name}</p>
          )}
          <p className="text-sm text-slate">
            {formatMoney(invoice.total, invoice.currency, locale)}
            {invoice.dueDate && isAwaitingPayment(invoice.status)
              ? ` · ${t('dossier.dueOn', { date: format.dateTime(invoice.dueDate, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) })}`
              : null}
            {invoice.proofs.length > 0 ? ` · ${t('dossier.proofCount', { count: invoice.proofs.length })}` : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceStatusPill invoice={invoice} />
          {invoice.number ? (
            <a
              href={invoicePdfUrl(invoice.id)}
              target="_blank"
              rel="noopener"
              aria-label={t('dossier.pdfLabel', { number: invoice.number })}
              className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-rouge hover:text-crimson"
            >
              {t('dossier.pdf')}
              <ExternalLink aria-hidden={true} className="size-3.5" />
            </a>
          ) : null}
        </div>
      </div>
      {invoice.payments.length > 0 ? (
        <div className="mt-3 border-t border-off-white pt-3">
          <InvoicePayments invoice={invoice} viewer={consultant ? 'consultant' : 'client'} />
        </div>
      ) : null}
      {!consultant && invoice.number && isAwaitingPayment(invoice.status) ? (
        <UploadProof invoiceId={invoice.id} number={invoice.number} />
      ) : null}
    </article>
  );
}

/** Encrypts the receipt in the browser, sends it, then records it on the Facture. */
function UploadProof({ invoiceId, number }: { invoiceId: string; number: string }): ReactNode {
  const t = useTranslations('Invoices');
  const id = useId();
  const trpc = useTRPC();
  const { refresh, failed } = useInvoiceMutation();
  const [sending, setSending] = useState(false);
  const addProof = useMutation(trpc.invoices.addProof.mutationOptions());

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setSending(true);
    try {
      const uploaded = await uploadProofFile(invoiceId, file);
      await addProof.mutateAsync({ invoiceId, ...uploaded });
      void refresh();
      toast.add({ title: t('toast.proofAdded'), type: 'success' });
    } catch (error) {
      failed({ message: error instanceof Error ? error.message : '' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 border-t border-off-white pt-3">
      <input
        id={id}
        type="file"
        accept={ACCEPT}
        aria-label={t('dossier.uploadProofLabel', { number })}
        className="peer sr-only"
        disabled={sending}
        onChange={choose}
      />
      <label
        htmlFor={id}
        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-rouge px-4 text-sm font-semibold text-white hover:bg-crimson peer-focus-visible:ring-2 peer-focus-visible:ring-navy-deep peer-disabled:cursor-wait peer-disabled:opacity-50"
      >
        <Upload aria-hidden={true} className="size-4" />
        {sending ? t('dossier.uploading') : t('dossier.uploadProof')}
      </label>
      <p className="mt-1 text-xs text-slate">{t('dossier.proofHint')}</p>
    </div>
  );
}

export function DossierInvoicesSkeleton(): ReactNode {
  const t = useTranslations('Invoices.dossier');
  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden={true} className="grid grid-cols-1 gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    </div>
  );
}
