'use client';

import { useLocale } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

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

/** iPadOS Safari reports a Mac browser; a Mac with a touch screen is an iPad. */
const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const canPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

type SubscriptionJson = { endpoint: string; keys: { p256dh: string; auth: string } };

/**
 * Set when the visitor turns alerts off, so a device that allows notifications
 * isn't subscribed again on its next visit. Cleared when they turn alerts on.
 */
const OPTED_OUT_KEY = 'stanzy.drawAlerts.off';

function optedOut(): boolean {
  try {
    return window.localStorage.getItem(OPTED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

function setOptedOut(off: boolean): void {
  try {
    if (off) window.localStorage.setItem(OPTED_OUT_KEY, '1');
    else window.localStorage.removeItem(OPTED_OUT_KEY);
  } catch {
    // Storage unavailable (private mode): the choice lasts for this visit only.
  }
}

/** This page's service worker registration, registering `/sw.js` when asked to. */
async function registration(register: boolean): Promise<ServiceWorkerRegistration | undefined> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing || !register) return existing;
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

/** A new push subscription for this device. Needs notification permission. */
async function subscribeDevice(publicKey: string): Promise<PushSubscription> {
  const reg = await registration(true);
  if (!reg) throw new Error('No service worker');
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
}

export function useDrawAlerts() {
  const locale = toLocale(useLocale());
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [status, setStatus] = useState<DrawAlertsStatus>(publicKey ? 'checking' : 'hidden');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const subscribe = api.draws.subscribe.useMutation();
  const unsubscribe = api.draws.unsubscribe.useMutation();

  const sync = useCallback(
    (subscription: PushSubscription) =>
      subscribe.mutateAsync({ subscription: subscription.toJSON() as SubscriptionJson, locale }),
    [subscribe, locale],
  );
  // The detection effect runs once; it reads the latest `sync` through a ref.
  const syncRef = useRef(sync);
  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

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
        .then(async (existing) => {
          if (existing) {
            // Re-register with the server: it may have dropped this device (an
            // expired subscription, or a subscribe call that never arrived).
            await syncRef.current(existing);
            settle('on');
          } else if (Notification.permission === 'granted' && !optedOut()) {
            // The device already allows Stanzy's notifications: turn alerts
            // on without asking, unless the visitor turned them off before.
            await syncRef.current(await subscribeDevice(publicKey));
            settle('on');
          } else {
            settle('off');
          }
        })
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
      await sync(await subscribeDevice(publicKey));
      setOptedOut(false);
      setStatus('on');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [publicKey, sync]);

  const disable = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      const existing = await (await registration(false))?.pushManager.getSubscription();
      if (existing) {
        await unsubscribe.mutateAsync({ endpoint: existing.endpoint });
        await existing.unsubscribe();
      }
      setOptedOut(true);
      setStatus('off');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [unsubscribe]);

  return { status, busy, failed, enable, disable };
}
