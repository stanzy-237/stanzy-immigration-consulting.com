'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { CheckCircle2, Lock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { textIn } from '@/features/document-services/lib/service-schema';
import { RequirementsView } from '@/features/document-services/views/requirements-view';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/**
 * The Documents tab of a Client's Dossier when a Service documentaire waits
 * for its pieces (#80): ① what to hand over, ending with « Suivant », and
 * ② the documents to receive (`children`), shown once the Client clicked
 * « Suivant » or the consultant confirmed the pieces. Without such a
 * service, `children` as they are.
 */
export function ServiceStepsView({ dossierId, children }: { dossierId: string; children: ReactNode }): ReactNode {
  return (
    <QueryBoundary fallback={<StepsSkeleton />}>
      <Steps dossierId={dossierId}>{children}</Steps>
    </QueryBoundary>
  );
}

function Steps({ dossierId, children }: { dossierId: string; children: ReactNode }): ReactNode {
  const t = useTranslations('DocumentServices.steps');
  const handOver = useTranslations('DocumentServices.requirements.handOver');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.documentServices.requirements.forDossier.queryOptions({ dossierId }));
  const services = data.filter((request) => request.hasRequirements);
  const open = services.filter((request) => request.handOver === 'OPEN');
  // « Suivant » just opened step ②: its documents slide in, once.
  const [wasOpen, setWasOpen] = useState(open.length > 0);
  if (open.length > 0 && !wasOpen) setWasOpen(true);
  const justOpened = wasOpen && open.length === 0;

  if (open.length === 0) {
    return (
      <div
        className={
          justOpened
            ? 'grid grid-cols-1 gap-4 transition duration-300 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:starting:translate-y-0'
            : 'grid grid-cols-1 gap-4'
        }
      >
        {services.map((request) => (
          <p
            key={request.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-leaf-tint px-5 py-3 text-sm font-semibold text-leaf"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 aria-hidden={true} className="size-4 shrink-0" />
              {request.service ? `${textIn(request.service.name, locale)} · ` : null}
              {handOver(request.handOver === 'CONFIRMED' ? 'confirmed' : 'submitted')}
            </span>
            <Link href={`/mon-espace/services/demandes/${request.id}`} className="underline underline-offset-2">
              {t('review')}
            </Link>
          </p>
        ))}
        {children}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <ol aria-label={t('label')} className="grid grid-cols-2 gap-2">
        <li aria-current="step" className="rounded-2xl border-2 border-navy-deep bg-white px-4 py-3">
          <span className="block text-xs font-semibold text-rouge">1 · {t('current')}</span>
          <span className="font-heading text-sm font-bold text-navy-deep">{t('pieces')}</span>
        </li>
        <li className="rounded-2xl border border-fog-light bg-off-white px-4 py-3 text-slate">
          <span className="flex items-center gap-1 text-xs font-semibold">
            <Lock aria-hidden={true} className="size-3" />2 · {t('locked')}
          </span>
          <span className="font-heading text-sm font-bold">{t('documents')}</span>
        </li>
      </ol>
      <section aria-labelledby={`${dossierId}-pieces`} className="grid grid-cols-1 gap-6">
        <h2 id={`${dossierId}-pieces`} className="font-heading text-xl font-bold text-navy-deep">
          {t('pieces')}
        </h2>
        {open.map((request) => (
          <RequirementsView key={request.id} requestId={request.id} viewer="client" layout="step" />
        ))}
      </section>
      <section
        aria-labelledby={`${dossierId}-documents`}
        className="flex items-start gap-3 rounded-2xl border border-dashed border-fog-light bg-white/60 p-5"
      >
        <Lock aria-hidden={true} className="mt-0.5 size-5 shrink-0 text-slate" />
        <div>
          <h2 id={`${dossierId}-documents`} className="font-heading text-base font-bold text-slate">
            {t('documents')}
          </h2>
          <p className="mt-1 text-sm text-slate">{t('lockedText')}</p>
        </div>
      </section>
    </div>
  );
}

function StepsSkeleton(): ReactNode {
  const t = useTranslations('DocumentServices.steps');
  return (
    <div role="status" className="grid grid-cols-1 gap-4">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-16 rounded-2xl" />
      <Skeleton aria-hidden={true} className="h-72 rounded-2xl" />
    </div>
  );
}
