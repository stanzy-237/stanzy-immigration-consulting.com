'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Circle, Clock, FileStack, FileText, HandHelping, ListChecks, ScrollText, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { ContractText, ServicePrice } from '@/features/document-services/components/service-parts';
import { textIn } from '@/features/document-services/lib/service-schema';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { useTRPC } from '@/trpc/client';

/**
 * One Service documentaire in « Mon espace » (#80): what it gets, what to
 * provide, the turnaround, its conditions, its contract and its price. Come
 * from « Stanzy s'en charge » on a Document (`documentId`), the Client
 * accepts the conditions and contract and asks Stanzy; the consultant then
 * sends that contract to sign and the invoice.
 */
export function MyServiceView({ slug, documentId }: { slug: string; documentId: string | null }): ReactNode {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white">
        <QueryBoundary fallback={<ServiceSkeleton />}>
          <Service slug={slug} documentId={documentId} />
        </QueryBoundary>
      </main>
      <SiteFooter />
    </>
  );
}

function Service({ slug, documentId }: { slug: string; documentId: string | null }): ReactNode {
  const t = useTranslations('DocumentServices.service');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.documentServices.get.queryOptions({ slug, documentId }));
  useEffect(() => track('service.viewed', { service: slug, fromDocument: documentId !== null }), [slug, documentId]);
  const back = (
    <Link
      href={documentId ? `/mon-espace/services?document=${documentId}` : '/mon-espace/services'}
      className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-ice-blue hover:text-white"
    >
      <ArrowLeft aria-hidden={true} className="size-4" />
      {t('back')}
    </Link>
  );
  if (!data.service) {
    return (
      <div className="mx-auto grid grid-cols-1 max-w-3xl gap-4 px-4 py-14">
        <p className="rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate shadow-sm">{t('unavailable')}</p>
      </div>
    );
  }
  const { service, document, inDossier } = data;
  const facts = [
    { key: 'provides', icon: ListChecks, text: textIn(service.provides, locale) },
    { key: 'turnaround', icon: Clock, text: textIn(service.turnaround, locale) },
    { key: 'conditions', icon: ShieldCheck, text: textIn(service.conditions, locale) },
  ] as const;

  return (
    <>
      <section className="relative overflow-hidden bg-navy-deep px-4 pt-10 pb-24 text-white md:pt-14">
        <div aria-hidden={true} className="absolute -top-24 -right-24 size-80 rounded-full bg-rouge/30 blur-3xl" />
        <div className="relative mx-auto grid grid-cols-1 max-w-5xl gap-4">
          {back}
          <h1 className="max-w-3xl font-heading text-h3 font-bold sm:text-h2">{textIn(service.name, locale)}</h1>
          <p className="max-w-2xl text-body-lg whitespace-pre-line text-ice-blue">{textIn(service.summary, locale)}</p>
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
                  <h2 className="font-semibold text-navy-deep">{t(key)}</h2>
                  <p className="text-sm whitespace-pre-line text-slate">{text}</p>
                </div>
              </li>
            ))}
          </ul>

          {service.prerequisites.length > 0 ? (
            <section aria-labelledby="service-prerequisites" className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 id="service-prerequisites" className="flex items-center gap-2 font-heading text-xl font-bold text-navy-deep">
                <FileStack aria-hidden={true} className="size-5 text-rouge" />
                {t('prerequisites')}
              </h2>
              <p className="mt-1 text-sm text-slate">{document ? t('prerequisitesForYou') : t('prerequisitesIntro')}</p>
              <ul className="mt-4 grid grid-cols-1 gap-2">
                {service.prerequisites.map((item, index) => {
                  const held = inDossier?.[index] ?? false;
                  return (
                    <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-off-white px-4 py-3">
                      <span className="flex items-center gap-2 text-sm font-semibold text-navy-deep">
                        {held ? (
                          <CheckCircle2 aria-hidden={true} className="size-4 shrink-0 text-leaf" />
                        ) : (
                          <Circle aria-hidden={true} className="size-4 shrink-0 text-slate" />
                        )}
                        {item[locale === 'en' ? 'en' : 'fr']}
                        {item.when === 'donation' ? (
                          <span className="text-xs font-normal text-slate">{t('ifDonation')}</span>
                        ) : null}
                      </span>
                      {held ? (
                        <span className="rounded-full bg-leaf-tint px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-leaf">
                          {t('inDossier')}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="service-contract" className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 id="service-contract" className="flex items-center gap-2 font-heading text-xl font-bold text-navy-deep">
              <ScrollText aria-hidden={true} className="size-5 text-rouge" />
              {t('contract')}
            </h2>
            <p className="mt-1 text-sm text-slate">{t('contractIntro')}</p>
            <div className="mt-4 max-h-96 overflow-y-auto rounded-xl border border-fog-light bg-off-white p-5">
              <p className="mb-3 font-heading font-bold text-navy-deep">{textIn(service.contractTitle, locale)}</p>
              <ContractText body={textIn(service.contractBody, locale)} />
            </div>
          </section>
        </div>

        <aside className="grid grid-cols-1 gap-4 lg:sticky lg:top-24">
          <div className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-6 shadow-md">
            <p className="text-xs font-semibold tracking-wide text-slate uppercase">{t('price')}</p>
            <ServicePrice service={service} />
            <p className="text-xs text-slate">{t('priceNote')}</p>
          </div>
          {document ? (
            <Ask serviceId={service.id} document={document} />
          ) : documentId ? (
            <p className="rounded-2xl bg-white p-5 text-sm text-slate shadow-sm">{t('documentGone')}</p>
          ) : (
            <p className="rounded-2xl bg-white p-5 text-sm text-slate shadow-sm">{t('howTo')}</p>
          )}
        </aside>
      </div>
    </>
  );
}

/** « Stanzy s'en charge » for one Document, once the conditions and the contract are accepted. */
function Ask({
  serviceId,
  document,
}: {
  serviceId: string;
  document: { id: string; title: string; dossierId: string };
}): ReactNode {
  const t = useTranslations('DocumentServices.service');
  const errors = useTranslations('Accompagnement.errors');
  const id = useId();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [accepted, setAccepted] = useState(false);
  const ask = useMutation(
    trpc.accompagnement.stanzy.request.mutationOptions({
      onSuccess: (request) => {
        void queryClient.invalidateQueries({
          queryKey: trpc.dossiers.documents.sections.queryKey({ dossierId: document.dossierId }),
        });
        toast.add({ title: t('asked'), type: 'success' });
        // What to hand over for the service has its own page; else back to the Document.
        router.push(
          request.requirements
            ? `/mon-espace/services/demandes/${request.id}`
            : `/mon-espace/dossiers/${document.dossierId}?document=${document.id}#documents`,
        );
      },
      onError: (error) => {
        const known = errors.has(error.message);
        toast.add({ title: errors(known ? error.message : 'UNKNOWN'), type: known ? 'warning' : 'error' });
      },
    }),
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (accepted) ask.mutate({ documentId: document.id, serviceId, accepted: true });
      }}
      className="grid grid-cols-1 gap-4 rounded-2xl border-2 border-navy-deep bg-white p-6 shadow-md"
    >
      <p className="flex items-start gap-2 text-sm text-navy-deep">
        <FileText aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-rouge" />
        <span>
          {t('for')} <strong>{document.title}</strong>
        </span>
      </p>
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
        disabled={!accepted || ask.isPending}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-rouge px-6 font-heading text-body font-bold text-white hover:bg-crimson disabled:opacity-50"
      >
        <HandHelping aria-hidden={true} className="size-5" />
        {ask.isPending ? t('asking') : t('ask')}
      </button>
      <p className="text-xs text-slate">{t('next')}</p>
    </form>
  );
}

function ServiceSkeleton(): ReactNode {
  const t = useTranslations('DocumentServices.service');
  return (
    <div role="status" className="mx-auto grid grid-cols-1 max-w-5xl gap-4 px-4 py-14">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-40 rounded-2xl" />
      <Skeleton aria-hidden={true} className="h-96 rounded-2xl" />
    </div>
  );
}
