import { NextResponse } from 'next/server';

import { isConsultant } from '@/features/dossiers/server/dossier-access';
import { prepareEncryptedUpload, serveEncryptedFile } from '@/features/dossiers/server/dossier-files';
import { uploadRefused } from '@/features/dossiers/server/upload-route';
import { RECEIPT_PREFIX } from '@/features/finances/lib/finance-schema';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * Where the browser sends a Charge's receipt it encrypted (ADR 0007): a
 * fresh key under the receipts folder of the private bucket. The consultant
 * only; `finances.charges.create`/`update` checks the file and records it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession(request.headers);
  if (!session || !isConsultant(session)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 401 });
  try {
    return NextResponse.json(await prepareEncryptedUpload(RECEIPT_PREFIX));
  } catch (error) {
    return uploadRefused(error);
  }
}

/** A Charge's receipt, decrypted for the consultant. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const session = await getCurrentSession(request.headers);
  if (!session || !isConsultant(session)) return new NextResponse(null, { status: 404 });
  const charge = await prisma.charge.findUnique({
    where: { id },
    select: {
      receiptFileName: true,
      receiptContentType: true,
      receiptObjectKey: true,
      receiptWrappedKey: true,
      receiptIv: true,
    },
  });
  if (
    !charge?.receiptObjectKey ||
    !charge.receiptWrappedKey ||
    !charge.receiptIv ||
    !charge.receiptFileName ||
    !charge.receiptContentType
  ) {
    return new NextResponse(null, { status: 404 });
  }
  return serveEncryptedFile(request, {
    objectKey: charge.receiptObjectKey,
    wrappedKey: charge.receiptWrappedKey,
    iv: charge.receiptIv,
    fileName: charge.receiptFileName,
    contentType: charge.receiptContentType,
  });
}
