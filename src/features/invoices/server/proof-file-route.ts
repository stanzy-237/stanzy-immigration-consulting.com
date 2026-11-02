import { NextResponse } from 'next/server';

import { serveEncryptedFile } from '@/features/dossiers/server/dossier-files';
import { invoiceFor } from '@/features/invoices/server/invoice-access';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/** A Preuve de paiement, decrypted for its Client or the consultant (ADR 0007). */
export async function GET(request: Request, { params }: { params: Promise<{ proofId: string }> }): Promise<Response> {
  const { proofId } = await params;
  const session = await getCurrentSession(request.headers);
  if (!session) return new NextResponse(null, { status: 401 });

  const proof = await prisma.paymentProof.findUnique({
    where: { id: proofId },
    select: { invoiceId: true, fileName: true, contentType: true, blobUrl: true, wrappedKey: true, iv: true },
  });
  if (!proof) return new NextResponse(null, { status: 404 });
  try {
    await invoiceFor(prisma, session, proof.invoiceId);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  return serveEncryptedFile(request, proof);
}
