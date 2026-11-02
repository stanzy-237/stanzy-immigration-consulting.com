import { after } from 'next/server';

import type { ServiceType } from '@/features/dossiers/data/workflows';
import { dossierEmail, type DossierChange } from '@/features/dossiers/lib/dossier-emails';
import { toLocale } from '@/i18n/routing';
import { siteUrl } from '@/lib/site-url';
import { appMailer } from '@/server/email/app-mailer';

/**
 * Emails the Client about a change to their Dossier, after the response so
 * the consultant's click doesn't wait on Resend. A failed send is logged:
 * the change itself is already saved.
 */
export function notifyClient(
  client: { email: string; name: string; locale: string },
  service: ServiceType,
  change: DossierChange,
): void {
  const locale = toLocale(client.locale);
  after(async () => {
    try {
      await appMailer.send(
        dossierEmail({
          to: client.email,
          name: client.name,
          locale,
          service,
          change,
          url: `${siteUrl()}/${locale}/mon-espace`,
        }),
      );
    } catch (error) {
      console.error('[dossiers] could not email the Client', error);
    }
  });
}
