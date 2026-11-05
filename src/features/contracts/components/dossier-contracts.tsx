'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ExternalLink, FilePlus2, PenLine, ScrollText, Send, XCircle } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useContractErrors } from '@/features/contracts/hooks/use-contract-errors';
import { BODY_MAX, REASON_MAX, SCHEDULE_MAX, TITLE_MAX } from '@/features/contracts/lib/contract-schema';
import { contractPdfUrl } from '@/features/contracts/lib/contract-urls';
import { CURRENCIES, formatMoney, toMinor, type Currency } from '@/features/invoices/lib/money';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Data = RouterOutputs['contracts']['forDossier'];
type Contract = Data['contracts'][number];

const field =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none';
const area =
  'w-full rounded-xl border-2 border-fog-light bg-white px-3.5 py-2.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none';

const STATUS_STYLES: Record<Contract['status'], string> = {
  SENT: 'bg-honey-tint text-honey',
  SIGNED: 'bg-leaf-tint text-leaf',
  CANCELLED: 'bg-fog-light text-slate',
};

/**
 * A Dossier's Contrat and its Avenants (#96). The consultant sends the
 * Contrat (from the service's template), cancels one not signed yet, and
 * sends Avenants once it is signed; the Client signs each one and opens its
 * PDF, the signed one with its Certificat de signature. `?contrat=nouveau`
 * (from an approved Demande d'intérêt) opens « Envoyer le contrat » at once.
 */
export function DossierContracts({
  dossierId,
  viewer,
}: {
  dossierId: string;
  viewer: 'consultant' | 'client';
}): ReactNode {
  const t = useTranslations('Contracts.panel');
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.contracts.forDossier.queryOptions({ dossierId }));
  const consultant = viewer === 'consultant';
  const search = useSearchParams();
  const main = data.contracts.filter((contract) => !contract.parentId);
  const live = main.find((contract) => contract.status !== 'CANCELLED');
  const [sending, setSending] = useState(
    () => consultant && data.open && !live && search.get('contrat') === 'nouveau',
  );
  const [amending, setAmending] = useState<Contract | null>(null);

  const pendingAmendment = data.contracts.some((contract) => contract.parentId && contract.status === 'SENT');
  const waiting = data.contracts.filter((contract) => contract.status === 'SENT');

  return (
    <section id="contrats" aria-labelledby={`${dossierId}-contracts`} className="grid scroll-mt-20 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id={`${dossierId}-contracts`} className="font-heading text-2xl font-bold text-navy-deep">
            {t('title')}
          </h2>
          {consultant ? (
            <span
              className={
                data.signed
                  ? 'rounded-full bg-leaf-tint px-3 py-1 text-xs font-semibold text-leaf'
                  : 'rounded-full bg-honey-tint px-3 py-1 text-xs font-semibold text-honey'
              }
            >
              {data.signed ? t('signedPill') : t('unsigned')}
            </span>
          ) : null}
        </div>
        {consultant && data.open && !live ? (
          <button
            type="button"
            onClick={() => setSending(true)}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-navy-deep px-4 text-sm font-semibold text-white hover:bg-navy-80"
          >
            <Send aria-hidden={true} className="size-4" />
            {t('new')}
          </button>
        ) : null}
        {consultant && data.open && live?.status === 'SIGNED' && !pendingAmendment ? (
          <button
            type="button"
            onClick={() => setAmending(live)}
            className="inline-flex h-11 items-center gap-1.5 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
          >
            <FilePlus2 aria-hidden={true} className="size-4" />
            {t('amendment')}
          </button>
        ) : null}
      </div>

      {!consultant && data.open
        ? waiting.map((contract) => (
            <p
              key={contract.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-rouge/30 bg-blush/40 px-4 py-3 text-sm font-semibold text-navy-deep"
            >
              {t('waiting', { number: contract.number })}
              <SignLink dossierId={dossierId} contract={contract} />
            </p>
          ))
        : null}

      {data.contracts.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-8 text-center text-sm text-slate">
          {consultant ? t('emptyConsultant') : t('emptyClient')}
        </p>
      ) : (
        <ul className="grid gap-3">
          {data.contracts.map((contract) => (
            <li key={contract.id}>
              <ContractRow
                dossierId={dossierId}
                contract={contract}
                parent={data.contracts.find((other) => other.id === contract.parentId) ?? null}
                consultant={consultant}
                open={data.open}
              />
            </li>
          ))}
        </ul>
      )}

      {consultant ? (
        <>
          <SendDialog
            open={sending}
            onOpenChange={setSending}
            dossierId={dossierId}
            locale={data.locale === 'en' ? 'en' : 'fr'}
          />
          <AmendmentDialog contract={amending} onClose={() => setAmending(null)} dossierId={dossierId} />
        </>
      ) : null}
    </section>
  );
}

