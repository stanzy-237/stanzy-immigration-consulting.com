import { NextResponse } from 'next/server';

import { prepareEncryptedUpload } from '@/features/dossiers/server/dossier-files';
import { uploadRefused } from '@/features/dossiers/server/upload-route';
import { invoiceFilePrefix } from '@/features/invoices/lib/invoice-schema';
import { isAwaitingPayment } from '@/features/invoices/lib/invoice-status';
import { invoiceFor } from '@/features/invoices/server/invoice-access';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * Where the browser sends an encrypted Preuve de paiement (ADR 0007, #87):
 * a fresh key under the Facture's folder in the private bucket. Body:
 * `{ invoiceId }`; only for a Facture its Client (or the consultant) can
 * reach and that still awaits payment. `invoices.addProof` records it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession(request.headers);
  if (!session) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 401 });
  try {
    const { invoiceId } = (await request.json()) as { invoiceId?: unknown };
    if (typeof invoiceId !== 'string') throw new Error('DOCUMENT_FILE_INVALID');
    const invoice = await invoiceFor(prisma, session, invoiceId);
    if (!isAwaitingPayment(invoice.status)) throw new Error('INVOICE_NOT_PAYABLE');
    return NextResponse.json(await prepareEncryptedUpload(invoiceFilePrefix(invoice.id)));
  } catch (error) {
    return uploadRefused(error);
  }
}
