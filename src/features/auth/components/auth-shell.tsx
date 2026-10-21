import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';

type AuthShellProps = {
  title: string;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
};

/** The centred, branded card every auth screen sits in. */
export function AuthShell({ title, subtitle, footer, children }: AuthShellProps): ReactNode {
  const t = useTranslations('Auth.Shell');
  return (
    <main className="bg-off-white flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Link href="/" aria-label={t('backHome')} className="mb-6 inline-flex">
        <Image src="/logo2.png" alt="Stanzy" width={502} height={468} className="h-16 w-auto" />
      </Link>
      <section className="border-fog w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm md:p-8">
        <h1 className="font-heading text-navy-deep text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="text-slate mt-2 text-sm">{subtitle}</p> : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </section>
      {footer ? <p className="text-slate mt-6 text-sm">{footer}</p> : null}
    </main>
  );
}
