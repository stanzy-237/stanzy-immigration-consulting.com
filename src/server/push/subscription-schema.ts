import { z } from 'zod';

/**
 * Browsers' push services. The server POSTs pushes to the endpoint, so only
 * these hosts are accepted: an arbitrary URL would make it call anywhere.
 */
const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;

export const pushEndpoint = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && PUSH_HOSTS.test(url.hostname);
  }, 'Not a push service endpoint');

/** A device's push subscription, as `PushSubscription.toJSON()` gives it. */
export const pushSubscriptionInput = z.object({
  endpoint: pushEndpoint,
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
});
