import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

import { ENCRYPTED_FILE_MAX_BYTES, masterKey } from '@/features/dossiers/server/dossier-files';
import { invoiceBlobPrefix } from '@/features/invoices/lib/invoice-schema';
import { isAwaitingPayment } from '@/features/invoices/lib/invoice-status';
import { invoiceFor } from '@/features/invoices/server/invoice-access';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * A one-time token for an encrypted Preuve de paiement (ADR 0007): only for
 * a Facture its Client (or the consultant) can reach and that still awaits
 * payment, and only under that Facture's folder. `invoices.addProof` records it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        masterKey();
        const session = await getCurrentSession(request.headers);
        if (!session) throw new Error('FORBIDDEN');
        const { invoiceId } = JSON.parse(clientPayload ?? '{}') as { invoiceId?: unknown };
        if (typeof invoiceId !== 'string') throw new Error('DOCUMENT_FILE_INVALID');
        const invoice = await invoiceFor(prisma, session, invoiceId);
        if (!isAwaitingPayment(invoice.status)) throw new Error('INVOICE_NOT_PAYABLE');
        if (!pathname.startsWith(invoiceBlobPrefix(invoice.id))) throw new Error('DOCUMENT_FILE_INVALID');
        return {
          allowedContentTypes: ['application/octet-stream'],
          maximumSizeInBytes: ENCRYPTED_FILE_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'DOSSIER_FILES_UNCONFIGURED') return NextResponse.json({ error: message }, { status: 503 });
    return NextResponse.json({ error: 'DOCUMENT_FILE_REJECTED' }, { status: 403 });
  }
}
