import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * Locale-aware navigation helpers. Import `Link`, `redirect`, `usePathname`,
 * `useRouter` and `getPathname` from here instead of `next/navigation` so that
 * the active locale prefix is preserved automatically.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
