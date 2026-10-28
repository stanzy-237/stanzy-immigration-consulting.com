'use client';

import { useCallback } from 'react';

import { authClient } from '@/features/auth/lib/auth-client';

export type CurrentAccount = {
  name: string;
  email: string;
  /** The consultant sees the way into the Tableau de bord; the server still checks. */
  isConsultant: boolean;
};

/**
 * The signed-in Account as the browser sees it, plus sign-out. Reads the
 * session client-side so pages that show it (the nav on every static page)
 * stay statically rendered. Better Auth calls the person `user`; this hook
 * renames it to the glossary's Account so feature code never has to.
 */
export function useCurrentAccount(): {
  account: CurrentAccount | null;
  /** True until the browser knows whether someone is signed in. */
  pending: boolean;
  signOut: () => Promise<void>;
} {
  const { data, isPending } = authClient.useSession();
  const account = data
    ? { name: data.user.name, email: data.user.email, isConsultant: data.user.role === 'CONSULTANT' }
    : null;

  const signOut = useCallback(async (): Promise<void> => {
    await authClient.signOut();
  }, []);

  return { account, pending: isPending, signOut };
}
