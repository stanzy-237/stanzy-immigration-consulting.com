import { NextResponse } from 'next/server';

import { handoffFilePrefix } from '@/features/document-services/server/handoff-router';
import { requestFor } from '@/features/document-services/server/requirements';
import { isConsultant } from '@/features/dossiers/server/dossier-access';
import { prepareEncryptedUpload } from '@/features/dossiers/server/dossier-files';
import { uploadRefused } from '@/features/dossiers/server/upload-route';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * Where the browser sends the hand-off PDF it encrypted (#148), before
 * `documentServices.handoff.email` sends it to the partner and deletes it.
 * Body: `{ requestId }`. The consultant only.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession(request.headers);
  if (!session || !isConsultant(session)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 401 });
  try {
    const { requestId } = (await request.json()) as { requestId?: unknown };
    if (typeof requestId !== 'string') throw new Error('DOCUMENT_FILE_INVALID');
    const found = await requestFor(prisma, session, requestId);
    return NextResponse.json(await prepareEncryptedUpload(handoffFilePrefix(found.request.id)));
  } catch (error) {
    return uploadRefused(error);
  }
}
