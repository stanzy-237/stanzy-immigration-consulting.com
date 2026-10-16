'use client';

import { useLocale } from 'next-intl';
import type { ReactNode } from 'react';

import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type Locale = (typeof routing.locales)[number];

const LABELS: Record<Locale, string> = {
  fr: 'FR',
  en: 'EN',
};

type LocaleToggleProps = {
  ariaLabel: string;
  className?: string;
};

export function LocaleToggle({
  ariaLabel,
  className,
}: LocaleToggleProps): ReactNode {
  const pathname: string = usePathname() ?? '/';
  const active = useLocale() as Locale;

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'border-fog inline-flex items-center rounded-full border bg-white p-0.5 text-xs font-semibold',
        className,
      )}
    >
      {routing.locales.map(
        (locale: Locale): ReactNode => {
          const isActive: boolean = locale === active;
          return (
            <Link
              key={locale}
              href={pathname}
              locale={locale}
              aria-current={isActive ? 'true' : undefined}
              className={cn(
                'inline-flex min-w-[2.25rem] items-center justify-center rounded-full px-3 py-1 transition-colors',
                isActive
                  ? 'bg-navy-deep text-white'
                  : 'text-navy-deep/70 hover:text-navy-deep',
              )}
            >
              {LABELS[locale]}
            </Link>
          );
        },
      )}
    </nav>
  );
}
