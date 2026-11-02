import { NextResponse } from 'next/server';

import { BLOG_IMAGE_MAX_BYTES, BLOG_IMAGE_TYPES, blogImageKey } from '@/features/blog/lib/upload-image';
import { getCurrentSession } from '@/server/auth/session';
import { presignUpload, publicObjectUrl } from '@/server/storage/r2';

/**
 * Where the editor sends a Blog image: a key under `blog/` in the public R2
 * bucket, a short-lived address to PUT it to, and the address visitors will
 * load it from (#87). Body: `{ fileName, contentType, size }`. The consultant
 * only; images only (JPEG, PNG, WebP, AVIF), 5 MB at most.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession(request.headers);
  if (session?.account.role !== 'CONSULTANT') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const { fileName, contentType, size } = (await request.json()) as Record<string, unknown>;
  if (
    typeof fileName !== 'string' ||
    typeof contentType !== 'string' ||
    !BLOG_IMAGE_TYPES.includes(contentType) ||
    typeof size !== 'number' ||
    size <= 0 ||
    size > BLOG_IMAGE_MAX_BYTES
  ) {
    return NextResponse.json({ error: 'BLOG_IMAGE_REJECTED' }, { status: 400 });
  }
  try {
    const key = blogImageKey(fileName, crypto.randomUUID());
    return NextResponse.json({ uploadUrl: await presignUpload('public', key, contentType), url: publicObjectUrl(key) });
  } catch (error) {
    console.error('[blog] could not prepare an image upload', error);
    return NextResponse.json({ error: 'BLOG_IMAGE_REJECTED' }, { status: 503 });
  }
}