function ContractRow({
  dossierId,
  contract,
  parent,
  consultant,
  open,
}: {
  dossierId: string;
  contract: Contract;
  parent: Contract | null;
  consultant: boolean;
  open: boolean;
}): ReactNode {
  const t = useTranslations('Contracts');
  const format = useFormatter();
  const locale = useLocale();
  const [cancelling, setCancelling] = useState(false);
  const date = (value: Date) => format.dateTime(value, { day: 'numeric', month: 'long', year: 'numeric' });
  const signed = contract.status === 'SIGNED';

  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fog-light bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <ScrollText aria-hidden={true} className="mt-0.5 size-5 shrink-0 text-slate" />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-navy-deep">{contract.number}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[contract.status]}`}>
              {t(`status.${contract.status}`)}
            </span>
          </p>
          <p className="truncate text-sm text-navy-deep">{contract.title}</p>
          <p className="text-xs text-slate">
            {parent ? `${t('panel.amendmentOf', { number: parent.number })} · ` : null}
            {contract.amount && contract.currency
              ? `${t('panel.price', {
                  amount: formatMoney(contract.amount, contract.currency as Currency, locale),
                  schedule: contract.schedule ?? '',
                })} · `
              : null}
            {signed && contract.signedAt
              ? t('panel.signedOn', { date: date(contract.signedAt), name: contract.signedName ?? '' })
              : contract.status === 'CANCELLED' && contract.cancelledAt
                ? t('panel.cancelledOn', { date: date(contract.cancelledAt) })
                : t('panel.sentOn', { date: date(contract.sentAt) })}
            {contract.cancelReason ? ` · ${t('panel.reason', { reason: contract.cancelReason })}` : null}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {!consultant && open && contract.status === 'SENT' ? <SignLink dossierId={dossierId} contract={contract} /> : null}
        <a
          href={contractPdfUrl(contract.id)}
          target="_blank"
          rel="noopener"
          aria-label={
            signed
              ? t('panel.signedPdfLabel', { number: contract.number })
              : t('panel.pdfLabel', { number: contract.number })
          }
          className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-rouge hover:text-crimson"
        >
          {signed ? t('panel.signedPdf') : t('panel.pdf')}
          <ExternalLink aria-hidden={true} className="size-3.5" />
        </a>
        {consultant && open && contract.status === 'SENT' ? (
          <button
            type="button"
            onClick={() => setCancelling(true)}
            aria-label={t('panel.cancelLabel', { number: contract.number })}
            className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-slate hover:text-rouge"
          >
            <XCircle aria-hidden={true} className="size-4" />
            {t('panel.cancel')}
          </button>
        ) : null}
      </div>
      {consultant ? (
        <CancelDialog dossierId={dossierId} contract={contract} open={cancelling} onOpenChange={setCancelling} />
      ) : null}
    </article>
  );
}

function SignLink({ dossierId, contract }: { dossierId: string; contract: Contract }): ReactNode {
  const t = useTranslations('Contracts.panel');
  return (
    <Link
      href={`/mon-espace/dossiers/${dossierId}/contrats/${contract.id}`}
      aria-label={t('signLabel', { number: contract.number })}
      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-rouge px-4 text-sm font-semibold text-white hover:bg-crimson"
    >
      <PenLine aria-hidden={true} className="size-4" />
      {t('sign')}
    </Link>
  );
}

