'use client';

import { Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';

import { Switch } from '@/components/ui/switch';
import { useNotificationPush } from '@/features/notifications/hooks/use-notification-push';

/**
 * « Recevoir sur ce téléphone » (#92): per device, opt-in, general text only.
 * Where the device can't (no Web Push, iPhone outside the home screen,
 * notifications blocked), it says what to do instead.
 */
export function PushSwitch(): ReactNode {
  const t = useTranslations('Notifications.pushSwitch');
  const id = useId();
  const { status, busy, enable, disable } = useNotificationPush();
  if (status === 'hidden') return null;

  const blocked = status === 'unsupported' || status === 'needs-install' || status === 'denied';
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-fog-light bg-white p-4 shadow-sm">
      <Smartphone aria-hidden={true} className="mt-0.5 size-5 shrink-0 text-navy-deep" />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block font-semibold text-navy-deep">
          {t('label')}
        </label>
        <p id={`${id}-hint`} className="mt-0.5 text-sm text-slate">
          {blocked ? t(`why.${status}`) : t('hint')}
        </p>
      </div>
      {blocked ? null : (
        <Switch
          id={id}
          aria-describedby={`${id}-hint`}
          checked={status === 'on'}
          disabled={busy || status === 'checking'}
          onCheckedChange={(on) => void (on ? enable() : disable())}
        />
      )}
    </div>
  );
}
