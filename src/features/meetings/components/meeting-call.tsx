'use client';

import '@stream-io/video-react-sdk/dist/css/styles.css';

import {
  CallControls,
  SpeakerLayout,
  StreamCall,
  StreamTheme,
  StreamVideo,
  StreamVideoClient,
  useCallStateHooks,
  type Call,
} from '@stream-io/video-react-sdk';
import { Circle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';

export type RoomAccess = { apiKey: string; token: string; callId: string; user: { id: string; name: string } };

/**
 * The live Réunion on Stream Video: the speakers, the controls (camera, micro,
 * screen sharing, leave) and « Enregistrement en cours » while Stream records.
 * Loaded in the browser only; leaving calls `onLeave`.
 */
export function MeetingCall({
  access,
  onLeave,
  onFailed,
}: {
  access: RoomAccess;
  onLeave: () => void;
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
        <StreamTheme className="overflow-hidden rounded-2xl bg-navy-deep p-3">
          <RecordingBadge />
          <SpeakerLayout participantsBarPosition="bottom" />
          <CallControls onLeave={onLeave} />
        </StreamTheme>
      </StreamCall>
    </StreamVideo>
  );
}

/** « Enregistrement en cours », as Stream reports it. */
function RecordingBadge(): ReactNode {
  const t = useTranslations('Meetings.room');
  const { useIsCallRecordingInProgress } = useCallStateHooks();
  const recording = useIsCallRecordingInProgress();
  if (!recording) return null;
  return (
    <p role="status" className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-rouge px-3 py-1 text-xs font-semibold text-white">
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
