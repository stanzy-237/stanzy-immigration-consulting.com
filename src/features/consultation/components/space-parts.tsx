'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { Check, MessageCircle, Video } from 'lucide-react';
import Image from 'next/image';
import { useFormatter, useLocale, useNow, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { AddToCalendar } from '@/features/consultation/components/payment-confirmed';
import { PRESS } from '@/features/consultation/lib/styles';
import { FOOTER_SOCIALS } from '@/features/landing/data/footer';
import { clientRoomPath } from '@/features/meetings/lib/meeting-schema';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

const DOUALA = 'Africa/Douala';
/** « Rejoindre » opens 15 minutes before the start (meeting-schema's rule). */
export const JOIN_BEFORE_MS = 15 * 60_000;
export const WHATSAPP_URL = FOOTER_SOCIALS.find((s) => s.key === 'whatsapp')?.href ?? null;

/** Mon espace's tabs (`Mon espace v2`): Accueil, Mes consultations. */
export function SpaceTabs(): ReactNode {
  const t = useTranslations('Consultation.space');
  const path = usePathname();
  const tabs = [
    { href: '/mon-espace', label: t('tabs.home'), active: path === '/mon-espace' },
    { href: '/mon-espace/consultations', label: t('tabs.consultations'), active: path.startsWith('/mon-espace/consultations') },
  ] as const;
  return (
    <nav aria-label={t('tabs.label')} className="flex gap-6">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? 'page' : undefined}
          className={cn('border-b-2 pb-1.5 text-body-sm font-semibold', tab.active ? 'border-rouge text-navy-deep' : 'border-transparent text-slate hover:text-ink')}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

type NextConsultation = { id: string; startsAt: Date | string; durationMinutes: number; meetingId?: string | null; paymentId?: string | null };

/**
 * The navy card of `Mon espace v2 · 1 Avant`: « Dans 2 jours · Votre
 * consultation », the date, « Ajouter au calendrier », and « Rejoindre »
 * from 15 minutes before (the Réunion's room asks for the recording consent),
 * else « Déplacer » or `action`.
 */
export function NextConsultationCard({ consultation, action }: { consultation: NextConsultation; action?: ReactNode }): ReactNode {
  const t = useTranslations('Consultation.space');
  const format = useFormatter();
  const locale = useLocale();
  const now = useNow({ updateInterval: 30_000 });
  const starts = new Date(consultation.startsAt);
  const ends = new Date(starts.getTime() + consultation.durationMinutes * 60_000);
  const canJoin = consultation.meetingId && now.getTime() >= starts.getTime() - JOIN_BEFORE_MS;
  const time = (d: Date) => format.dateTime(d, { hour: '2-digit', minute: '2-digit', timeZone: DOUALA });
  const roomPath = consultation.meetingId ? clientRoomPath(consultation.meetingId) : '/mon-espace';
  return (
    <section aria-labelledby={`next-${consultation.id}`} className="relative flex flex-col gap-5 overflow-hidden rounded-3xl bg-navy-deep p-6 text-white md:p-8">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded-full bg-honey-tint px-2.5 py-0.5 text-caption font-semibold text-honey">{format.relativeTime(starts, now)}</span>
        <span className="font-label text-label font-bold tracking-wide text-rose uppercase">{t('yourConsultation')}</span>
      </div>
      <div className="flex items-center gap-4">
        <span aria-hidden={true} className="flex size-16 shrink-0 flex-col items-center justify-center rounded-xl bg-white">
          <span className="font-label text-label font-bold text-rouge uppercase">{format.dateTime(starts, { month: 'short', timeZone: DOUALA })}</span>
          <span className="font-heading text-h3 leading-7 font-extrabold text-navy-deep">{format.dateTime(starts, { day: 'numeric', timeZone: DOUALA })}</span>
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span id={`next-${consultation.id}`} className="font-heading text-h4 font-bold first-letter:uppercase md:text-h3">
            {format.dateTime(starts, { weekday: 'long', timeZone: DOUALA })} · {time(starts)} – {time(ends)}
          </span>
          <span className="text-body-sm text-white/80">{t('where')}</span>
        </span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {canJoin ? (
          <Link href={roomPath} className={cn('flex h-13 items-center justify-center gap-2 rounded-full bg-rouge px-6 font-heading text-body font-bold text-white hover:bg-crimson', PRESS)}>
            <Video aria-hidden={true} className="size-4.5" strokeWidth={2.2} />
            {t('join')}
          </Link>
        ) : null}
        {consultation.paymentId ? (
          <div className="flex sm:w-64">
            <AddToCalendar
              paymentId={consultation.paymentId}
              event={{
                id: consultation.meetingId ?? consultation.id,
                title: t('calendarTitle'),
                details: t('calendarDetails'),
                startsAt: starts,
                minutes: consultation.durationMinutes,
                url: typeof window === 'undefined' ? roomPath : `${window.location.origin}/${locale}${roomPath}`,
              }}
            />
          </div>
        ) : null}
        {action}
      </div>
    </section>
  );
}

/** The browser's « this device tested its camera » flag, kept on the device. */
const CAMERA_KEY = 'stanzy.camera-tested';
const cameraListeners = new Set<() => void>();
export function useCameraTested(): [boolean, () => void] {
  const tested = useSyncExternalStore(
    (listener) => {
      cameraListeners.add(listener);
      return () => cameraListeners.delete(listener);
    },
    () => window.localStorage.getItem(CAMERA_KEY) === '1',
    () => false,
  );
  return [
    tested,
    () => {
      window.localStorage.setItem(CAMERA_KEY, '1');
      for (const listener of cameraListeners) listener();
    },
  ];
}

/** « Testez votre caméra et votre micro »: the camera's picture and the microphone's level, then « Ça marche ». */
export function CameraTest({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }): ReactNode {
  const t = useTranslations('Consultation.space.camera');
  const [, markTested] = useCameraTested();
  const video = useRef<HTMLVideoElement>(null);
  const [level, setLevel] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let context: AudioContext | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((media) => {
        stream = media;
        if (video.current) video.current.srcObject = media;
        context = new AudioContext();
        const analyser = context.createAnalyser();
        context.createMediaStreamSource(media).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          const peak = data.reduce((max, v) => Math.max(max, Math.abs(v - 128)), 0);
          setLevel(Math.min(1, peak / 64));
          frame = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => setFailed(true));
    return () => {
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-lg flex-col gap-4 rounded-3xl bg-white p-6">
        <DialogTitle className="font-heading text-h4 font-bold text-navy-deep">{t('title')}</DialogTitle>
        <DialogDescription className="text-body-sm text-slate">{failed ? t('failed') : t('lead')}</DialogDescription>
        <video ref={video} autoPlay={true} muted={true} playsInline={true} className="aspect-video w-full rounded-2xl bg-navy-deep object-cover" />
        <div className="flex items-center gap-3 text-caption text-slate">
          <span>{t('mic')}</span>
          <span aria-hidden={true} className="h-2 flex-1 overflow-hidden rounded-full bg-ice-blue">
            <span className="block h-full rounded-full bg-leaf transition-[width] duration-100" style={{ width: `${Math.round(level * 100)}%` }} />
          </span>
        </div>
        <button
          type="button"
          disabled={failed}
          onClick={() => {
            markTested();
            onOpenChange(false);
            toast.add({ title: t('done'), type: 'success' });
          }}
          className={cn('h-12 rounded-full bg-navy-deep font-heading text-body-sm font-bold text-white disabled:opacity-50', PRESS)}
        >
          {t('works')}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/**
 * « Choisir un autre créneau » (`Mon espace v2 · 4 Déplacer le créneau`): the
 * free days, then their starts, « Déplacer à jeu. 26 · 11:00 » or « Garder
 * mon créneau ». The payment and the answers follow.
 */
export function MoveDialog({ id, startsAt, open, onOpenChange }: { id: string; startsAt: Date | string; open: boolean; onOpenChange: (open: boolean) => void }): ReactNode {
  const t = useTranslations('Consultation.space.move');
  const format = useFormatter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const options = useQuery({ ...trpc.consultationSpace.moveOptions.queryOptions({ id }), enabled: open });
  const [day, setDay] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const days = (options.data?.days ?? []).filter((d) => d.starts.length > 0);
  const shownDay = day ?? days[0]?.day ?? null;
  const starts = days.find((d) => d.day === shownDay)?.starts ?? [];
  const when = (iso: string) => format.dateTime(new Date(iso), { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: DOUALA });
  const move = useMutation(
    trpc.consultationSpace.move.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.consultationSpace.pathKey() });
        toast.add({ title: t('moved'), type: 'success' });
        onOpenChange(false);
      },
      onError: (error) =>
        toast.add({ title: error instanceof TRPCClientError && error.message === 'SLOT_TAKEN' ? t('taken') : error instanceof TRPCClientError && error.message === 'MOVE_CLOSED' ? t('closed') : t('error'), type: 'error' }),
    }),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-dvh max-w-xl flex-col gap-5 overflow-y-auto rounded-3xl bg-white p-6">
        <div className="flex items-center gap-4">
          <Image src="/email/moved.png" alt="" width={72} height={72} className="size-18 shrink-0" />
          <div className="flex flex-col gap-1">
            <DialogTitle className="font-heading text-h4 font-extrabold text-navy-deep">{t('title')}</DialogTitle>
            <DialogDescription className="text-body-sm text-slate">
              {t('lead', { current: format.dateTime(new Date(startsAt), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: DOUALA }) })}
            </DialogDescription>
          </div>
        </div>
        {options.isPending ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : days.length === 0 ? (
          <p className="text-body-sm text-slate">{t('none')}</p>
        ) : (
          <>
            <div role="radiogroup" aria-label={t('days')} className="flex gap-2 overflow-x-auto pb-1">
              {days.slice(0, 14).map((d) => {
                const date = new Date(`${d.day}T12:00:00Z`);
                const on = d.day === shownDay;
                return (
                  <button
                    key={d.day}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={format.dateTime(date, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                    onClick={() => {
                      setDay(d.day);
                      setStart(null);
                    }}
                    className={cn('flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-2xl border py-2.5', on ? 'border-navy-deep bg-navy-deep text-white' : 'border-fog text-ink')}
                  >
                    <span className={cn('font-label text-label font-bold uppercase', on ? 'text-rose' : 'text-slate')}>{format.dateTime(date, { weekday: 'short', timeZone: 'UTC' }).replace('.', '')}</span>
                    <span className="font-heading text-h4 font-extrabold">{format.dateTime(date, { day: 'numeric', timeZone: 'UTC' })}</span>
                  </button>
                );
              })}
            </div>
            <div role="radiogroup" aria-label={t('times')} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {starts.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  role="radio"
                  aria-checked={start === iso}
                  onClick={() => setStart(iso)}
                  className={cn('h-12 rounded-xl border font-heading text-body font-bold', start === iso ? 'border-2 border-rouge bg-blush text-rouge' : 'border-fog text-ink')}
                >
                  {format.dateTime(new Date(iso), { hour: '2-digit', minute: '2-digit', timeZone: DOUALA })}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={!start || move.isPending}
            onClick={() => start && move.mutate({ id, start })}
            className={cn('h-13 flex-1 rounded-full bg-rouge px-6 font-heading text-body font-bold text-white hover:bg-crimson disabled:opacity-50', PRESS)}
          >
            {start ? t('confirm', { when: when(start) }) : t('pick')}
          </button>
          <button type="button" onClick={() => onOpenChange(false)} className="px-4 text-body-sm font-bold text-ink underline underline-offset-2">
            {t('keep')}
          </button>
        </div>
        <p className="text-caption text-slate">{t('cancelHint')}</p>
      </DialogContent>
    </Dialog>
  );
}

/** Stanzy's card: who reads the answers, and « Écrire sur WhatsApp ». */
export function StanzyCard(): ReactNode {
  const t = useTranslations('Consultation.space');
  return (
    <section aria-labelledby="stanzy-card" className="flex flex-col gap-4 rounded-3xl border border-fog-light bg-white p-6">
      <div className="flex items-center gap-3">
        <Image src="/stanzy/idle.svg" alt="" width={56} height={56} className="size-14 shrink-0 rounded-full bg-ice-blue" />
        <div className="flex flex-col">
          <h2 id="stanzy-card" className="font-heading text-body font-bold text-navy-deep">
            Stanzy
          </h2>
          <p className="text-caption text-slate">{t('stanzyRole')}</p>
        </div>
      </div>
      <p className="text-body-sm leading-5 text-ink">{t('stanzyLead')}</p>
      {WHATSAPP_URL ? (
        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className={cn('flex h-12 items-center justify-center gap-2 rounded-full border-2 border-navy-deep font-heading text-body-sm font-bold text-navy-deep', PRESS)}>
          <MessageCircle aria-hidden={true} className="size-4" strokeWidth={2.4} />
          {t('whatsapp')}
        </a>
      ) : null}
    </section>
  );
}

/** A ticked or open check, as in « Avant la Réunion ». */
export function CheckMark({ done }: { done: boolean }): ReactNode {
  return (
    <span aria-hidden={true} className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', done ? 'bg-leaf' : 'border-2 border-navy-deep bg-white')}>
      {done ? <Check className="size-4 text-white" strokeWidth={3} /> : null}
    </span>
  );
}
