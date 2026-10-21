'use client';

import { MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { authClient } from '@/features/auth/lib/auth-client';
import { Link } from '@/i18n/navigation';

type VerificationViewProps = {
  /** Set on the "check your inbox" step straight after sign-up. */
  email?: string;
  /** `verified` once Better Auth has accepted the link and signed the person in. */
  status?: string;
  /** Set by Better Auth when the link is invalid or expired. */
  error?: string;
};

const ctaClass =
  'bg-rouge hover:bg-rouge/90 inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white';

/** Vérification: the steps around confirming an Account's email address. */
export function VerificationView({ email, status, error }: VerificationViewProps): ReactNode {
  const t = useTranslations('Auth.Verification');
  const locale = useLocale();
  const [resent, setResent] = useState(false);

  if (error) {
    return (
      <AuthShell title={t('errorTitle')} subtitle={t('errorBody')}>
        <Link href="/connexion" className={ctaClass}>
          {t('goToSignIn')}
        </Link>
      </AuthShell>
    );
  }

  if (status === 'verified') {
    return (
      <AuthShell title={t('verifiedTitle')} subtitle={t('verifiedBody')}>
        <Link href="/" className={ctaClass}>
          {t('continue')}
        </Link>
      </AuthShell>
    );
  }

  async function onResend(): Promise<void> {
    if (!email) return;
    const { error: resendError } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `/${locale}/verification?status=verified`,
    });
    if (!resendError) setResent(true);
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
            <Button type="button" variant="outline" onClick={onResend} className="h-11 w-full">
              {t('resend')}
            </Button>
          )
        ) : null}
      </div>
    </AuthShell>
  );
}
