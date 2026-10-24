import { createHash, timingSafeEqual } from 'node:crypto';

import type { IngestReport } from '@/features/draws/server/ingest-draws';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * The ingest endpoint's request handling: only `Authorization: Bearer <secret>`
 * starts a run. The scheduled GitHub Actions workflow holds the secret and
 * fails its run on any non-2xx answer.
 */
export function createIngestHandler(deps: { secret: string | undefined; run: () => Promise<IngestReport> }) {
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
      return Response.json(await deps.run());
    } catch (error) {
      console.error('Draws ingestion failed', error);
      const message = error instanceof Error ? error.message : 'Ingestion failed';
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
