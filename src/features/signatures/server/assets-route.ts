import { NextResponse } from 'next/server';

import { ASSET_KINDS, ASSET_MAX_BYTES, ASSET_TYPES, type AssetKind } from '@/features/signatures/lib/signature-schema';
import { openSigningAsset, storeSigningAsset } from '@/features/signatures/server/signing-assets';
import { uploadRefused } from '@/features/dossiers/server/upload-route';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const isKind = (value: unknown): value is AssetKind => ASSET_KINDS.includes(value as AssetKind);

/**
 * The consultant uploads their signature or the company stamp (#96): form
 * fields `kind` (SIGNATURE | STAMP) and `file` (PNG or JPEG, up to 2 Mo).
 * Small enough to pass through the server, which encrypts it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession(request.headers);
  if (session?.account.role !== 'CONSULTANT') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const kind = form?.get('kind');
  const file = form?.get('file');
  if (!isKind(kind) || !(file instanceof Blob)) return NextResponse.json({ error: 'ASSET_INVALID' }, { status: 400 });
  const type = ASSET_TYPES.find((accepted) => accepted === file.type);
  if (!type || file.size === 0 || file.size > ASSET_MAX_BYTES) {
    return NextResponse.json({ error: 'ASSET_INVALID' }, { status: 400 });
  }
  try {
    await storeSigningAsset(prisma, kind, { bytes: await file.arrayBuffer(), type });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[signatures] could not store a signing asset', error);
    return uploadRefused(error);
  }
}

/** The signature or the stamp, decrypted, for the consultant's preview. */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }): Promise<Response> {
  const session = await getCurrentSession(request.headers);
  if (session?.account.role !== 'CONSULTANT') return new NextResponse(null, { status: 403 });
  const { kind } = await params;
  const upper = kind.toUpperCase();
  if (!isKind(upper)) return new NextResponse(null, { status: 404 });
  const asset = await openSigningAsset(prisma, upper).catch(() => null);
  if (!asset) return new NextResponse(null, { status: 404 });
  return new Response(Buffer.from(asset.bytes), {
    headers: { 'Content-Type': asset.type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
