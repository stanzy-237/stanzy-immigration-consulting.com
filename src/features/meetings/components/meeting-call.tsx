'use client';

import '@stream-io/video-react-sdk/dist/css/styles.css';

import {
  BackgroundFiltersProvider,
  CallParticipantsList,
  CallingState,
  combineComparators,
  DeviceSettings,
  dominantSpeaker,
  name,
  PaginatedGridLayout,
  pinned,
  publishingAudio,
  publishingVideo,
  ReactionsButton,
  RecordCallButton,
  ScreenShareButton,
  screenSharing,
  SpeakerLayout,
  speaking,
  StreamCall,
  StreamTheme,
  StreamVideo,
  StreamVideoClient,
  ToggleAudioPublishingButton,
  ToggleVideoPublishingButton,
  useBackgroundFilters,
  useCall,
  useCallStateHooks,
  type Call,
} from '@stream-io/video-react-sdk';
import { Circle, Droplet, LayoutGrid, ListOrdered, Maximize, Minimize, PhoneOff, Sparkles, Users, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type RoomAccess = { apiKey: string; token: string; callId: string; user: { id: string; name: string } };

const LAYOUTS = ['grid', 'speakerLeft', 'speakerRight', 'speakerTop'] as const;
type Layout = (typeof LAYOUTS)[number];

/** How the tiles are ordered: who speaks first, shared screens first, or by name; pinned people always lead. */
const SORTS = {
  default: combineComparators(pinned, screenSharing, dominantSpeaker, speaking, publishingVideo, publishingAudio),
  screen: combineComparators(screenSharing, pinned, dominantSpeaker, speaking, publishingVideo),
  name: combineComparators(pinned, name),
} as const;
type Sort = keyof typeof SORTS;

const control =
  'inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 aria-pressed:bg-white aria-pressed:text-navy-deep';

/**
 * The live Réunion on Stream Video, in the browser only: the tiles in the
 * chosen layout and order (each tile's menu pins, and lets a host mute or
 * remove someone), the participants panel, the controls (micro, camera,
 * screen, reactions, blur, devices, recording for the host, fullscreen),
 * « Enregistrement en cours » and the time. The host leaving chooses
 * « Terminer pour tous » or « Quitter seulement ».
 */
export function MeetingCall({
  access,
  subject,
  host,
  aside,
  onLeave,
  onEndForAll,
  onEnded,
  onFailed,
}: {
  access: RoomAccess;
  subject: string;
  /** The consultant: records, ends for everyone, sees `aside` (those waiting to be let in). */
  host: boolean;
  aside?: ReactNode;
  onLeave: () => void;
  onEndForAll: () => Promise<void>;
  onEnded: () => void;
  onFailed: () => void;
}): ReactNode {
  const [session, setSession] = useState<{ client: StreamVideoClient; call: Call } | null>(null);

  useEffect(() => {
    const client = new StreamVideoClient({ apiKey: access.apiKey, user: access.user, token: access.token });
    const call = client.call('default', access.callId);
    let left = false;
    call
      .join()
      .then(() => {
        if (!left) setSession({ client, call });
      })
      .catch((error: unknown) => {
        console.error('[meetings] could not join the call', error);
        if (!left) onFailed();
      });
    return () => {
      left = true;
      void call.leave().catch(() => {});
      void client.disconnectUser();
      setSession(null);
    };
  }, [access, onFailed]);

  if (!session) return <Connecting />;
  return (
    <StreamVideo client={session.client}>
      <StreamCall call={session.call}>
        <BackgroundFiltersProvider>
          <Room subject={subject} host={host} aside={aside} onLeave={onLeave} onEndForAll={onEndForAll} onEnded={onEnded} />
        </BackgroundFiltersProvider>
      </StreamCall>
    </StreamVideo>
  );
}

function Room({
  subject,
  host,
  aside,
  onLeave,
  onEndForAll,
  onEnded,
}: {
  subject: string;
  host: boolean;
  aside?: ReactNode;
  onLeave: () => void;
  onEndForAll: () => Promise<void>;
  onEnded: () => void;
}): ReactNode {
  const t = useTranslations('Meetings.hub.room');
  const call = useCall();
  const { useCallCallingState, useParticipantCount } = useCallStateHooks();
  const calling = useCallCallingState();
  const count = useParticipantCount();
  const frame = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>('speakerLeft');
  const [sort, setSort] = useState<Sort>('default');
  const [people, setPeople] = useState(false);
  const [settings, setSettings] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Ended by the host (here or from another device): everyone is out.
  useEffect(() => {
    if (!call) return;
    const off = call.on('call.ended', () => onEnded());
    return () => off();
  }, [call, onEnded]);
  useEffect(() => {
    if (calling === CallingState.LEFT) onLeave();
  }, [calling, onLeave]);
  useEffect(() => {
    call?.setSortParticipantsBy(SORTS[sort]);
  }, [call, sort]);
  useEffect(() => {
    const change = () => setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frame.current?.requestFullscreen();
  };
  const leave = () => {
    if (host) setLeaving(true);
    else void call?.leave().then(onLeave);
  };

  return (
    <StreamTheme className="str-video">
      <div
        ref={frame}
        className="flex min-h-120 flex-col overflow-hidden rounded-2xl bg-navy-deep text-white md:min-h-160"
      >
        <header className="flex items-center justify-between gap-2 px-3 py-3 md:px-4">
          <p className="min-w-0 flex-1 truncate font-heading text-sm font-bold md:text-base">{subject}</p>
          <div className="flex shrink-0 items-center gap-1.5 text-xs">
            <RecordingBadge />
            <Timer label={t('timer')} />
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
              <Users aria-hidden={true} className="size-3.5" />
              {count}
            </span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-2 md:flex-row md:px-3">
          <div className="min-h-72 min-w-0 flex-1">
            {layout === 'grid' ? (
              <PaginatedGridLayout />
            ) : (
              <SpeakerLayout
                participantsBarPosition={layout === 'speakerLeft' ? 'right' : layout === 'speakerRight' ? 'left' : 'bottom'}
              />
            )}
          </div>
          {people || aside ? (
            <aside className="flex max-h-72 w-full shrink-0 flex-col gap-3 overflow-y-auto rounded-xl bg-white/5 p-2 md:max-h-none md:w-72">
              {aside}
              {people ? <CallParticipantsList onClose={() => setPeople(false)} /> : null}
            </aside>
          ) : null}
        </div>

        {settings ? (
          <div className="mx-2 mt-3 overflow-x-auto rounded-xl bg-white/5 p-3 md:mx-3">
            <DeviceSettings />
          </div>
        ) : null}

        <footer className="flex flex-wrap items-center justify-center gap-1.5 px-2 py-3 md:gap-2 md:px-3">
          <ToggleAudioPublishingButton />
          <ToggleVideoPublishingButton />
          <ScreenShareButton />
          <ReactionsButton />
          {host ? <RecordCallButton /> : null}
          <BlurButton />
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={t('layout')} title={t('layout')} className={control}>
              <LayoutGrid aria-hidden={true} className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" container={frame} className="w-60">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t('layout')}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={layout} onValueChange={(value) => setLayout(value as Layout)}>
                  {LAYOUTS.map((key) => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      {t(`layouts.${key}`)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={t('sort')} title={t('sort')} className={control}>
              <ListOrdered aria-hidden={true} className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" container={frame} className="w-60">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t('sort')}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sort} onValueChange={(value) => setSort(value as Sort)}>
                  {(Object.keys(SORTS) as Sort[]).map((key) => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      {t(`sorts.${key}`)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            aria-pressed={people}
            onClick={() => setPeople(!people)}
            aria-label={t('participants')}
            title={t('participants')}
            className={control}
          >
            <Users aria-hidden={true} className="size-5" />
          </button>
          <button
            type="button"
            aria-pressed={settings}
            onClick={() => setSettings(!settings)}
            aria-label={t('settings')}
            title={t('settings')}
            className={control}
          >
            <Sparkles aria-hidden={true} className="size-5" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? t('exitFullscreen') : t('fullscreen')}
            title={fullscreen ? t('exitFullscreen') : t('fullscreen')}
            className={control}
          >
            {fullscreen ? <Minimize aria-hidden={true} className="size-5" /> : <Maximize aria-hidden={true} className="size-5" />}
          </button>
          <button
            type="button"
            onClick={leave}
            aria-label={t('leave')}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-rouge px-4 text-sm font-semibold text-white hover:bg-crimson md:px-5"
          >
            <PhoneOff aria-hidden={true} className="size-5" />
            <span className="hidden sm:inline">{t('leave')}</span>
          </button>
        </footer>
      </div>

      <AlertDialog open={leaving} onOpenChange={setLeaving}>
        <AlertDialogContent container={frame} className="gap-5 p-6">
          <AlertDialogCancel
            variant="ghost"
            size="icon"
            aria-label={t('close')}
            title={t('close')}
            className="absolute top-3 right-3 rounded-full text-slate hover:text-navy-deep"
          >
            <X aria-hidden={true} className="size-5" />
          </AlertDialogCancel>
          <AlertDialogHeader className="place-items-start pr-8 text-left">
            <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('endTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate">{t('endBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setLeaving(false);
                void call?.leave().then(onLeave);
              }}
              className="rounded-full border-2 border-navy-deep px-3 py-2 text-sm leading-tight font-semibold text-navy-deep hover:bg-off-white"
            >
              {t('leaveOnly')}
            </button>
            <button
              type="button"
              onClick={() => {
                setLeaving(false);
                void onEndForAll();
              }}
              className="rounded-full bg-rouge px-3 py-2 text-sm leading-tight font-semibold text-white hover:bg-crimson"
            >
              {t('endAll')}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </StreamTheme>
  );
}

/** Background blur, where the browser can run it. */
function BlurButton(): ReactNode {
  const t = useTranslations('Meetings.hub.room');
  const { isSupported, backgroundFilter, applyBackgroundBlurFilter, disableBackgroundFilter } = useBackgroundFilters();
  if (!isSupported) return null;
  const on = backgroundFilter === 'blur';
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => (on ? disableBackgroundFilter() : applyBackgroundBlurFilter('high'))}
      aria-label={on ? t('unblur') : t('blur')}
      title={on ? t('unblur') : t('blur')}
      className={control}
    >
      <Droplet aria-hidden={true} className="size-5" />
    </button>
  );
}

/** How long the call has been going, from its start. */
function Timer({ label }: { label: string }): ReactNode {
  const { useCallStartedAt } = useCallStateHooks();
  const startedAt = useCallStartedAt();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  if (!startedAt) return null;
  const seconds = Math.max(0, Math.floor((now - startedAt.getTime()) / 1000));
  const text = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, '0')))
    .join(':');
  return (
    <span aria-label={label} className="rounded-full bg-white/10 px-2.5 py-1 tabular-nums">
      {text}
    </span>
  );
}

/** « Enregistrement en cours », as Stream reports it. */
function RecordingBadge(): ReactNode {
  const t = useTranslations('Meetings.room');
  const { useIsCallRecordingInProgress } = useCallStateHooks();
  const recording = useIsCallRecordingInProgress();
  if (!recording) return null;
  return (
    <p role="status" className="inline-flex items-center gap-1.5 rounded-full bg-rouge px-3 py-1 text-xs font-semibold text-white">
      <Circle aria-hidden={true} className="size-2.5 animate-pulse fill-white" />
      {t('recordingNow')}
    </p>
  );
}

function Connecting(): ReactNode {
  const t = useTranslations('Meetings.room');
  return (
    <p role="status" className="rounded-2xl bg-navy-deep px-6 py-16 text-center text-sm font-semibold text-white">
      {t('joining')}
    </p>
  );
}
