import { NextResponse } from 'next/server';

import { contractLetterhead } from '@/features/contracts/server/contract-document';
import type { NoteDoc } from '@/features/document-services/lib/handoff';
import { renderNotePdf } from '@/features/document-services/lib/handoff-pdf';
import { requestFor } from '@/features/document-services/server/requirements';
import { isConsultant } from '@/features/dossiers/server/dossier-access';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * The partner note as saved (#148), drawn on the letterhead: the first
 * pages of the hand-off the Outils PDF puts together. The consultant only.
 */
export async function GET(request: Request, { params }: { params: Promise<{ requestId: string }> }): Promise<Response> {
  const { requestId } = await params;
  const session = await getCurrentSession(request.headers);
  if (!session || !isConsultant(session)) return new NextResponse(null, { status: 404 });
  try {
    await requestFor(prisma, session, requestId);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  const row = await prisma.stanzyRequest.findUnique({
    where: { id: requestId },
    select: { handoffNote: true, service: { select: { name: true } } },
  });
  if (!row?.handoffNote) return new NextResponse(null, { status: 404 });
  const service = ((row.service?.name ?? {}) as Record<string, string>).fr ?? '';
  const pdf = await renderNotePdf(await contractLetterhead(), {
    title: `Note – ${service}`,
    doc: row.handoffNote as NoteDoc,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="note.pdf"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
