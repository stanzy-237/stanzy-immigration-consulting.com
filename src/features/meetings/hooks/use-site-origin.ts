'use client';

import { useSyncExternalStore } from 'react';

import { siteOriginOf } from '@/features/dashboard/lib/dashboard-host';

const subscribe = () => () => {};

/** The public site's origin, from admin.<site> in the browser; empty while rendered on the server. */
export function useSiteOrigin(): string {
  return useSyncExternalStore(subscribe, () => siteOriginOf(window.location.origin), () => '');
}
