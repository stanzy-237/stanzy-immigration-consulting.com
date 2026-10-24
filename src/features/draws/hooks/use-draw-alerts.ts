'use client';

import { useLocale } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { toLocale } from '@/i18n/routing';
import { api } from '@/trpc/react';

/**
 * Where this device stands with Alertes tirages:
 * - `hidden`: the site has no push keys, so alerts are off for everyone;
 * - `checking`: still asking the browser;
 * - `unsupported`: the browser can't do Web Push;
 * - `needs-install`: iPhone/iPad Safari, which pushes only to an installed app;
 * - `denied`: the visitor blocked notifications for the site;
 * - `off` / `on`: ready to subscribe / subscribed.
 */
export type DrawAlertsStatus = 'hidden' | 'checking' | 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

/** The VAPID public key, base64url, as the bytes `pushManager.subscribe` wants. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const canPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** This page's service worker registration, registering `/sw.js` when asked to. */
async function registration(register: boolean): Promise<ServiceWorkerRegistration | undefined> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing || !register) return existing;
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

export function useDrawAlerts() {
  const locale = toLocale(useLocale());
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [status, setStatus] = useState<DrawAlertsStatus>(publicKey ? 'checking' : 'hidden');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const subscribe = api.draws.subscribe.useMutation();
  const unsubscribe = api.draws.unsubscribe.useMutation();

  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    const settle = (next: DrawAlertsStatus) => !cancelled && setStatus(next);
    if (!canPush()) {
      settle(isIos() && !isStandalone() ? 'needs-install' : 'unsupported');
    } else if (Notification.permission === 'denied') {
      settle('denied');
    } else {
      registration(false)
        .then((reg) => reg?.pushManager.getSubscription())
        .then((existing) => settle(existing ? 'on' : 'off'))
        .catch(() => settle('off'));
    }
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setBusy(true);
    setFailed(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await registration(true);
      if (!reg) throw new Error('No service worker');
      const created = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const json = created.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await subscribe.mutateAsync({ subscription: json, locale });
      setStatus('on');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [publicKey, locale, subscribe]);

  const disable = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      const existing = await (await registration(false))?.pushManager.getSubscription();
      if (existing) {
        await unsubscribe.mutateAsync({ endpoint: existing.endpoint });
        await existing.unsubscribe();
      }
      setStatus('off');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [unsubscribe]);

  return { status, busy, failed, enable, disable };
}
