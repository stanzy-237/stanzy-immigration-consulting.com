'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { DoorOpen, Video } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { useMeetingErrors } from '@/features/meetings/hooks/use-meeting-errors';
import { clientRoomPath } from '@/features/meetings/lib/meeting-schema';
import { Link, useRouter } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/**
 * An invitation link (#94), signed in only: someone invited goes straight
 * to the room; anyone else asks to enter and waits on this page until the
 * consultant lets them in (or not).
 */
export function InvitationView({ token }: { token: string }): ReactNode {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white px-4 py-10 md:py-14">
        <div className="mx-auto grid grid-cols-1 max-w-xl gap-6">
          <QueryBoundary fallback={<InvitationSkeleton />}>
            <Invitation token={token} />
          </QueryBoundary>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Invitation({ token }: { token: string }): ReactNode {
  const t = useTranslations('Meetings');
  const format = useFormatter();
  const trpc = useTRPC();
  const router = useRouter();
  const failed = useMeetingErrors();
  // While waiting to be let in, asked again every 4 seconds.
  const { data: invitation, refetch } = useSuspenseQuery({
    ...trpc.meetings.invitation.get.queryOptions({ token }),
    refetchInterval: (query) => (query.state.data?.viewer === 'PENDING' ? 4000 : false),
  });
  const ask = useMutation(trpc.meetings.invitation.request.mutationOptions({ onSuccess: () => void refetch(), onError: failed }));
  const inside = invitation.viewer === 'invited' || invitation.viewer === 'ADMITTED' || invitation.viewer === 'consultant';
  const open = invitation.status === 'SCHEDULED' && !invitation.past;

  // Invited, or just let in: on to the room.
  useEffect(() => {
    if (inside && open) router.replace(clientRoomPath(invitation.id));
  }, [inside, open, invitation.id, router]);

  const box = 'grid gap-4 rounded-2xl border border-fog-light bg-white p-6 text-center shadow-sm';
  const header = (
    <div>
      <p className="font-label text-rouge">{t('hub.invitation.title')}</p>
      <h1 className="mt-2 font-heading text-2xl font-bold text-navy-deep">{invitation.subject}</h1>
      {invitation.kind === 'PERSONAL' ? null : (
        <p className="mt-1 text-sm text-slate first-letter:uppercase">
          {format.dateTime(invitation.startsAt, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );

  if (invitation.status === 'CANCELLED') return <div className={box}>{header}<p className="text-sm text-slate">{t('hub.invitation.cancelled')}</p></div>;
  if (!open) return <div className={box}>{header}<p className="text-sm text-slate">{t('hub.invitation.over')}</p></div>;
  if (inside) {
    return (
      <div className={box}>
        {header}
        <Link
          href={clientRoomPath(invitation.id)}
          className="inline-flex h-12 items-center justify-center gap-2 justify-self-center rounded-full bg-rouge px-6 text-sm font-semibold text-white hover:bg-crimson"
        >
          <Video aria-hidden={true} className="size-4" />
          {t('hub.invitation.open')}
        </Link>
      </div>
    );
  }
  if (invitation.viewer === 'REFUSED') return <div className={box}>{header}<p className="text-sm text-slate">{t('hub.invitation.refused')}</p></div>;
  if (invitation.viewer === 'PENDING') {
    return (
      <div className={box}>
        {header}
        <p role="status" className="text-sm text-navy-deep">
          {t('hub.invitation.waiting')}
        </p>
      </div>
    );
  }
  return (
    <div className={box}>
      {header}
      <button
        type="button"
        disabled={ask.isPending}
        onClick={() => ask.mutate({ token })}
        className="inline-flex h-12 items-center justify-center gap-2 justify-self-center rounded-full bg-rouge px-6 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
      >
        <DoorOpen aria-hidden={true} className="size-4" />
        {ask.isPending ? t('hub.invitation.asking') : t('hub.invitation.ask')}
      </button>
    </div>
  );
}

function InvitationSkeleton(): ReactNode {
  const t = useTranslations('Meetings.hub.invitation');
  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-56 rounded-2xl" />
    </div>
  );
}