/** Re-reads the Dossier's Contrats, and the « Contrat non signé » it shows. */
function useRefresh(dossierId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: trpc.contracts.pathKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.dossiers.dashboard.get.queryKey({ id: dossierId }) });
  };
}

/** « Envoyer le contrat »: language, price and échéancier; the text comes from the service's template. */
function SendDialog({
  open,
  onOpenChange,
  dossierId,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossierId: string;
  locale: 'fr' | 'en';
}): ReactNode {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-4 p-6 sm:max-w-lg">
        {open ? <SendForm dossierId={dossierId} locale={locale} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SendForm({
  dossierId,
  locale,
  onDone,
}: {
  dossierId: string;
  locale: 'fr' | 'en';
  onDone: () => void;
}): ReactNode {
  const t = useTranslations('Contracts');
  const ids = useId();
  const trpc = useTRPC();
  const refresh = useRefresh(dossierId);
  const failed = useContractErrors();
  const [language, setLanguage] = useState(locale);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('XAF');
  const [schedule, setSchedule] = useState('');
  const [invalid, setInvalid] = useState(false);
  const send = useMutation(
    trpc.contracts.send.mutationOptions({
      onSuccess: ({ number }) => {
        refresh();
        toast.add({ title: t('toast.sent', { number }), type: 'success' });
        onDone();
      },
      onError: failed,
    }),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const minor = toMinor(amount, currency);
    setInvalid(!minor);
    if (!minor) return;
    send.mutate({ dossierId, locale: language, amount: minor, currency, schedule: schedule.trim() });
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('send.title')}</DialogTitle>
        <DialogDescription className="text-sm text-slate">{t('send.body')}</DialogDescription>
      </DialogHeader>
      <label htmlFor={`${ids}-locale`} className="grid gap-1 text-sm font-semibold text-navy-deep">
        {t('send.locale')}
        <select
          id={`${ids}-locale`}
          value={language}
          onChange={(event) => setLanguage(event.target.value === 'en' ? 'en' : 'fr')}
          className={field}
        >
          <option value="fr">{t('send.fr')}</option>
          <option value="en">{t('send.en')}</option>
        </select>
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label htmlFor={`${ids}-amount`} className="col-span-2 grid gap-1 text-sm font-semibold text-navy-deep">
          {t('send.amount')}
          <input
            id={`${ids}-amount`}
            inputMode="decimal"
            required={true}
            value={amount}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${ids}-amount-error` : undefined}
            onChange={(event) => setAmount(event.target.value)}
            className={field}
          />
        </label>
        <label htmlFor={`${ids}-currency`} className="grid gap-1 text-sm font-semibold text-navy-deep">
          {t('send.currency')}
          <select
            id={`${ids}-currency`}
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
            className={field}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      </div>
      {invalid ? (
        <p id={`${ids}-amount-error`} className="-mt-2 text-sm text-crimson">
          {t('send.invalidAmount')}
        </p>
      ) : null}
      <label htmlFor={`${ids}-schedule`} className="grid gap-1 text-sm font-semibold text-navy-deep">
        {t('send.schedule')}
        <textarea
          id={`${ids}-schedule`}
          rows={2}
          required={true}
          minLength={2}
          maxLength={SCHEDULE_MAX}
          value={schedule}
          placeholder={t('send.schedulePlaceholder')}
          onChange={(event) => setSchedule(event.target.value)}
          className={area}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-navy-deep hover:bg-off-white"
        >
          {t('send.cancel')}
        </button>
        <button
          type="submit"
          disabled={send.isPending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
        >
          <Send aria-hidden={true} className="size-4" />
          {send.isPending ? t('send.sending') : t('send.submit')}
        </button>
      </div>
    </form>
  );
}

/** An Avenant to a signed Contrat: a title and its text, written freely. */
function AmendmentDialog({
  contract,
  onClose,
  dossierId,
}: {
  contract: Contract | null;
  onClose: () => void;
  dossierId: string;
}): ReactNode {
  return (
    <Dialog open={contract !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="gap-4 p-6 sm:max-w-2xl">
        {contract ? <AmendmentForm contract={contract} dossierId={dossierId} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AmendmentForm({
  contract,
  dossierId,
  onDone,
}: {
  contract: Contract;
  dossierId: string;
  onDone: () => void;
}): ReactNode {
  const t = useTranslations('Contracts');
  const ids = useId();
  const trpc = useTRPC();
  const refresh = useRefresh(dossierId);
  const failed = useContractErrors();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const send = useMutation(
    trpc.contracts.sendAmendment.mutationOptions({
      onSuccess: ({ number }) => {
        refresh();
        toast.add({ title: t('toast.sent', { number }), type: 'success' });
        onDone();
      },
      onError: failed,
    }),
  );
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        send.mutate({ contractId: contract.id, title: title.trim(), body: body.trim() });
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('amendment.title')}</DialogTitle>
        <DialogDescription className="text-sm text-slate">
          {t('amendment.body', { number: contract.number })}
        </DialogDescription>
      </DialogHeader>
      <label htmlFor={`${ids}-title`} className="grid gap-1 text-sm font-semibold text-navy-deep">
        {t('amendment.titleLabel')}
        <input
          id={`${ids}-title`}
          required={true}
          minLength={3}
          maxLength={TITLE_MAX}
          value={title}
          placeholder={t('amendment.titlePlaceholder')}
          onChange={(event) => setTitle(event.target.value)}
          className={field}
        />
      </label>
      <label htmlFor={`${ids}-body`} className="grid gap-1 text-sm font-semibold text-navy-deep">
        {t('amendment.text')}
        <textarea
          id={`${ids}-body`}
          rows={10}
          required={true}
          minLength={20}
          maxLength={BODY_MAX}
          value={body}
          aria-describedby={`${ids}-hint`}
          onChange={(event) => setBody(event.target.value)}
          className={area}
        />
        <span id={`${ids}-hint`} className="text-xs font-normal text-slate">
          {t('amendment.textHint')}
        </span>
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-navy-deep hover:bg-off-white"
        >
          {t('amendment.cancel')}
        </button>
        <button
          type="submit"
          disabled={send.isPending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
        >
          <Send aria-hidden={true} className="size-4" />
          {t('amendment.submit')}
        </button>
      </div>
    </form>
  );
}

function CancelDialog({
  dossierId,
  contract,
  open,
  onOpenChange,
}: {
  dossierId: string;
  contract: Contract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactNode {
  const t = useTranslations('Contracts');
  const id = useId();
  const trpc = useTRPC();
  const refresh = useRefresh(dossierId);
  const failed = useContractErrors();
  const [reason, setReason] = useState('');
  const cancel = useMutation(
    trpc.contracts.cancel.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.add({ title: t('toast.cancelled'), type: 'deleted' });
      },
      onError: failed,
    }),
  );
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-5 p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">
            {t('cancel.title', { number: contract.number })}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate">{t('cancel.body')}</AlertDialogDescription>
        </AlertDialogHeader>
        <label htmlFor={id} className="grid gap-1 text-sm font-semibold text-navy-deep">
          {t('cancel.reason')}
          <input
            id={id}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={field}
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">{t('cancel.keep')}</AlertDialogCancel>
          <button
            type="button"
            disabled={cancel.isPending}
            onClick={() => {
              cancel.mutate({ id: contract.id, reason: reason.trim() || undefined });
              onOpenChange(false);
            }}
            className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
          >
            {t('cancel.confirm')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DossierContractsSkeleton(): ReactNode {
  const t = useTranslations('Contracts.panel');
  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden={true} className="grid gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    </div>
  );
}
