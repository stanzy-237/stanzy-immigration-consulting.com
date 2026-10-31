import { NextResponse } from 'next/server';

import { invoiceFor } from '@/features/invoices/server/invoice-access';
import { invoicePdf } from '@/features/invoices/server/invoice-document';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * A sent Facture's PDF, drawn on the letterhead as it stands now (stamped
 * once Payée or Annulée), for its Client or the consultant. A Brouillon has none.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const session = await getCurrentSession(request.headers);
  if (!session) return new NextResponse(null, { status: 401 });

  let invoice;
  try {
    invoice = await invoiceFor(prisma, session, id);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (!invoice.number || !invoice.sentAt) return new NextResponse(null, { status: 404 });

  const pdf = await invoicePdf({ ...invoice, number: invoice.number, sentAt: invoice.sentAt });
  const download = new URL(request.url).searchParams.has('download');
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${invoice.number}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
