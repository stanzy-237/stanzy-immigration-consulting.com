'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { CalendarClock, FileStack } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import NextLink from 'next/link';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { toast } from '@/components/ui/toast';
import { daysUntil } from '@/features/document-services/lib/requirements';
import { textIn } from '@/features/document-services/lib/service-schema';
import { URGENCY_CLASSES, urgencyOf } from '@/features/ita-countdown/lib/urgency';
import { utcDate, utcToday } from '@/features/ita-countdown/lib/ita-deadline';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Request = RouterOutputs['documentServices']['requirements']['forDossier'][number];
type Viewer = 'client' | 'consultant';

const card = 'grid grid-cols-1 gap-3 rounded-2xl border border-fog-light bg-white p-5 shadow-sm';

/**
 * At the top of a Dossier's Aperçu, for each Service documentaire under way
 * (#80): the days left before Stanzy delivers, from the start date the
 * consultant sets and the service's turnaround, and what is left to hand
 * over, with the way to its page. Nothing while there is none.
 */
export function ServiceProgressView({ dossierId, viewer }: { dossierId: string; viewer: Viewer }): ReactNode {
  return (
    <QueryBoundary fallback={null}>
      <Progress dossierId={dossierId} viewer={viewer} />
    </QueryBoundary>
  );
}

function Progress({ dossierId, viewer }: { dossierId: string; viewer: Viewer }): ReactNode {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.documentServices.requirements.forDossier.queryOptions({ dossierId }));
  if (data.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4">
      {data.map((request) => (
        <ServiceCard key={request.id} dossierId={dossierId} request={request} viewer={viewer} />
      ))}
    </div>
  );
}

function ServiceCard({ dossierId, request, viewer }: { dossierId: string; request: Request; viewer: Viewer }): ReactNode {
  const t = useTranslations('DocumentServices.progress');
  const locale = useLocale();
  const format = useFormatter();
  const day = (value: string) => format.dateTime(utcDate(value), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const name = request.service ? textIn(request.service.name, locale) : request.document;
  const headingId = `${request.id}-progress`;
  const left = request.dueOn ? daysUntil(request.dueOn, utcToday(new Date())) : null;
  const href = viewer === 'consultant' ? `/dossiers/${dossierId}/services/${request.id}` : `/mon-espace/services/demandes/${request.id}`;
  const linkClass = 'inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-rouge hover:text-crimson';
  const linkBody = (
    <>
      <FileStack aria-hidden={true} className="size-4" />
      {request.complete ? t('allGiven') : t('left', { count: request.left })}
    </>
  );

  return (
    <section aria-labelledby={headingId} className={card}>
      <h2 id={headingId} className="flex items-center gap-2 text-sm font-semibold text-slate">
        <CalendarClock aria-hidden={true} className="size-4 text-rouge" />
        {name}
      </h2>
      {request.dueOn && left !== null ? (
        left >= 0 ? (
          <p className={`font-heading text-3xl font-bold ${URGENCY_CLASSES[urgencyOf(left)].text}`}>
            {t('daysLeft', { count: left })}
            <span className="ml-2 align-middle text-sm font-normal text-slate">{t('dueOn', { date: day(request.dueOn) })}</span>
          </p>
        ) : (
          <p className="text-sm font-semibold text-honey">{t('late', { date: day(request.dueOn) })}</p>
        )
      ) : (
        <p className="text-sm text-slate">{request.turnaroundDays ? t('notStarted') : t('noTurnaround')}</p>
      )}
      {request.startedOn ? <p className="text-xs text-slate">{t('startedOn', { date: day(request.startedOn) })}</p> : null}
      {request.hasRequirements ? (
        viewer === 'consultant' ? (
          <NextLink href={href} className={linkClass}>
            {linkBody}
          </NextLink>
        ) : (
          <Link href={href} className={linkClass}>
            {linkBody}
          </Link>
        )
      ) : null}
      {viewer === 'consultant' ? <StartForm dossierId={dossierId} request={request} /> : null}
    </section>
  );
}

/** The consultant sets the day the work starts (proof of funds: the draw from the pool), or takes it off. */
function StartForm({ dossierId, request }: { dossierId: string; request: Request }): ReactNode {
  const t = useTranslations('DocumentServices.progress');
  const id = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(request.startedOn ?? '');
  const save = useMutation(
    trpc.documentServices.requirements.setStart.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.documentServices.requirements.forDossier.queryKey({ dossierId }) });
        toast.add({ title: t('startSaved'), type: 'success' });
      },
      onError: () => toast.add({ title: t('error'), type: 'error' }),
    }),
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ requestId: request.id, startedOn: value || null });
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label htmlFor={`${id}-start`} className="grid gap-1 text-xs font-semibold text-slate">
        {t('start')}
        <input
          id={`${id}-start`}
          type="date"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-10 rounded-xl border-2 border-fog-light bg-white px-3 text-sm text-navy-deep focus:border-navy-deep focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={save.isPending}
        className="inline-flex h-10 items-center rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white disabled:opacity-50"
      >
        {t('saveStart')}
      </button>
    </form>
  );
}
