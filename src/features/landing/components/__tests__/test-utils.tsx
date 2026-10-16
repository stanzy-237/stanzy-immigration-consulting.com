import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';

import messages from '@/messages/fr.json';

export function withIntl(children: ReactNode) {
  return (
    <NextIntlClientProvider locale="fr" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
