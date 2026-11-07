'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, FileStack, HandHelping, Hourglass, ListChecks, LogIn, ScrollText, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { withNext } from '@/features/auth/lib/safe-next-path';
import { ContractText, ServicePrice } from '@/features/document-services/components/service-parts';
import { offerPath, ORDER_NOTE_MAX } from '@/features/document-services/lib/order-schema';
import { textIn } from '@/features/document-services/lib/service-schema';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Offer = RouterOutputs['documentServices']['orders']['offer'];

/**
 * A Service documentaire's private link (#80), for someone who wants this
 * service only: the consultant sends it on WhatsApp. They read how Stanzy
 * works, what to hand over, the contract and the price, then sign in and
 * order it. Once the consultant approves, their Dossier opens with the
 * contract to sign.
 */
export function OfferView({ token, signedIn }: { token: string; signedIn: boolean }): ReactNode {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white">
        <QueryBoundary fallback={<OfferSkeleton />}>
          <OfferPage token={token} signedIn={signedIn} />
        </QueryBoundary>
      </main>
      <SiteFooter />
    </>
  );
}

function OfferPage({ token, signedIn }: { token: string; signedIn: boolean }): ReactNode {
  const t = useTranslations('DocumentServices.offer');
  const service = useTranslations('DocumentServices.service');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.documentServices.orders.offer.queryOptions({ token }));
  const offer = data.service;
  const facts = [
    { key: 'provides', icon: ListChecks, text: textIn(offer.provides, locale) },
    { key: 'turnaround', icon: Clock, text: textIn(offer.turnaround, locale) },
    { key: 'conditions', icon: ShieldCheck, text: textIn(offer.conditions, locale) },
  ] as const;

  return (
    <>
      <section className="relative overflow-hidden bg-navy-deep px-4 pt-10 pb-24 text-white md:pt-14">
        <div aria-hidden={true} className="absolute -top-24 -right-24 size-80 rounded-full bg-rouge/30 blur-3xl" />
        <div className="relative mx-auto grid grid-cols-1 max-w-5xl gap-4">
          <p className="text-xs font-semibold tracking-widest text-ice-blue uppercase">{t('eyebrow')}</p>
          <h1 className="max-w-3xl font-heading text-h3 font-bold sm:text-h2">{textIn(offer.name, locale)}</h1>
          <p className="max-w-2xl text-body-lg whitespace-pre-line text-ice-blue">{textIn(offer.summary, locale)}</p>
        </div>
      </section>

      <div className="relative mx-auto -mt-14 grid grid-cols-1 max-w-5xl items-start gap-6 px-4 pb-16 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-6 lg:col-span-2">
          <ul className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-6 shadow-sm">
            {facts.map(({ key, icon: Icon, text }) => (
              <li key={key} className="flex gap-4">
                <span aria-hidden={true} className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ice-blue">
                  <Icon className="size-5 text-navy-deep" />
                </span>
                <div>
                  <h2 className="font-semibold text-navy-deep">{service(key)}</h2>
                  <p className="text-sm whitespace-pre-line text-slate">{text}</p>
                </div>
              </li>
            ))}
          </ul>

          {offer.prerequisites.length > 0 ? (
            <section aria-labelledby="offer-prerequisites" className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 id="offer-prerequisites" className="flex items-center gap-2 font-heading text-xl font-bold text-navy-deep">
                <FileStack aria-hidden={true} className="size-5 text-rouge" />
                {service('prerequisites')}
              </h2>
              <p className="mt-1 text-sm text-slate">{t('prerequisitesIntro')}</p>
              <ul className="mt-4 grid grid-cols-1 gap-2">
                {offer.prerequisites.map((item) => (
                  <li key={item.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-off-white px-4 py-3 text-sm font-semibold text-navy-deep">
                    {item[locale === 'en' ? 'en' : 'fr']}
                    {item.when === 'donation' ? (
                      <span className="text-xs font-normal text-slate">{service('ifDonation')}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="offer-contract" className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 id="offer-contract" className="flex items-center gap-2 font-heading text-xl font-bold text-navy-deep">
              <ScrollText aria-hidden={true} className="size-5 text-rouge" />
              {service('contract')}
            </h2>
            <p className="mt-1 text-sm text-slate">{service('contractIntro')}</p>
            <div className="mt-4 max-h-96 overflow-y-auto rounded-xl border border-fog-light bg-off-white p-5">
              <p className="mb-3 font-heading font-bold text-navy-deep">{textIn(offer.contractTitle, locale)}</p>
              <ContractText body={textIn(offer.contractBody, locale)} />
            </div>
          </section>
        </div>

        <aside className="grid grid-cols-1 gap-4 lg:sticky lg:top-24">
          <div className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-6 shadow-md">
            <p className="text-xs font-semibold tracking-wide text-slate uppercase">{service('price')}</p>
            <ServicePrice service={offer} />
            <p className="text-xs text-slate">{t('priceNote')}</p>
          </div>
          <OrderBox token={token} signedIn={signedIn} order={data.order} />
        </aside>
      </div>
    </>
  );
}

/** Ordering: sign in first; then the order's state, or the form to send one. */
function OrderBox({ token, signedIn, order }: { token: string; signedIn: boolean; order: Offer['order'] }): ReactNode {
  const t = useTranslations('DocumentServices.offer');
  const box = 'grid grid-cols-1 gap-3 rounded-2xl border-2 border-navy-deep bg-white p-6 shadow-md';
  if (!signedIn) {
    return (
      <div className={box}>
        <p className="text-sm text-navy-deep">{t('signInFirst')}</p>
        <Link
          href={withNext('/connexion', offerPath(token))}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-rouge px-6 font-heading text-body font-bold text-white hover:bg-crimson"
        >
          <LogIn aria-hidden={true} className="size-5" />
          {t('signIn')}
        </Link>
      </div>
    );
  }
  if (order?.status === 'SUBMITTED') {
    return (
      <div role="status" className={box}>
        <p className="flex items-center gap-2 font-semibold text-navy-deep">
          <Hourglass aria-hidden={true} className="size-5 text-honey" />
          {t('pending')}
        </p>
        <p className="text-sm text-slate">{t('pendingBody')}</p>
      </div>
    );
  }
  if (order?.status === 'APPROVED' && order.dossierId) {
    return (
      <div className={box}>
        <p className="flex items-center gap-2 font-semibold text-navy-deep">
          <CheckCircle2 aria-hidden={true} className="size-5 text-leaf" />
          {t('approved')}
        </p>
        <Link
          href={`/mon-espace/dossiers/${order.dossierId}`}
          className="inline-flex h-12 items-center justify-center rounded-full bg-navy-deep px-6 font-heading text-body font-bold text-white hover:bg-navy-80"
        >
          {t('openDossier')}
        </Link>
      </div>
    );
  }
  return (
    <>
      {order?.status === 'REJECTED' ? (
        <p className="rounded-2xl bg-white p-5 text-sm text-slate shadow-sm">
          {t('rejected')}
          {order.rejectNote ? ` · ${order.rejectNote}` : ''}
        </p>
      ) : null}
      <OrderForm token={token} />
    </>
  );
}

function OrderForm({ token }: { token: string }): ReactNode {
  const t = useTranslations('DocumentServices.offer');
  const service = useTranslations('DocumentServices.service');
  const id = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [accepted, setAccepted] = useState(false);
  const [note, setNote] = useState('');
  const order = useMutation(
    trpc.documentServices.orders.order.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.documentServices.orders.offer.queryKey({ token }) });
        track('service.ordered');
        toast.add({ title: t('ordered'), type: 'success' });
      },
      onError: (error) => {
        const known = t.has(`errors.${error.message}`);
        toast.add({ title: t(known ? `errors.${error.message}` : 'errors.UNKNOWN'), type: known ? 'warning' : 'error' });
      },
    }),
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (accepted) order.mutate({ token, note: note.trim(), accepted: true });
      }}
      className="grid grid-cols-1 gap-4 rounded-2xl border-2 border-navy-deep bg-white p-6 shadow-md"
    >
      <label htmlFor={`${id}-note`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
        {t('note')}
        <textarea
          id={`${id}-note`}
          rows={3}
          maxLength={ORDER_NOTE_MAX}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="w-full rounded-xl border-2 border-fog-light bg-white px-3.5 py-2.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none"
        />
        <span className="text-xs font-normal text-slate">{t('noteHint')}</span>
      </label>
      <label htmlFor={`${id}-accept`} className="flex items-start gap-3 text-sm font-semibold text-navy-deep">
        <input
          id={`${id}-accept`}
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-rouge"
        />
        {t('accept')}
      </label>
      <button
        type="submit"
        disabled={!accepted || order.isPending}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-rouge px-6 font-heading text-body font-bold text-white hover:bg-crimson disabled:opacity-50"
      >
        <HandHelping aria-hidden={true} className="size-5" />
        {order.isPending ? service('asking') : t('order')}
      </button>
      <p className="text-xs text-slate">{t('next')}</p>
    </form>
  );
}

function OfferSkeleton(): ReactNode {
  const t = useTranslations('DocumentServices.offer');
  return (
    <div role="status" className="mx-auto grid grid-cols-1 max-w-5xl gap-4 px-4 py-14">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-40 rounded-2xl" />
      <Skeleton aria-hidden={true} className="h-96 rounded-2xl" />
    </div>
  );
}
