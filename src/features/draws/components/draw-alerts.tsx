'use client';

import { Bell, BellOff, BellRing } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { useDrawAlerts } from '@/features/draws/hooks/use-draw-alerts';
import { WHATSAPP_CHANNEL_URL } from '@/features/shared/data/links';

// Full width under the text on phones, beside it from `sm` up.
const button =
  'inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg px-5 font-heading text-sm font-semibold transition-colors disabled:opacity-60 sm:h-11 sm:w-auto';

/** "Activer les alertes tirages": opt this device in to a push notification for every new Tirage. */
export function DrawAlerts(): ReactNode {
  const t = useTranslations('Draws.alerts');
  const { status, busy, failed, enable, disable } = useDrawAlerts();
  if (status === 'hidden') return null;

  return (
    <section
      aria-label={t('title')}
      className="mx-auto mt-6 max-w-7xl px-4 sm:mt-10 sm:px-7"
    >
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-fog-light bg-white p-4 shadow-sm sm:flex-nowrap sm:gap-4 sm:p-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blush text-rouge sm:size-11">
          {status === 'on' ? (
            <BellRing aria-hidden={true} className="size-4 sm:size-5" />
          ) : (
            <Bell aria-hidden={true} className="size-4 sm:size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1 text-xs text-slate sm:text-sm">
          <p className="font-heading text-sm font-bold text-navy-deep sm:text-base">{t('title')}</p>
          {status === 'on' && <p>{t('enabled')}</p>}
          {/* The pitch is extra on a phone: the button says it all. */}
          {(status === 'off' || status === 'checking') && <p className="hidden sm:block">{t('pitch')}</p>}
          {status === 'denied' && <p>{t('denied')}</p>}
          {status === 'needs-install' && <p>{t('install')}</p>}
          {status === 'unsupported' && <p>{t('unsupported')}</p>}
          {failed && (
            <p role="alert" className="mt-1 text-rouge">
              {t('failed')}
            </p>
          )}
        </div>
        {status === 'off' && (
          <button type="button" disabled={busy} onClick={enable} className={`${button} bg-rouge text-white hover:bg-crimson`}>
            <Bell aria-hidden={true} className="size-4" />
            {t('enable')}
          </button>
        )}
        {status === 'on' && (
          <button
            type="button"
            disabled={busy}
            onClick={disable}
            className={`${button} border border-fog-light bg-white text-navy-deep hover:border-navy-deep`}
          >
            <BellOff aria-hidden={true} className="size-4" />
            {t('disable')}
          </button>
        )}
        {status === 'unsupported' && (
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${button} bg-whatsapp text-ink-deep hover:opacity-90`}
          >
            {t('whatsapp')}
          </a>
        )}
      </div>
    </section>
  );
}
