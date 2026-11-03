import { NextResponse } from 'next/server';

import { prepareEncryptedUpload } from '@/features/dossiers/server/dossier-files';
import { uploadRefused } from '@/features/dossiers/server/upload-route';
import { historyFilePrefix } from '@/features/pdf-tools/lib/history-schema';
import { getCurrentSession } from '@/server/auth/session';

/**
 * Where the browser sends a downloaded PDF it encrypted, for the Outils PDF
 * history (#79): a fresh key under the consultant's folder in the private R2
 * bucket. The consultant only. `pdfTools.history.add` records it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession(request.headers);
  if (session?.account.role !== 'CONSULTANT') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  try {
    return NextResponse.json(await prepareEncryptedUpload(historyFilePrefix(session.account.id)));
  } catch (error) {
    return uploadRefused(error);
  }
}
