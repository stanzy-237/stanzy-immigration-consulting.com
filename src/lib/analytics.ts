// Analytics seam. v1 is a no-op; a real backend lands in a follow-up (issue #12
// Implementation Decisions → Analytics seam). Keep the surface small so the
// swap stays mechanical.

export type TrackEventProps = Record<string, string | number | boolean | undefined>;

export function track(event: string, props?: TrackEventProps): void {
  if (process.env.NODE_ENV !== 'production') {
    // Help humans see events fire during local dev. No-op otherwise.
    console.debug('[analytics]', event, props ?? {});
  }
}
