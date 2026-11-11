import { NextResponse } from 'next/server';

import { serveEncryptedFile } from '@/features/dossiers/server/dossier-files';
import { invoiceFor } from '@/features/invoices/server/invoice-access';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * A Reconnaissance de réception de fonds (#145), decrypted for its Client or
 * the consultant: the signed copy once the Client signed, else the one sent.
 */
export async function GET(request: Request, { params }: { params: Promise<{ paymentId: string }> }): Promise<Response> {
  const { paymentId } = await params;
  const session = await getCurrentSession(request.headers);
  if (!session) return new NextResponse(null, { status: 401 });

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment?.receiptNumber) return new NextResponse(null, { status: 404 });
  try {
    await invoiceFor(prisma, session, payment.invoiceId);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  const signed = payment.signedObjectKey && payment.signedWrappedKey && payment.signedIv;
  const file = signed
    ? { objectKey: payment.signedObjectKey!, wrappedKey: payment.signedWrappedKey!, iv: payment.signedIv! }
    : { objectKey: payment.objectKey, wrappedKey: payment.wrappedKey, iv: payment.iv };
  if (!file.objectKey || !file.wrappedKey || !file.iv) return new NextResponse(null, { status: 404 });
  return serveEncryptedFile(request, {
    objectKey: file.objectKey,
    wrappedKey: file.wrappedKey,
    iv: file.iv,
    fileName: `${payment.receiptNumber}.pdf`,
    contentType: 'application/pdf',
  });
}
