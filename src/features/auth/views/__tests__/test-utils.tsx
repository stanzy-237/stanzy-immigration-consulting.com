import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';

import messages from '@/messages/fr.json';

export function withIntl(children: ReactNode): ReactElement {
  return (
    <NextIntlClientProvider locale="fr" messages={messages}>
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
