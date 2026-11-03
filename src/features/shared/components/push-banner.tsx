'use client';

import { BellRing } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { useNotificationPush } from '@/features/notifications/hooks/use-notification-push';

const DISMISSED_KEY = 'stanzy.pushBanner.dismissed';

function dismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The one invitation to turn on phone notifications (#92), shown in « Mon
 * espace » to a Client with a Dossier while the device can and hasn't. « Plus
 * tard » hides it for good on this device.
 */
export function PushBanner(): ReactNode {
  const t = useTranslations('Notifications.pushBanner');
  const { status, busy, enable } = useNotificationPush();
  const [hidden, setHidden] = useState(dismissed);
  if (hidden || status !== 'off') return null;

  const later = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Storage unavailable (private mode): hidden for this visit only.
    }
    setHidden(true);
  };

  return (
    <aside
      aria-label={t('title')}
      className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-fog-light bg-ice-blue px-4 py-3"
    >
      <BellRing aria-hidden={true} className="size-5 shrink-0 text-navy-deep" />
      <p className="min-w-0 flex-1 text-sm font-semibold text-navy-deep">{t('title')}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={later}
          className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-slate hover:text-navy-deep"
        >
          {t('later')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void enable()}
          className="inline-flex h-9 items-center rounded-full bg-navy-deep px-4 text-sm font-semibold text-white hover:bg-navy-80 disabled:opacity-50"
        >
          {t('enable')}
        </button>
      </div>
    </aside>
  );
}
