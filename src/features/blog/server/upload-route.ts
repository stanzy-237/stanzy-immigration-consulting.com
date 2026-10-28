import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

import { BLOG_IMAGE_MAX_BYTES, BLOG_IMAGE_TYPES } from '@/features/blog/lib/upload-image';
import { getCurrentSession } from '@/server/auth/session';

/**
 * Hands the editor a one-time token to upload a Blog image straight to Vercel
 * Blob. The consultant only; images only (JPEG, PNG, WebP, AVIF), 5 MB at
 * most, under `blog/`. Uses the project's BLOB_READ_WRITE_TOKEN.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await getCurrentSession(request.headers);
        if (session?.account.role !== 'CONSULTANT') throw new Error('FORBIDDEN');
        if (!pathname.startsWith('blog/')) throw new Error('BLOG_IMAGE_PATH');
        return {
          allowedContentTypes: BLOG_IMAGE_TYPES,
          maximumSizeInBytes: BLOG_IMAGE_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === 'FORBIDDEN';
    return NextResponse.json({ error: forbidden ? 'FORBIDDEN' : 'BLOG_IMAGE_REJECTED' }, { status: forbidden ? 403 : 400 });
  }
}
