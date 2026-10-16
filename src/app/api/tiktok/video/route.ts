import type { NextRequest } from 'next/server';

// Streams a TikTok CDN MP4 through this origin so the browser doesn't trip
// over the CDN's referer / CORS checks. Only hosts under *.tiktokcdn.* are
// allowed; anything else is refused.
const ALLOWED_HOST_SUFFIX = /\.tiktokcdn(?:-us)?\.(?:com|net)$/;

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  const src = req.nextUrl.searchParams.get('src');
  if (!src) {
    return new Response('Missing src', { status: 400 });
  }

  let upstream: URL;
  try {
    upstream = new URL(src);
  } catch {
    return new Response('Invalid src', { status: 400 });
  }

  if (!ALLOWED_HOST_SUFFIX.test(upstream.hostname)) {
    return new Response('Forbidden host', { status: 403 });
  }

  // Forward the viewer's Range so the browser can scrub without downloading
  // the whole file.
  const range = req.headers.get('range');
  const upstreamRes = await fetch(upstream.toString(), {
    headers: {
      referer: 'https://www.tiktok.com/',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      ...(range ? { range } : {}),
    },
    // Short cache so URLs that go stale re-fetch; the parent metadata call
    // already revalidates hourly and feeds us fresh signed URLs.
    cache: 'no-store',
  });

  if (!upstreamRes.ok && upstreamRes.status !== 206) {
    return new Response('Upstream error', { status: upstreamRes.status });
  }

  const headers = new Headers();
  const copyHeaders = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'last-modified',
    'etag',
  ];
  for (const name of copyHeaders) {
    const value = upstreamRes.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has('content-type')) headers.set('content-type', 'video/mp4');
  headers.set('cache-control', 'public, max-age=1800, immutable');

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers,
  });
}
