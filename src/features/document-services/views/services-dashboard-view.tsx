'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link2, PackagePlus, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { ServicePrice } from '@/features/document-services/components/service-parts';
import { STARTER_SERVICES } from '@/features/document-services/data/starter-services';
import { textIn } from '@/features/document-services/lib/service-schema';
import { useTRPC } from '@/trpc/client';

/**
 * « Services documentaires » in the Tableau de bord (#80): the catalogue
 * Clients in Cameroon see in « Mon espace », in order, each active or not,
 * with its price. The starting services can be added in one click, inactive
 * and unpriced, for the consultant to price before turning them on. Each
 * active one has a private link to send on WhatsApp to someone who wants it
 * alone; their orders wait in « Services en cours » (Clients).
 */
export function ServicesDashboardView(): ReactNode {
  const t = useTranslations('DocumentServices.dashboard');
  return (
    <div className="mx-auto grid grid-cols-1 max-w-5xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">{t('title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate">{t('intro')}</p>
        </div>
        <Link
          href="/services/nouveau"
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-navy-deep px-4 text-sm font-semibold text-white hover:bg-navy-80"
        >
          <Plus aria-hidden={true} className="size-4" />
          {t('new')}
        </Link>
      </div>
      <QueryBoundary fallback={<CatalogueSkeleton />}>
        <Catalogue />
      </QueryBoundary>
    </div>
  );
}

function Catalogue(): ReactNode {
  const t = useTranslations('DocumentServices.dashboard');
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: services } = useSuspenseQuery(trpc.documentServices.dashboard.list.queryOptions());
  const missing = STARTER_SERVICES.filter((starter) => !services.some((service) => service.slug === starter.slug));
  const addStarters = useMutation(
    trpc.documentServices.dashboard.addStarters.mutationOptions({
      onSuccess: ({ added }) => {
        void queryClient.invalidateQueries({ queryKey: trpc.documentServices.dashboard.list.queryKey() });
        toast.add({ title: t('startersAdded', { count: added }), type: 'success' });
      },
      onError: () => toast.add({ title: t('error'), type: 'error' }),
    }),
  );

  return (
    <div className="grid grid-cols-1 gap-4">
      {missing.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-fog-light bg-white p-5">
          <p className="max-w-xl text-sm text-navy-deep">{t('starters', { count: missing.length })}</p>
          <button
            type="button"
            disabled={addStarters.isPending}
            onClick={() => addStarters.mutate()}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white disabled:opacity-50"
          >
            <PackagePlus aria-hidden={true} className="size-4" />
            {t('addStarters')}
          </button>
        </div>
      ) : null}
      {services.length === 0 ? (
        <p className="rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate shadow-sm">{t('empty')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {services.map((service) => (
            <li key={service.id} className="grid grid-cols-1 gap-2">
              <Link
                href={`/services/${service.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-fog-light bg-white p-5 shadow-sm hover:border-navy-deep sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 sm:flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-navy-deep">{textIn(service.name, locale)}</span>
                    <span
                      className={
                        service.active
                          ? 'rounded-full bg-leaf-tint px-2.5 py-0.5 text-xs font-semibold text-leaf'
                          : 'rounded-full bg-fog-light px-2.5 py-0.5 text-xs font-semibold text-slate'
                      }
                    >
                      {service.active ? t('active') : t('inactive')}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-sm text-slate">
                    {t('requests', { count: service._count.requests })} · /{service.slug}
                  </p>
                </div>
                {service.price > 0 ? (
                  <ServicePrice service={service} className="sm:max-w-56 sm:shrink-0 sm:text-right" />
                ) : (
                  <span className="w-fit shrink-0 rounded-full bg-honey-tint px-3 py-1 text-xs font-semibold text-honey">{t('noPrice')}</span>
                )}
              </Link>
              {service.active ? <ShareLink serviceId={service.id} name={textIn(service.name, locale)} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Copies the service's private link, made on first use; « Nouveau lien » stops the old one working. */
function ShareLink({ serviceId, name }: { serviceId: string; name: string }): ReactNode {
  const t = useTranslations('DocumentServices.dashboard');
  const trpc = useTRPC();
  const share = useMutation(trpc.documentServices.orders.dashboard.shareLink.mutationOptions());
  const copy = async (renew: boolean) => {
    try {
      const { url } = await share.mutateAsync({ id: serviceId, renew });
      await navigator.clipboard.writeText(url);
      toast.add({ title: renew ? t('linkRenewed') : t('linkCopied'), description: url, type: 'success' });
    } catch {
      toast.add({ title: t('error'), type: 'error' });
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-1 px-2">
      <button
        type="button"
        disabled={share.isPending}
        onClick={() => void copy(false)}
        aria-label={t('copyLinkLabel', { name })}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-rouge hover:bg-white disabled:opacity-50"
      >
        <Link2 aria-hidden={true} className="size-4" />
        {t('copyLink')}
      </button>
      <button
        type="button"
        disabled={share.isPending}
        onClick={() => void copy(true)}
        aria-label={t('renewLinkLabel', { name })}
        className="inline-flex h-9 items-center rounded-full px-3 text-xs font-semibold text-slate hover:bg-white hover:text-navy-deep disabled:opacity-50"
      >
        {t('renewLink')}
      </button>
    </div>
  );
}

function CatalogueSkeleton(): ReactNode {
  const t = useTranslations('DocumentServices.dashboard');
  return (
    <div role="status" className="grid grid-cols-1 gap-3">
      <span className="sr-only">{t('loading')}</span>
      {[1, 2, 3].map((key) => (
        <Skeleton key={key} aria-hidden={true} className="h-20 rounded-2xl" />
      ))}
    </div>
  );
}
