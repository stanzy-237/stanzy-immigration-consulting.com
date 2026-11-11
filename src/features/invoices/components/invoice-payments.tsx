'use client';

import { useMutation } from '@tanstack/react-query';
import { ExternalLink, FileSignature, Paperclip, Plus } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
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
import { LONG_DAY, noonUtc } from '@/features/budget/lib/day';
import { DOCUMENT_FILE_TYPES } from '@/features/dossiers/lib/document-schema';
import { useInvoiceMutation } from '@/features/invoices/hooks/use-invoice-mutation';
import { PAYMENT_METHODS, PAYMENT_NOTE_MAX, type PaymentMethod } from '@/features/invoices/lib/invoice-schema';
import { proofFileUrl, receiptFileUrl, uploadProofFile } from '@/features/invoices/lib/invoice-urls';
import { isAwaitingPayment } from '@/features/invoices/lib/invoice-status';
import { formatMoney, minorToInput, toMinor } from '@/features/invoices/lib/money';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Invoice = RouterOutputs['invoices']['dashboard']['get'];

const ACCEPT = [...DOCUMENT_FILE_TYPES, '.heic', '.heif'].join(',');

/** Today in the browser's zone, as `YYYY-MM-DD`. */
const today = (): string => new Date().toLocaleDateString('en-CA');

/**
 * A Facture's Paiements (#145): what was received and what is left, each
 * Paiement with its Reconnaissance de réception de fonds and justificatif.
 * The consultant records them; the Client opens each Reconnaissance and
 * signs it from their Dossier.
 */
