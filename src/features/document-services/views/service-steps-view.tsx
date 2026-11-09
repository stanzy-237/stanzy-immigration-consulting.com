'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { CheckCircle2, Lock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { DoneNote } from '@/features/document-services/components/service-parts';
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
  const tHandOver = useTranslations('DocumentServices.requirements.handOver');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.documentServices.requirements.forDossier.queryOptions({ dossierId }));
  const services = data.filter((request) => request.handOverFirst);
  const open = services.filter((request) => request.handOver === 'OPEN');
  // Set while step ① shows; when the last « Suivant » opens step ②, its documents slide in, once.
  const [hadOpenStep, setHadOpenStep] = useState(open.length > 0);
  if (open.length > 0 && !hadOpenStep) setHadOpenStep(true);

  if (services.length === 0) return children;
  if (open.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4">
        <Stepper step="documents" />
        <div
          className={
            hadOpenStep
              ? 'grid grid-cols-1 gap-4 transition duration-300 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:starting:translate-y-0'
              : 'grid grid-cols-1 gap-4'
          }
        >
          {services.map((request) => (
            <DoneNote key={request.id}>
              <span>
                {request.service ? `${textIn(request.service.name, locale)} · ` : null}
                {tHandOver(request.handOver === 'CONFIRMED' ? 'confirmed' : 'submitted')}
              </span>
              <Link href={`/mon-espace/services/demandes/${request.id}`} className="underline underline-offset-2">
                {t('review')}
              </Link>
            </DoneNote>
          ))}
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <Stepper step="pieces" />
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

/** ① Pièces à remettre, ② Documents à recevoir: where the Client is. */
function Stepper({ step }: { step: 'pieces' | 'documents' }): ReactNode {
  const t = useTranslations('DocumentServices.steps');
  const current = 'rounded-2xl border-2 border-navy-deep bg-white px-4 py-3';
  const done = 'rounded-2xl border border-leaf-tint bg-leaf-tint px-4 py-3 text-leaf';
  const later = 'rounded-2xl border border-fog-light bg-off-white px-4 py-3 text-slate';
  return (
    <ol aria-label={t('label')} className="grid grid-cols-2 gap-2">
      <li aria-current={step === 'pieces' ? 'step' : undefined} className={step === 'pieces' ? current : done}>
        <span className={step === 'pieces' ? 'block text-xs font-semibold text-rouge' : 'flex items-center gap-1 text-xs font-semibold'}>
          {step === 'pieces' ? `1 · ${t('current')}` : (
            <>
              <CheckCircle2 aria-hidden={true} className="size-3" />1 · {t('done')}
            </>
          )}
        </span>
        <span className="font-heading text-sm font-bold text-navy-deep">{t('pieces')}</span>
      </li>
      <li aria-current={step === 'documents' ? 'step' : undefined} className={step === 'documents' ? current : later}>
        <span className={step === 'documents' ? 'block text-xs font-semibold text-rouge' : 'flex items-center gap-1 text-xs font-semibold'}>
          {step === 'documents' ? (
            `2 · ${t('current')}`
          ) : (
            <>
              <Lock aria-hidden={true} className="size-3" />2 · {t('locked')}
            </>
          )}
        </span>
        <span className={step === 'documents' ? 'font-heading text-sm font-bold text-navy-deep' : 'font-heading text-sm font-bold'}>
          {t('documents')}
        </span>
      </li>
    </ol>
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
