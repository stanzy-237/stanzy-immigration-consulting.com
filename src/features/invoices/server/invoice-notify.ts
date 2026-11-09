import { after } from 'next/server';

import { dashboardOrigin } from '@/features/dashboard/lib/dashboard-host';
import { invoicePaidEmail, invoiceSentEmail, proofReceivedEmail } from '@/features/invoices/lib/invoice-emails';
import { invoiceTotal } from '@/features/invoices/lib/money';
import { invoicePdf, type InvoiceForPdf } from '@/features/invoices/server/invoice-document';
import { consultantInboxes } from '@/features/notifications/server/consultant-inbox';
import { toLocale } from '@/i18n/routing';
import { siteUrl } from '@/lib/site-url';
import { prisma } from '@/server/db/client';
import { appMailer } from '@/server/email/app-mailer';

type Invoice = InvoiceForPdf & { id: string; dossier: InvoiceForPdf['dossier'] & { id: string } };

const facts = (invoice: Invoice) => ({
  number: invoice.number,
  total: invoiceTotal(invoice.lines),
  currency: invoice.currency,
  dueDate: invoice.dueDate,
  service: invoice.dossier.service,
});

const clientUrl = (invoice: Invoice) =>
  `${siteUrl()}/${toLocale(invoice.dossier.account.locale)}/mon-espace/dossiers/${invoice.dossier.id}`;

/** Sends `send()`'s result after the response; a failure is logged, the change is already saved. */
function later(label: string, send: () => Promise<void>): void {
  after(async () => {
    try {
      await send();
    } catch (error) {
      console.error(`[invoices] could not email ${label}`, error);
    }
  });
}

/** The Facture's PDF to its Client. */
export function notifyInvoiceSent(invoice: Invoice): void {
  later('a Facture', async () => {
    const { account } = invoice.dossier;
    await appMailer.send(
      invoiceSentEmail({
        to: account.email,
        name: account.name,
        locale: account.locale,
        invoice: facts(invoice),
        pdf: await invoicePdf(invoice),
        url: clientUrl(invoice),
      }),
    );
  });
}

export function notifyInvoicePaid(invoice: Invoice): void {
  later('a payment confirmation', async () => {
    const { account } = invoice.dossier;
    await appMailer.send(
      invoicePaidEmail({
        to: account.email,
        name: account.name,
        locale: account.locale,
        invoice: facts(invoice),
        url: clientUrl(invoice),
      }),
    );
  });
}

/** To every consultant Account: a Client uploaded a Preuve de paiement. */
export function notifyProofReceived(invoice: Invoice): void {
  later('a Preuve de paiement', async () => {
    const consultants = await consultantInboxes(prisma);
    for (const consultant of consultants) {
      await appMailer.send(
        proofReceivedEmail({
          to: consultant.email,
          locale: consultant.locale,
          client: invoice.dossier.account.name,
          invoice: facts(invoice),
          url: `${dashboardOrigin(siteUrl())}/factures/${invoice.id}`,
        }),
      );
    }
  });
}
