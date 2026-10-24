import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

const MESSAGES = { fr, en } as const;

export function withIntl(children: ReactNode, locale: keyof typeof MESSAGES = 'fr'): ReactElement {
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {children}
    </NextIntlClientProvider>
  );
}
