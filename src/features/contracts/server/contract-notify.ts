import { after } from 'next/server';

import {
  consultantContractSignedEmail,
  contractSentEmail,
  contractSignedEmail,
} from '@/features/contracts/lib/contract-emails';
import { dashboardOrigin } from '@/features/dashboard/lib/dashboard-host';
import type { ServiceType } from '@/features/dossiers/data/workflows';
import { consultantInboxes } from '@/features/notifications/server/consultant-inbox';
import { toLocale } from '@/i18n/routing';
import { siteUrl } from '@/lib/site-url';
import { prisma } from '@/server/db/client';
import { appMailer } from '@/server/email/app-mailer';

type Client = { email: string; name: string; locale: string };
type Contract = { id: string; number: string; title: string; service: ServiceType; amendment: boolean; dossierId: string };

/** Sends after the response; a failure is logged, the change is already saved. */
function later(label: string, send: () => Promise<void>): void {
  after(async () => {
    try {
      await send();
    } catch (error) {
      console.error(`[contracts] could not email ${label}`, error);
    }
  });
}

const clientDossier = (client: Client, dossierId: string) =>
  `${siteUrl()}/${toLocale(client.locale)}/mon-espace/dossiers/${dossierId}`;

/** To the Client: the Contrat to sign, the button straight on it. */
export function notifyContractSent(client: Client, contract: Contract): void {
  later('a Contrat', () =>
    appMailer.send(
      contractSentEmail({
        to: client.email,
        name: client.name,
        locale: client.locale,
        contract,
        url: `${clientDossier(client, contract.dossierId)}/contrats/${contract.id}`,
      }),
    ),
  );
}

/** To the Client and every consultant: the signed PDF, attached. */
export function notifyContractSigned(client: Client, contract: Contract, pdf: Uint8Array): void {
  const content = Buffer.from(pdf);
  later('a signed Contrat', async () => {
    await appMailer.send(
      contractSignedEmail({
        to: client.email,
        name: client.name,
        locale: client.locale,
        contract,
        pdf: content,
        url: `${clientDossier(client, contract.dossierId)}#contrats`,
      }),
    );
    const consultants = await consultantInboxes(prisma);
    for (const consultant of consultants) {
      await appMailer.send(
        consultantContractSignedEmail({
          to: consultant.email,
          locale: consultant.locale,
          client: client.name,
          contract,
          pdf: content,
          url: `${dashboardOrigin(siteUrl())}/dossiers/${contract.dossierId}#contrats`,
        }),
      );
    }
  });
}
