import { track as vercelTrack } from '@vercel/analytics';

// Analytics seam (issue #12): Vercel Web Analytics custom events. Keep the
// surface small so a swap stays mechanical. Never send names, emails or
// free text: labels and ranges only.

export type TrackEventProps = Record<string, string | number | boolean | undefined>;

/** Drops the props left undefined: Vercel takes strings, numbers, booleans and null only. */
export function cleanProps(props?: TrackEventProps): Record<string, string | number | boolean> | undefined {
  if (!props) return undefined;
  const kept = Object.entries(props).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined);
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

/** A custom event from the browser; in development, logged to the console instead. */
export function track(event: string, props?: TrackEventProps): void {
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[analytics]', event, props ?? {});
    return;
  }
  vercelTrack(event, cleanProps(props));
}

/** A CRS score as a range (« 450-499 »), so the exact score never leaves the server. */
export function crsRange(score: number | null | undefined): string | undefined {
  if (score === null || score === undefined) return undefined;
  const floor = Math.floor(score / 50) * 50;
  return `${floor}-${floor + 49}`;
}
