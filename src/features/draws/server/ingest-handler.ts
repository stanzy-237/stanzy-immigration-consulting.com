import { createHash, timingSafeEqual } from 'node:crypto';

import type { IngestReport } from '@/features/draws/server/ingest-draws';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * The feed the workflow sent in the body, if it looks like IRCC's (an object
 * with a non-empty `rounds` list); null otherwise, and the app reads the feed
 * itself. Its rounds are checked by ingestion either way.
 */
async function sentFeed(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.json();
    const rounds = (body as { rounds?: unknown } | null)?.rounds;
    return Array.isArray(rounds) && rounds.length > 0 ? body : null;
  } catch {
    return null;
  }
}

/**
 * The ingest endpoint's request handling: only `Authorization: Bearer <secret>`
 * starts a run. The scheduled GitHub Actions workflow holds the secret, sends
 * IRCC's feed when it could download it, and fails its run on any non-2xx
 * answer.
 */
export function createIngestHandler(deps: {
  secret: string | undefined;
  /** `feed`: what the workflow sent, or null to read IRCC's feed from here. */
  run: (feed: unknown) => Promise<IngestReport>;
}) {
  return async (request: Request): Promise<Response> => {
    if (!deps.secret) {
      return Response.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
    }
    const given = request.headers.get('authorization') ?? '';
    // Compare digests so the check takes the same time whatever was sent.
    if (!timingSafeEqual(digest(given), digest(`Bearer ${deps.secret}`))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      return Response.json(await deps.run(await sentFeed(request)));
    } catch (error) {
      console.error('Draws ingestion failed', error);
      const message = error instanceof Error ? error.message : 'Ingestion failed';
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
