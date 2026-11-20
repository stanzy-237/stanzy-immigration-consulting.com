'use client';

import { useEffect } from 'react';

import { authClient } from '@/features/auth/lib/auth-client';
import { setBrowserRollbar, setRollbarPerson, type BrowserRollbar } from '@/features/reports/lib/browser-rollbar';
import { rememberRollbarItem } from '@/features/reports/lib/recent-errors';
import { baseRollbarConfig, REPLAY_OPTIONS, rollbarPerson, sanitizeItem } from '@/features/reports/lib/rollbar-config';

const TOKEN = process.env.NEXT_PUBLIC_ROLLBAR_STANZY_IMMIGRATION_CONSULTING_CO_CLIENT_TOKEN_1795122183;

/** Waits for the browser to be idle, so Rollbar and its replay never delay the page (#165). */
const whenIdle = (run: () => void): (() => void) => {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(run, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(run, 2000);
  return () => clearTimeout(id);
};

/**
 * Rollbar in the browser (#160): uncaught errors and rejected promises, each
 * with the signed-in Account (id and role) and a masked replay of the moments
 * before. Loaded once the page is idle; renders nothing.
 */
export function ErrorTracking(): null {
  const { data } = authClient.useSession();
  const id = data?.user.id ?? null;
  const role = (data?.user as { role?: string } | undefined)?.role ?? 'MEMBER';

  useEffect(() => {
    if (!TOKEN) return;
    let cancelled = false;
    const cancel = whenIdle(() => {
      void import('rollbar/replay').then(({ default: Rollbar }) => {
        if (cancelled) return;
        const rollbar = new Rollbar({
          ...baseRollbarConfig(TOKEN),
          // Network calls (their query strings carry inputs) and the console stay out.
          autoInstrument: { network: false, log: false, dom: true, navigation: true, connectivity: true },
          replay: REPLAY_OPTIONS,
          transform: (item) => {
            sanitizeItem(item);
            rememberRollbarItem(item.uuid as string | undefined);
          },
        });
        setBrowserRollbar(rollbar as BrowserRollbar);
      });
    });
    return () => {
      cancelled = true;
      cancel();
    };
  }, []);

  // Who it is, as the session changes (sign in, sign out).
  useEffect(() => {
    setRollbarPerson(rollbarPerson(id ? { id, role } : null));
  }, [id, role]);

  return null;
}
