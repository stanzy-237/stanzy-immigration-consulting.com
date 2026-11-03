import webpush, { WebPushError } from 'web-push';

import { env } from '@/lib/env';

/** What the service worker shows (public/sw.js): `tag` makes a repeat replace the first. Extra fields ride along. */
export type PushPayload = { title: string; body: string; url: string; tag: string };

export type StoredSubscription = { endpoint: string; p256dh: string; auth: string };

/** Delivers one push. 'gone' means the push service says the subscription expired. */
export type PushSender = <P extends PushPayload>(
  subscription: StoredSubscription,
  payload: P,
) => Promise<'sent' | 'gone'>;

/**
 * Delivers through the browsers' push services, signed with the app's VAPID
 * keys. 404/410 mean the subscription expired or was revoked.
 */
export function webPushSender(vapid: { subject: string; publicKey: string; privateKey: string }): PushSender {
  return async (subscription, payload) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload),
        { vapidDetails: vapid, TTL: 60 * 60 * 24, urgency: 'high' },
      );
      return 'sent';
    } catch (error) {
      if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) return 'gone';
      throw error;
    }
  };
}

/** The app's sender, or null when the deploy has no VAPID keys (push is then off for everyone). */
export function appPushSender(): PushSender | null {
  const { VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_SUBJECT } = env;
  if (!VAPID_PRIVATE_KEY || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_SUBJECT) return null;
  return webPushSender({
    subject: VAPID_SUBJECT,
    publicKey: NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: VAPID_PRIVATE_KEY,
  });
}
