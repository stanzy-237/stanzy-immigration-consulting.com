import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';

import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

const MESSAGES = { fr, en } as const;

export function withIntl(
  children: ReactNode,
  locale: keyof typeof MESSAGES = 'fr',
): ReactElement {
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {children}
    </NextIntlClientProvider>
  );
}

/** The locale-aware router the views navigate with; reset per test. */
export const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() };

/**
 * Stand-in for `@/i18n/navigation`. Use with
 * `vi.mock('@/i18n/navigation', () => navigationMock)`.
 */
export const navigationMock = {
  useRouter: () => router,
  usePathname: () => '/',
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
};
