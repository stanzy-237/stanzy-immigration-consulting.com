import { after } from 'next/server';

import { dashboardOrigin } from '@/features/dashboard/lib/dashboard-host';
import type { ServiceType } from '@/features/dossiers/data/workflows';
import {
  consultantEmail,
  dossierEmail,
  type ClientActivity,
  type DossierChange,
} from '@/features/dossiers/lib/dossier-emails';
import { toLocale } from '@/i18n/routing';
import { siteUrl } from '@/lib/site-url';
import { prisma } from '@/server/db/client';
import { appMailer } from '@/server/email/app-mailer';

/**
 * Emails the Client about a change to their Dossier, after the response so
 * the consultant's click doesn't wait on Resend. A failed send is logged:
 * the change itself is already saved. With `dossierId`, the button opens that
 * Dossier in « Mon espace » (`subpath` further into it).
 */
export function notifyClient(
  client: { email: string; name: string; locale: string },
  service: ServiceType,
  change: DossierChange,
  dossierId?: string,
  /** Further into the Dossier: `/signer/<id>` opens a Demande de signature. */
  subpath = '',
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
          url: `${siteUrl()}/${locale}/mon-espace${dossierId ? `/dossiers/${dossierId}${subpath}` : ''}`,
        }),
      );
    } catch (error) {
      console.error('[dossiers] could not email the Client', error);
    }
  });
}

/** Emails every consultant Account that a Client uploaded or commented, after the response. */
export function notifyConsultants(
  dossier: { id: string; service: ServiceType },
  client: string,
  activity: ClientActivity,
): void {
  after(async () => {
    try {
      const consultants = await prisma.account.findMany({
        where: { role: 'CONSULTANT' },
        select: { email: true, locale: true },
      });
      const url = `${dashboardOrigin(siteUrl())}/dossiers/${dossier.id}`;
      for (const consultant of consultants) {
        await appMailer.send(
          consultantEmail({
            to: consultant.email,
            locale: consultant.locale,
            client,
            service: dossier.service,
            activity,
            url,
          }),
        );
      }
    } catch (error) {
      console.error('[dossiers] could not email the consultant', error);
    }
  });
}
