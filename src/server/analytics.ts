import { track } from '@vercel/analytics/server';
import { after } from 'next/server';

import { cleanProps, type TrackEventProps } from '@/lib/analytics';

/**
 * A custom event from the server (#12), for what happens there and must be
 * counted even with an ad blocker: a Demande approved, a Contrat signed, a
 * Facture paid. Sent after the response, on Vercel only; a failure is logged.
 */
export function trackLater(headers: Headers, event: string, props?: TrackEventProps): void {
  if (process.env.VERCEL !== '1') return;
  after(async () => {
    try {
      await track(event, cleanProps(props), { headers });
    } catch (error) {
      console.error(`[analytics] could not send ${event}`, error);
    }
  });
}
