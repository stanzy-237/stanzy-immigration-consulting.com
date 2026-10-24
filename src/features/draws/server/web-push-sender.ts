import webpush, { WebPushError } from 'web-push';

import type { PushSender } from '@/features/draws/server/ingest-draws';

/**
 * Delivers Alertes tirages through the browsers' push services, signed with
 * the app's VAPID keys. 404/410 mean the subscription expired or was revoked.
 */
export function webPushSender(vapid: { subject: string; publicKey: string; privateKey: string }): PushSender {
  return async (subscription, alert) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(alert),
        { vapidDetails: vapid, TTL: 60 * 60 * 24, urgency: 'high' },
      );
      return 'sent';
    } catch (error) {
      if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) return 'gone';
      throw error;
    }
  };
}
