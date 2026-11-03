'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { toast } from '@/components/ui/toast';
import { toLocale } from '@/i18n/routing';
import { canPush, isIos, isStandalone, registration, subscribeDevice } from '@/lib/web-push-client';
import { useTRPC } from '@/trpc/client';

/**
 * Where this device stands with « Recevoir sur ce téléphone » (#92):
 * - `hidden`: the site has no push keys, so push is off for everyone;
 * - `checking`: still asking the browser and the server;
 * - `unsupported`: the browser can't do Web Push;
 * - `needs-install`: iPhone/iPad Safari, which pushes only to a site added to the home screen;
 * - `denied`: notifications are blocked for the site in the browser's settings;
 * - `off` / `on`.
 */
export type NotificationPushStatus = 'hidden' | 'checking' | 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

type SubscriptionJson = { endpoint: string; keys: { p256dh: string; auth: string } };

/**
 * The phone switch for the signed-in Account's Notifications. It never asks
 * the browser's permission on its own: only `enable`, from a tap, does. The
 * device's Alertes tirages are left as they are.
 */
export function useNotificationPush() {
  const t = useTranslations('Notifications.pushSwitch');
  const locale = toLocale(useLocale());
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<NotificationPushStatus>(publicKey ? 'checking' : 'hidden');
  const [busy, setBusy] = useState(false);
  const { mutateAsync: subscribe } = useMutation(trpc.notifications.push.subscribe.mutationOptions());
  const { mutateAsync: unsubscribe } = useMutation(trpc.notifications.push.unsubscribe.mutationOptions());

  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    const settle = (next: NotificationPushStatus) => !cancelled && setStatus(next);
    if (!canPush()) {
      settle(isIos() && !isStandalone() ? 'needs-install' : 'unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      settle('denied');
      return;
    }
    registration(false)
      .then((reg) => reg?.pushManager.getSubscription())
      .then(async (existing) => {
        if (!existing) return settle('off');
        const { on } = await queryClient.fetchQuery(
          trpc.notifications.push.status.queryOptions({ endpoint: existing.endpoint }),
        );
        settle(on ? 'on' : 'off');
      })
      .catch(() => settle('off'));
    return () => {
      cancelled = true;
    };
  }, [publicKey, queryClient, trpc]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const device = await subscribeDevice(publicKey);
      await subscribe({ subscription: device.toJSON() as SubscriptionJson, locale });
      setStatus('on');
      toast.add({ title: t('toastOn'), type: 'success' });
    } catch {
      toast.add({ title: t('failed'), type: 'error' });
    } finally {
      setBusy(false);
    }
  }, [publicKey, subscribe, locale, t]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const existing = await (await registration(false))?.pushManager.getSubscription();
      if (existing) {
        const { forgotten } = await unsubscribe({ endpoint: existing.endpoint });
        // Kept while it still receives the Alertes tirages.
        if (forgotten) await existing.unsubscribe();
      }
      setStatus('off');
      toast.add({ title: t('toastOff'), type: 'info' });
    } catch {
      toast.add({ title: t('failed'), type: 'error' });
    } finally {
      setBusy(false);
    }
  }, [unsubscribe, t]);

  return { status, busy, enable, disable };
}
