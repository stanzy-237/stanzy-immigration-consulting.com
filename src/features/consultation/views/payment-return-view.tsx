'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentConfirmed } from '@/features/consultation/components/payment-confirmed';
import { PaymentProgress, paymentScreen } from '@/features/consultation/components/payment-progress';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

const POLL_MS = 3000;

/**
 * Where SasPay's page sends the payer back (`/reserver/paiement/<id>`), often
 * in the tab it opened: `3 Vérification` until SasPay answers, then
 * `6 Confirmée`, or `4 Refusé` with the way back to the booking. Only the
 * payment's own id (a random UUID) opens it.
 */
export function PaymentReturnView({ paymentId }: { paymentId: string }): ReactNode {
  return (
    <MotionConfig reducedMotion="user">
      <SiteNav />
      <main className="flex min-h-dvh flex-col bg-off-white">
        <QueryBoundary fallback={<ReturnSkeleton />}>
          <PaymentReturn paymentId={paymentId} />
        </QueryBoundary>
      </main>
    </MotionConfig>
  );
}

function PaymentReturn({ paymentId }: { paymentId: string }): ReactNode {
  const t = useTranslations('Consultation.reservation');
  const trpc = useTRPC();
  const { data: payment } = useSuspenseQuery({
    ...trpc.consultation.paymentReturn.queryOptions({ paymentId }),
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? POLL_MS : false),
  });

  if (payment.status === 'SUCCESS' && payment.consultation) return <PaymentConfirmed payment={payment} />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-8 pb-16 lg:pt-16">
      <section className="flex flex-col gap-6 rounded-3xl bg-white p-6 lg:border-2 lg:border-navy-deep lg:p-8">
        <h1 className="font-heading text-h4 leading-6 font-bold text-ink">
          {payment.networkName ? t('payment.titleWith', { network: payment.networkName }) : t('payment.title')}
        </h1>
        <PaymentProgress payment={payment} screen={paymentScreen(payment, { returned: true })} heldUntil={payment.heldUntil ? new Date(payment.heldUntil) : null} />
        {payment.status === 'FAILED' ? (
          <Link
            href="/services/consultation/reserver"
            className="flex h-13 items-center justify-center rounded-full bg-rouge px-6 font-heading text-body font-bold text-white hover:bg-crimson"
          >
            {t('returned.back')}
          </Link>
        ) : null}
      </section>
    </div>
  );
}

function ReturnSkeleton(): ReactNode {
  const t = useTranslations('Consultation.reservation');
  return (
    <div role="status" className="mx-auto flex w-full max-w-3xl animate-skeleton-in flex-col gap-4 px-5 pt-8 lg:pt-16">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-96 rounded-3xl" />
    </div>
  );
}
