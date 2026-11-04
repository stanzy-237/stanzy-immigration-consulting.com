import { NextResponse } from 'next/server';

import { previewInput } from '@/features/contracts/lib/contract-schema';
import { contractPdf } from '@/features/contracts/server/contract-document';
import { dossierFor, isConsultant } from '@/features/dossiers/server/dossier-access';
import { serveEncryptedFile } from '@/features/dossiers/server/dossier-files';
import { openSigningAssets } from '@/features/signatures/server/signing-assets';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * A Contrat's PDF, decrypted on the server (ADR 0007): the signed one, with
 * its Certificat, once signed; else the one sent. For its Client and the
 * consultant; a cancelled one for the consultant only.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const session = await getCurrentSession(request.headers);
  if (!session) return new NextResponse(null, { status: 401 });

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract || (contract.status === 'CANCELLED' && !isConsultant(session))) {
    return new NextResponse(null, { status: 404 });
  }
  try {
    await dossierFor(prisma, session, contract.dossierId);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  const signed =
    contract.signedObjectKey && contract.signedWrappedKey && contract.signedIv
      ? { objectKey: contract.signedObjectKey, wrappedKey: contract.signedWrappedKey, iv: contract.signedIv }
      : null;
  return serveEncryptedFile(request, {
    ...(signed ?? { objectKey: contract.objectKey, wrappedKey: contract.wrappedKey, iv: contract.iv }),
    fileName: `${contract.number}.pdf`,
    contentType: 'application/pdf',
  });
}

/**
 * A template's PDF as a Client would get it, for the consultant writing it:
 * JSON `{ locale, title, body }`, blanks left as written.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await getCurrentSession(request.headers);
  if (session?.account.role !== 'CONSULTANT') return new NextResponse(null, { status: 403 });
  const input = previewInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  const { bytes } = await contractPdf({
    ...input.data,
    number: 'CTR-0000-0000',
    amendment: null,
    sentAt: new Date(),
    consultant: await openSigningAssets(prisma).catch(() => null),
  });
  return new Response(Buffer.from(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store' },
  });
}
