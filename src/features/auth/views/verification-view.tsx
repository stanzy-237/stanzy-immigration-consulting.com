'use client';

import { MailCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { useResendVerification } from '@/features/auth/hooks/use-resend-verification';
import { safeNextPath, withNext } from '@/features/auth/lib/safe-next-path';
import { Link } from '@/i18n/navigation';

/**
 * The page's query string. Read here rather than in the route so the route
 * stays a thin shell:
 * - `email`: set on the "check your inbox" step straight after sign-up;
 * - `status=verified`: Better Auth accepted the link and signed the person in;
 * - `error`: Better Auth rejected the link (invalid or expired);
 * - `next`: the page the person was on before signing up.
 */
export type VerificationSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const ctaClass =
  'bg-rouge hover:bg-rouge/90 inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white';

/** Vérification: the steps around confirming an Account's email address. */
export function VerificationView({
  searchParams,
}: {
  searchParams: VerificationSearchParams;
}): ReactNode {
  const t = useTranslations('Auth.Verification');
  const email = first(searchParams.email);
  const verified = first(searchParams.status) === 'verified';
  const error = first(searchParams.error);
  // The page the person was on before signing up, carried through the email.
  const next = first(searchParams.next);
  const { resent, resend } = useResendVerification(email, next);

  if (error) {
    return (
      <AuthShell title={t('errorTitle')} subtitle={t('errorBody')}>
        <Link href={withNext('/connexion', next)} className={ctaClass}>
          {t('goToSignIn')}
        </Link>
      </AuthShell>
    );
  }

  if (verified) {
    return (
      <AuthShell title={t('verifiedTitle')} subtitle={t('verifiedBody')}>
        <Link href={safeNextPath(next)} className={ctaClass}>
          {t('continue')}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t('pendingTitle')}
      subtitle={email ? t('pendingBody', { email }) : t('pendingBodyNoEmail')}
    >
      <div className="flex flex-col items-center gap-4">
        <span className="bg-rouge/10 text-rouge inline-flex h-14 w-14 items-center justify-center rounded-full">
          <MailCheck aria-hidden={true} className="h-7 w-7" />
        </span>
        {email ? (
          resent ? (
            <p role="status" className="text-navy-deep text-center text-sm">
              {t('resent')}
            </p>
          ) : (
            <Button type="button" variant="outline" onClick={(): void => void resend()} className="h-11 w-full">
              {t('resend')}
            </Button>
          )
        ) : null}
      </div>
    </AuthShell>
  );
}
