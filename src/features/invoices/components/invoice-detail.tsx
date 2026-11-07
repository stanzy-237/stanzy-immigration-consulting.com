'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Download, ExternalLink } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/toast';
import { InvoiceStatusPill } from '@/features/invoices/components/invoice-status-pill';
import { useInvoiceMutation } from '@/features/invoices/hooks/use-invoice-mutation';
import { CANCEL_REASON_MAX, cancelInvoiceInput } from '@/features/invoices/lib/invoice-schema';
import { isAwaitingPayment } from '@/features/invoices/lib/invoice-status';
import { formatMoney, lineTotal } from '@/features/invoices/lib/money';
import { invoicePdfUrl, proofFileUrl } from '@/features/invoices/lib/invoice-urls';
import { optimisticUpdate } from '@/lib/optimistic-list';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Invoice = RouterOutputs['invoices']['dashboard']['get'];

/** A sent Facture in the Tableau de bord: what was billed, its proofs, and Payée / Annuler. */
export function InvoiceDetail({ invoice }: { invoice: Invoice }): ReactNode {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { refresh, failed } = useInvoiceMutation();
  const [cancelling, setCancelling] = useState(false);
  const money = (minor: number) => formatMoney(minor, invoice.currency, locale);
  const date = (value: Date) => format.dateTime(value, { day: 'numeric', month: 'long', year: 'numeric' });

  // « Payée » shows on the click; a refusal puts the invoice back.
  const paid = optimisticUpdate<Invoice, { id: string }>(
    queryClient,
    trpc.invoices.dashboard.get.queryKey({ id: invoice.id }),
    (current) => ({ ...current, status: 'PAID', paidAt: new Date() }),
  );
  const markPaid = useMutation(
    trpc.invoices.dashboard.markPaid.mutationOptions({
      onMutate: paid.onMutate,
      onSuccess: () => {
        void refresh();
        toast.add({ title: t('Invoices.toast.paid'), type: 'success' });
      },
      onError: (error, input, context) => {
        paid.onError(error, input, context);
        failed(error);
      },
    }),
  );
  const awaiting = isAwaitingPayment(invoice.status);

  return (
    <div className="grid grid-cols-1 gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-rouge">
            {t(`Dossiers.services.${invoice.dossier.service}`)}
          </p>
          <h1 className="font-heading text-3xl font-bold text-navy-deep">{invoice.number}</h1>
          <p className="mt-1 text-sm text-slate">
            {invoice.dossier.account.name} · {invoice.dossier.account.email} ·{' '}
            <Link href={`/dossiers/${invoice.dossier.id}`} className="font-semibold text-rouge hover:text-crimson">
              {t('Invoices.detail.dossierLink')}
            </Link>
          </p>
        </div>
        <InvoiceStatusPill invoice={invoice} />
      </header>

      <section className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
        <h2 className="sr-only">{t('Invoices.detail.lines')}</h2>
        <ul className="grid grid-cols-1 gap-2">
          {invoice.lines.map((line, index) => (
            <li key={index} className="flex flex-wrap justify-between gap-2 border-b border-off-white pb-2 text-sm">
              <span className="text-navy-deep">
                {line.description}
                {line.quantity > 1 ? ` × ${line.quantity}` : ''}
              </span>
              <span className="font-semibold text-navy-deep">{money(lineTotal(line))}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-right font-heading text-xl font-bold text-navy-deep">
          {t('Invoices.editor.total')} {money(invoice.total)}
        </p>
        {invoice.notes ? <p className="mt-3 whitespace-pre-line text-sm text-slate">{invoice.notes}</p> : null}
        <p className="mt-4 border-t border-off-white pt-4 text-sm text-slate">
          {invoice.sentAt ? t('Invoices.detail.sentOn', { date: date(invoice.sentAt) }) : null}
          {invoice.dueDate ? ` · ${t('Invoices.list.dueOn', { date: date(invoice.dueDate) })}` : null}
          {invoice.paidAt ? ` · ${t('Invoices.detail.paidOn', { date: date(invoice.paidAt) })}` : null}
          {invoice.cancelledAt ? ` · ${t('Invoices.detail.cancelledOn', { date: date(invoice.cancelledAt) })}` : null}
          {invoice.cancelReason ? ` · ${t('Invoices.detail.cancelReason', { reason: invoice.cancelReason })}` : null}
        </p>
      </section>

      <section className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
        <h2 className="font-heading text-lg font-bold text-navy-deep">{t('Invoices.detail.proofs')}</h2>
        {invoice.proofs.length === 0 ? (
          <p className="mt-2 text-sm text-slate">{t('Invoices.detail.noProofs')}</p>
        ) : (
          <ul className="mt-2 grid grid-cols-1 gap-2">
            {invoice.proofs.map((proof) => (
              <li
                key={proof.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-off-white px-3 py-2"
              >
                <span className="text-sm text-navy-deep">
                  {proof.fileName}
                  <span className="block text-xs text-slate">{date(proof.createdAt)}</span>
                </span>
                <a
                  href={proofFileUrl(proof.id)}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-rouge hover:text-crimson"
                >
                  {t('Invoices.detail.openProof')}
                  <ExternalLink aria-hidden={true} className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={invoicePdfUrl(invoice.id)}
          target="_blank"
          rel="noopener"
          className="inline-flex h-11 items-center gap-1.5 rounded-full border-2 border-navy-deep px-5 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
        >
          <Download aria-hidden={true} className="size-4" />
          {t('Invoices.detail.downloadPdf')}
        </a>
        {awaiting ? (
          <>
            <button
              type="button"
              disabled={markPaid.isPending}
              onClick={() => markPaid.mutate({ id: invoice.id })}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-leaf px-5 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
            >
              <CheckCircle2 aria-hidden={true} className="size-4" />
              {t('Invoices.detail.markPaid')}
            </button>
            <button
              type="button"
              onClick={() => setCancelling(true)}
              className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-slate hover:text-rouge"
            >
              <Ban aria-hidden={true} className="size-4" />
              {t('Invoices.detail.cancelInvoice')}
            </button>
          </>
        ) : null}
      </div>

      <CancelDialog id={invoice.id} open={cancelling} onOpenChange={setCancelling} />
    </div>
  );
}

function CancelDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactNode {
  const t = useTranslations('Invoices');
  const fieldId = useId();
  const trpc = useTRPC();
  const { refresh, failed } = useInvoiceMutation();
  const [reason, setReason] = useState('');
  const [invalid, setInvalid] = useState(false);
  const cancel = useMutation(
    trpc.invoices.dashboard.cancel.mutationOptions({
      onSuccess: () => {
        void refresh();
        onOpenChange(false);
        toast.add({ title: t('toast.cancelled'), type: 'info' });
      },
      onError: (error) => {
        onOpenChange(false);
        failed(error);
      },
    }),
  );

  const submit = () => {
    const parsed = cancelInvoiceInput.safeParse({ id, reason });
    setInvalid(!parsed.success);
    if (parsed.success) cancel.mutate(parsed.data);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-5 p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">
            {t('detail.cancelTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate">{t('detail.cancelBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-1 gap-1.5">
          <label htmlFor={fieldId} className="text-sm font-semibold text-navy-deep">
            {t('detail.reason')}
          </label>
          <textarea
            id={fieldId}
            rows={3}
            value={reason}
            maxLength={CANCEL_REASON_MAX}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${fieldId}-error` : undefined}
            onChange={(event) => setReason(event.target.value)}
            className="rounded-xl border-2 border-fog-light px-3 py-2 text-sm text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge"
          />
          {invalid ? (
            <p id={`${fieldId}-error`} className="text-sm text-rouge">
              {t('detail.reasonError')}
            </p>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">{t('detail.keep')}</AlertDialogCancel>
          <button
            type="button"
            disabled={cancel.isPending}
            onClick={submit}
            className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
          >
            {t('detail.confirmCancel')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
