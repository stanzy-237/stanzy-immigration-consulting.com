'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useContractErrors } from '@/features/contracts/hooks/use-contract-errors';
import { contractPdfUrl } from '@/features/contracts/lib/contract-urls';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { PdfPagesSkeleton } from '@/features/shared/components/signing/pdf-pages';
import { SigningFlow } from '@/features/shared/components/signing/signing-flow';
import { Link, useRouter } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/**
 * The Client signs a Contrat or an Avenant in « Mon espace » (#96), opened
 * from the email's button: the same flow as a Demande de signature. The
 * consultant's signature and stamp are already on it.
 */
export function ContractSignView({ dossierId, contractId }: { dossierId: string; contractId: string }): ReactNode {
  const t = useTranslations('Contracts.sign');
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white px-4 py-10 md:py-14">
        <div className="mx-auto grid max-w-3xl gap-8">
          <Link
            href={`/mon-espace/dossiers/${dossierId}#contrats`}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep"
          >
            <ArrowLeft aria-hidden={true} className="size-4" />
            {t('back')}
          </Link>
          <QueryBoundary fallback={<SignSkeleton />}>
            <SignContract dossierId={dossierId} contractId={contractId} />
          </QueryBoundary>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function SignContract({ dossierId, contractId }: { dossierId: string; contractId: string }): ReactNode {
  const t = useTranslations('Contracts');
  const format = useFormatter();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const failed = useContractErrors();
  const { data: contract } = useSuspenseQuery(trpc.contracts.get.queryOptions({ id: contractId }));
  const back = `/mon-espace/dossiers/${dossierId}#contrats`;

  const sign = useMutation(
    trpc.contracts.sign.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.contracts.pathKey() });
        toast.add({ title: t('toast.signed'), type: 'success' });
        router.push(back);
      },
      onError: failed,
    }),
  );

  const heading = (
    <div>
      <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">
        {t('sign.title', { title: contract.title })}
      </h1>
      <p className="mt-1 text-sm text-slate">{contract.number}</p>
    </div>
  );

  if (!contract.canSign) {
    return (
      <div className="grid gap-4">
        {heading}
        <p className="flex items-start gap-2 rounded-2xl border border-fog-light bg-white p-5 text-sm text-navy-deep shadow-sm">
          <CheckCircle2 aria-hidden={true} className="mt-0.5 size-5 shrink-0 text-leaf" />
          {contract.status === 'SIGNED' && contract.signedAt
            ? t('sign.alreadySigned', {
                date: format.dateTime(contract.signedAt, { day: 'numeric', month: 'long', year: 'numeric' }),
              })
            : t('sign.notWaiting')}
        </p>
        <a
          href={contractPdfUrl(contract.id)}
          target="_blank"
          rel="noopener"
          className="inline-flex h-11 w-fit items-center rounded-full bg-navy-deep px-5 text-sm font-semibold text-white hover:bg-navy-80"
        >
          {t('sign.openSigned')}
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-6 pb-24">
      {heading}
      <p className="rounded-xl bg-ice-blue px-4 py-3 text-sm text-navy-deep">{t('sign.intro')}</p>
      <SigningFlow
        url={contractPdfUrl(contract.id)}
        fields={contract.fields}
        document={contract.title}
        signerName={contract.signerName}
        pending={sign.isPending}
        onSign={({ name, signature }) => sign.mutate({ id: contract.id, name, signature, accepted: true })}
      />
    </div>
  );
}

function SignSkeleton(): ReactNode {
  return (
    <div className="grid gap-6">
      <Skeleton aria-hidden={true} className="h-10 w-2/3" />
      <PdfPagesSkeleton />
    </div>
  );
}
