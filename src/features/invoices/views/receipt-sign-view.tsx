'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { LONG_DAY, noonUtc } from '@/features/budget/lib/day';
import { useInvoiceMutation } from '@/features/invoices/hooks/use-invoice-mutation';
import { receiptFileUrl } from '@/features/invoices/lib/invoice-urls';
import { formatMoney } from '@/features/invoices/lib/money';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { PdfPagesSkeleton } from '@/features/shared/components/signing/pdf-pages';
import { SigningFlow } from '@/features/shared/components/signing/signing-flow';
import { Link, useRouter } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/**
 * The Client signs a Reconnaissance de réception de fonds (#145) in « Mon
 * espace », as they sign a Contrat. Stanzy's signature and stamp are already on it.
 */
export function ReceiptSignView({ dossierId, paymentId }: { dossierId: string; paymentId: string }): ReactNode {
  const t = useTranslations('Invoices.receiptSign');
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white px-4 py-10 md:py-14">
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-8">
          <Link
            href={`/mon-espace/dossiers/${dossierId}#factures`}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep"
          >
            <ArrowLeft aria-hidden={true} className="size-4" />
            {t('back')}
          </Link>
          <QueryBoundary fallback={<SignSkeleton />}>
            <SignReceipt dossierId={dossierId} paymentId={paymentId} />
          </QueryBoundary>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function SignReceipt({ dossierId, paymentId }: { dossierId: string; paymentId: string }): ReactNode {
  const t = useTranslations('Invoices.receiptSign');
  const locale = useLocale();
  const format = useFormatter();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { failed } = useInvoiceMutation();
  const { data: receipt } = useSuspenseQuery(trpc.invoices.payments.get.queryOptions({ id: paymentId }));
  const back = `/mon-espace/dossiers/${dossierId}#factures`;

  const sign = useMutation(
    trpc.invoices.payments.sign.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.invoices.pathKey() });
        toast.add({ title: t('signed'), type: 'success' });
        router.push(back);
      },
      onError: failed,
    }),
  );

  const heading = (
    <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">{t('title', { number: receipt.number })}</h1>
  );

  if (receipt.signedAt) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {heading}
        <p className="flex items-start gap-2 rounded-2xl border border-fog-light bg-white p-5 text-sm text-navy-deep shadow-sm">
          <CheckCircle2 aria-hidden={true} className="mt-0.5 size-5 shrink-0 text-leaf" />
          {t('alreadySigned', { date: format.dateTime(receipt.signedAt, { day: 'numeric', month: 'long', year: 'numeric' }) })}
        </p>
        <a
          href={receiptFileUrl(receipt.id)}
          target="_blank"
          rel="noopener"
          className="inline-flex h-11 w-fit items-center rounded-full bg-navy-deep px-5 text-sm font-semibold text-white hover:bg-navy-80"
        >
          {t('openSigned')}
        </a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 pb-24">
      {heading}
      <p className="rounded-xl bg-ice-blue px-4 py-3 text-sm text-navy-deep">
        {t('intro', {
          amount: formatMoney(receipt.amount, receipt.currency, locale),
          date: format.dateTime(noonUtc(receipt.receivedOn), LONG_DAY),
        })}
      </p>
      <SigningFlow
        url={receiptFileUrl(receipt.id)}
        fields={receipt.fields}
        document={receipt.number}
        signerName={receipt.signerName}
        pending={sign.isPending}
        onSign={({ name, signature }) => sign.mutate({ id: receipt.id, name, signature, accepted: true })}
      />
    </div>
  );
}

function SignSkeleton(): ReactNode {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Skeleton aria-hidden={true} className="h-10 w-2/3" />
      <PdfPagesSkeleton />
    </div>
  );
}
