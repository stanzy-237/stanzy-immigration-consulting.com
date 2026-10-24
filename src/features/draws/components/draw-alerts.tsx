'use client';

import { Bell, BellOff, BellRing } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { useDrawAlerts } from '@/features/draws/hooks/use-draw-alerts';
import { WHATSAPP_CHANNEL_URL } from '@/features/shared/data/links';

const button =
  'inline-flex h-11 items-center gap-2 rounded-lg px-5 font-heading text-sm font-semibold transition-colors disabled:opacity-60';

/** "Activer les alertes tirages": opt this device in to a push notification for every new Tirage. */
export function DrawAlerts(): ReactNode {
  const t = useTranslations('Draws.alerts');
  const { status, busy, failed, enable, disable } = useDrawAlerts();
  if (status === 'hidden') return null;

  return (
    <section
      aria-label={t('title')}
      className="mx-auto mt-10 flex max-w-7xl flex-col gap-4 px-4 sm:px-7 md:flex-row md:items-center"
    >
      <div className="flex flex-1 items-start gap-4 rounded-xl border border-fog-light bg-white p-5 shadow-sm md:items-center">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blush text-rouge">
          {status === 'on' ? <BellRing aria-hidden={true} className="size-5" /> : <Bell aria-hidden={true} className="size-5" />}
        </span>
        <div className="flex-1 text-sm text-slate">
          <p className="font-heading text-base font-bold text-navy-deep">{t('title')}</p>
          {status === 'on' && <p>{t('enabled')}</p>}
          {(status === 'off' || status === 'checking') && <p>{t('pitch')}</p>}
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