export function InvoicePayments({
  invoice,
  viewer,
}: {
  invoice: Pick<Invoice, 'id' | 'currency' | 'status' | 'total' | 'received' | 'payments'> & { dossier: { id: string } };
  viewer: 'consultant' | 'client';
}): ReactNode {
  const t = useTranslations('Invoices');
  const locale = useLocale();
  const format = useFormatter();
  const [recording, setRecording] = useState(false);
  const money = (minor: number) => formatMoney(minor, invoice.currency, locale);
  const balance = invoice.total - invoice.received;
  const canRecord = viewer === 'consultant' && isAwaitingPayment(invoice.status) && balance > 0;

  if (viewer === 'client' && invoice.payments.length === 0) return null;
  return (
    <section className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading text-base font-bold text-navy-deep">{t('payments.title')}</h3>
        {invoice.payments.length > 0 ? (
          <p className="text-sm text-slate">
            {t('payments.summary', { received: money(invoice.received), total: money(invoice.total), balance: money(balance) })}
          </p>
        ) : null}
      </div>
      {invoice.payments.length === 0 ? (
        <p className="text-sm text-slate">{t('payments.empty')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {invoice.payments.map((payment) => (
            <li key={payment.id} className="grid grid-cols-1 gap-2 rounded-lg bg-off-white px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-navy-deep">{money(payment.amount)}</span>
                <span className="text-slate">
                  {format.dateTime(noonUtc(payment.receivedOn), LONG_DAY)} ·{' '}
                  {payment.method === 'OTHER' && payment.methodNote
                    ? payment.methodNote
                    : payment.method
                      ? t(`receipt.methods.${payment.method}`)
                      : null}
                </span>
              </div>
              {payment.receiptNumber ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-navy-deep">{t('payments.receipt', { number: payment.receiptNumber })}</span>
                  <span
                    className={
                      payment.signedAt
                        ? 'rounded-full bg-leaf-tint px-2 py-0.5 text-xs font-semibold text-leaf'
                        : 'rounded-full bg-honey-tint px-2 py-0.5 text-xs font-semibold text-honey'
                    }
                  >
                    {payment.signedAt
                      ? t('payments.signed', {
                          name: payment.signedName ?? '',
                          date: format.dateTime(payment.signedAt, { day: 'numeric', month: 'long', year: 'numeric' }),
                        })
                      : t('payments.toSign')}
                  </span>
                  <a
                    href={receiptFileUrl(payment.id)}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 font-semibold text-rouge hover:text-crimson"
                  >
                    {t('payments.openReceipt')}
                    <ExternalLink aria-hidden={true} className="size-3.5" />
                  </a>
                  {viewer === 'client' && !payment.signedAt ? (
                    <Link
                      href={`/mon-espace/dossiers/${invoice.dossier.id}/recus/${payment.id}`}
                      aria-label={t('payments.signLabel', { number: payment.receiptNumber })}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-rouge px-4 font-semibold text-white hover:bg-crimson"
                    >
                      <FileSignature aria-hidden={true} className="size-4" />
                      {t('payments.sign')}
                    </Link>
                  ) : null}
                </div>
              ) : null}
              {payment.proofs.map((proof) => (
                <a
                  key={proof.id}
                  href={proofFileUrl(proof.id)}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex w-fit items-center gap-1 text-slate hover:text-navy-deep"
                >
                  <Paperclip aria-hidden={true} className="size-3.5" />
                  {t('payments.justificatif')} · {proof.fileName}
                </a>
              ))}
            </li>
          ))}
        </ul>
      )}
      {canRecord ? (
        <>
          <button
            type="button"
            onClick={() => setRecording(true)}
            className="inline-flex h-11 w-fit items-center gap-1.5 rounded-full bg-leaf px-5 text-sm font-semibold text-white hover:bg-navy-deep"
          >
            <Plus aria-hidden={true} className="size-4" />
            {t('payments.record')}
          </button>
          {recording ? (
            <RecordPaymentDialog
              invoiceId={invoice.id}
              currency={invoice.currency}
              balance={balance}
              onClose={() => setRecording(false)}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/** « Enregistrer un paiement »: amount (the balance by default), day, method, an optional justificatif. */
function RecordPaymentDialog({
  invoiceId,
  currency,
  balance,
  onClose,
}: {
  invoiceId: string;
  currency: Invoice['currency'];
  balance: number;
  onClose: () => void;
}): ReactNode {
  const t = useTranslations('Invoices');
  const locale = useLocale();
  const id = useId();
  const trpc = useTRPC();
  const { refresh, failed } = useInvoiceMutation();
  const [amount, setAmount] = useState(minorToInput(balance, currency));
  const [receivedOn, setReceivedOn] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [methodNote, setMethodNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [invalid, setInvalid] = useState<{ amount?: boolean; note?: boolean }>({});
  const record = useMutation(trpc.invoices.payments.record.mutationOptions());

  const submit = async () => {
    const minor = toMinor(amount, currency);
    const problems = {
      amount: minor === null || minor < 1 || minor > balance,
      note: method === 'OTHER' && methodNote.trim() === '',
    };
    setInvalid(problems);
    if (problems.amount || problems.note || minor === null) return;
    setSending(true);
    try {
      const proof = file ? { invoiceId, ...(await uploadProofFile(invoiceId, file)) } : undefined;
      const result = await record.mutateAsync({
        invoiceId,
        amount: minor,
        receivedOn,
        method,
        methodNote: method === 'OTHER' ? methodNote.trim() : null,
        proof,
      });
      void refresh();
      onClose();
      toast.add({ title: t('toast.recorded', { number: result.number }), type: 'success' });
    } catch (error) {
      failed({ message: error instanceof Error ? error.message : '' });
    } finally {
      setSending(false);
    }
  };

  const field = 'h-11 rounded-xl border-2 border-fog-light px-3 text-sm text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge';
  return (
    <AlertDialog open={true} onOpenChange={(open) => !open && !sending && onClose()}>
      <AlertDialogContent className="gap-5 p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('payments.recordTitle')}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate">{t('payments.recordBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-1 gap-1.5">
            <label htmlFor={`${id}-amount`} className="text-sm font-semibold text-navy-deep">
              {t('payments.amount')}
            </label>
            <input
              id={`${id}-amount`}
              inputMode="decimal"
              value={amount}
              aria-invalid={invalid.amount}
              aria-describedby={invalid.amount ? `${id}-amount-error` : undefined}
              onChange={(event) => setAmount(event.target.value)}
              className={field}
            />
            {invalid.amount ? (
              <p id={`${id}-amount-error`} className="text-sm text-rouge">
                {t('payments.amountError', { balance: formatMoney(balance, currency, locale) })}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            <label htmlFor={`${id}-day`} className="text-sm font-semibold text-navy-deep">
              {t('payments.receivedOn')}
            </label>
            <input
              id={`${id}-day`}
              type="date"
              required
              max={today()}
              value={receivedOn}
              onChange={(event) => event.target.value && setReceivedOn(event.target.value)}
              className={field}
            />
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:col-span-2">
            <label htmlFor={`${id}-method`} className="text-sm font-semibold text-navy-deep">
              {t('payments.method')}
            </label>
            <select
              id={`${id}-method`}
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
              className={`${field} bg-white`}
            >
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {t(`receipt.methods.${value}`)}
                </option>
              ))}
            </select>
          </div>
          {method === 'OTHER' ? (
            <div className="grid grid-cols-1 gap-1.5 sm:col-span-2">
              <label htmlFor={`${id}-note`} className="text-sm font-semibold text-navy-deep">
                {t('payments.methodNote')}
              </label>
              <input
                id={`${id}-note`}
                value={methodNote}
                maxLength={PAYMENT_NOTE_MAX}
                aria-invalid={invalid.note}
                aria-describedby={invalid.note ? `${id}-note-error` : undefined}
                onChange={(event) => setMethodNote(event.target.value)}
                className={field}
              />
              {invalid.note ? (
                <p id={`${id}-note-error`} className="text-sm text-rouge">
                  {t('payments.methodNoteError')}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-1.5 sm:col-span-2">
            <label htmlFor={`${id}-proof`} className="text-sm font-semibold text-navy-deep">
              {t('payments.proof')}
            </label>
            <input
              id={`${id}-proof`}
              type="file"
              accept={ACCEPT}
              aria-describedby={`${id}-proof-hint`}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="text-sm text-navy-deep file:mr-3 file:h-9 file:rounded-full file:border-0 file:bg-off-white file:px-4 file:font-semibold file:text-navy-deep"
            />
            <p id={`${id}-proof-hint`} className="text-xs text-slate">
              {t('payments.proofHint')}
            </p>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={sending} className="rounded-full">
            {t('payments.cancel')}
          </AlertDialogCancel>
          <button
            type="button"
            disabled={sending}
            onClick={() => void submit()}
            className="rounded-full bg-leaf px-5 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
          >
            {sending ? t('payments.sending') : t('payments.confirm')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
