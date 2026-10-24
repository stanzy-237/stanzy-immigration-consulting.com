'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { safeNextPath, type NextParam } from '@/features/auth/lib/safe-next-path';
import { useRouter } from '@/i18n/navigation';

/**
 * For the guest-only pages (Connexion, Inscription and their dialogs), which
 * are static so they open instantly: reads `?next=` in the browser, and sends
 * a visitor who arrives already signed in straight on to it.
 *
 * Only the session the page first finds counts: someone who signs in through
 * the form is moved on by the form itself, not here.
 */
export function useGuestPage(nextProp?: NextParam): { next: NextParam } {
  const searchParams = useSearchParams();
  const next = nextProp ?? searchParams?.get('next') ?? undefined;
  const { account, pending } = useCurrentAccount();
  const router = useRouter();
  const arrivedAs = useRef<'unknown' | 'guest' | 'member'>('unknown');

  useEffect(() => {
    if (pending) return;
    if (arrivedAs.current === 'unknown') arrivedAs.current = account ? 'member' : 'guest';
    if (arrivedAs.current === 'member') router.replace(safeNextPath(next));
  }, [account, pending, next, router]);

  return { next };
}
