'use client';

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { ReactNode } from 'react';

/** The consultant's own visits to the Tableau de bord (admin.<site>) aren't counted. */
const fromDashboard = (url: string): boolean => {
  try {
    const { hostname, pathname } = new URL(url);
    return hostname.startsWith('admin.') || /^\/[a-z]{2}\/tableau-de-bord(\/|$)/.test(pathname);
  } catch {
    return false;
  }
};

/**
 * Vercel Web Analytics and Speed Insights for the site: page views, the
 * events `track()` sends, and real loading times. No cookies, no personal
 * data; the Tableau de bord stays out.
 */
export function SiteAnalytics(): ReactNode {
  const keep = <T extends { url: string }>(event: T): T | null => (fromDashboard(event.url) ? null : event);
  return (
    <>
      <Analytics beforeSend={(event: BeforeSendEvent) => keep(event)} />
      <SpeedInsights beforeSend={keep} />
    </>
  );
}
