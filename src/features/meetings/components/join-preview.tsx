'use client';

import { Mic, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';

import { useDevicePreview } from '@/features/meetings/hooks/use-device-preview';
import { cn } from '@/lib/utils';

const WHATSAPP_URL = 'https://wa.me/237679306015';
const BARS = [0.15, 0.35, 0.55, 0.75, 0.9];

/**
 * The Client's waiting room (`Mon espace v2 · 2 Salle d'attente`, Desktop
 * and Mobile): their camera and « On vous entend » beside « Tout est prêt »,
 * the recording consent and « Rejoindre la Réunion ». On a phone the picture
 * fills the screen and the rest rises in a sheet. The preview lets go of the
 * devices before the call takes them.
 */
export function JoinPreview({
  name,
  when,
  recording,
  needsConsent,
  accepted,
  onAccept,
  consentNote,
  notice,
  pending,
  label,
  onJoin,
}: {
  name: string;
  when: string;
  recording: boolean;
  needsConsent: boolean;
  accepted: boolean;
  onAccept: (accepted: boolean) => void;
  /** « Accepté le … » once given. */
  consentNote: string | null;
  /** « Vous avez quitté la réunion », a failure… */
  notice: ReactNode;
  pending: boolean;
  label: string;
  onJoin: () => void;
}): ReactNode {
  const t = useTranslations('Meetings.room.preview');
  const id = useId();
  const { video, level, status, devices, stop } = useDevicePreview(true);
  const ready = status === 'ready';
  return (
    <div className="flex flex-col gap-6 max-sm:-mx-4 lg:flex-row lg:items-center lg:gap-10">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-1">
        <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-navy-80 max-sm:aspect-auto max-sm:h-112 max-sm:rounded-none">
          <video ref={video} autoPlay={true} muted={true} playsInline={true} className="size-full -scale-x-100 object-cover" />
          {!ready ? (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-body-sm text-white/80">{status === 'blocked' ? t('blocked') : t('starting')}</p>
          ) : null}
          <span className="absolute top-4 left-4 rounded-full bg-navy-deep/80 px-3 py-1 text-caption font-semibold text-white">{t('you', { name })}</span>
          <span className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-navy-deep/80 px-3 py-1.5 text-caption font-semibold text-white">
            <Mic aria-hidden={true} className="size-3.5" strokeWidth={2.4} />
            <span aria-hidden={true} className="flex h-3.5 items-end gap-0.5">
              {BARS.map((at, i) => (
                <span key={i} className={cn('w-1 rounded-full transition-colors duration-100', level >= at ? 'bg-whatsapp' : 'bg-white/30')} style={{ height: `${40 + i * 15}%` }} />
              ))}
            </span>
            {level > BARS[0]! ? t('heard') : t('speak')}
          </span>
        </div>
        {devices ? (
          <p className="flex items-center justify-center gap-2 text-caption text-slate max-sm:hidden">
            <Video aria-hidden={true} className="size-3.5" />
            {devices}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 max-sm:relative max-sm:-mt-10 max-sm:rounded-t-3xl max-sm:bg-white max-sm:px-5 max-sm:pt-6 max-sm:pb-10 lg:w-md lg:shrink-0">
        <span aria-hidden={true} className="mx-auto -mt-2 h-1 w-10 rounded-full bg-fog sm:hidden" />
        <p className={cn('flex items-center gap-2 font-label text-caption font-bold tracking-wide uppercase', ready ? 'text-leaf' : 'text-honey')}>
          <span aria-hidden={true} className={cn('size-2 rounded-full', ready ? 'bg-leaf' : 'bg-honey')} />
          {ready ? t('ready') : t('notReady')}
        </p>
        <h2 className="font-heading text-h3 leading-9 font-extrabold tracking-tight text-navy-deep lg:text-h2 lg:leading-11">{t('title')}</h2>
        <p className="text-body text-slate max-sm:hidden">{when}</p>
        {notice}
        {recording ? (
          needsConsent ? (
            <label htmlFor={`${id}-accept`} className="flex items-start gap-3 rounded-2xl border border-fog-light bg-white p-4 text-body-sm text-ink max-sm:border-0 max-sm:p-0">
              <input id={`${id}-accept`} type="checkbox" checked={accepted} onChange={(e) => onAccept(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-navy-deep" />
              <span>{t('consent')}</span>
            </label>
          ) : (
            <p className="text-caption text-slate">{consentNote}</p>
          )
        ) : null}
        <button
          type="button"
          disabled={pending || (needsConsent && !accepted)}
          onClick={() => {
            stop();
            onJoin();
          }}
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-rouge px-6 font-heading text-body font-bold text-white transition-colors duration-300 hover:bg-crimson disabled:bg-fog disabled:text-slate"
        >
          <Video aria-hidden={true} className="size-5" strokeWidth={2.2} />
          {label}
        </button>
        <p className="text-center text-caption text-slate">
          {t.rich('trouble', { link: (chunks) => <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="font-bold text-ink underline underline-offset-2">{chunks}</a> })}
        </p>
      </div>
    </div>
  );
}
