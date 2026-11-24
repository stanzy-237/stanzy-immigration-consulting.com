import { z } from 'zod';

import { consultationInvoice } from '@/features/consultation/server/consultation-invoice';
import { prisma } from '@/server/db/client';

/**
 * GET /api/consultation/invoices/<paymentId>: a paid Consultation's Facture
 * (PDF), for « Télécharger la facture » and the e-mail's link. The payment's
 * id is a random UUID, the same key as the page SasPay brings the payer back
 * to; nothing exists before SasPay said `SUCCESS`.
 */
export async function GET(request: Request, { params }: { params: Promise<{ paymentId: string }> }): Promise<Response> {
  const { paymentId } = await params;
  if (!z.uuid().safeParse(paymentId).success) return new Response(null, { status: 404 });
  const invoice = await consultationInvoice(prisma, paymentId);
  if (!invoice) return new Response(null, { status: 404 });
  const download = new URL(request.url).searchParams.has('download');
  return new Response(new Uint8Array(invoice.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${invoice.number}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
}
