import { describe, expect, it, vi } from 'vitest';

import { createIngestHandler } from '@/features/draws/server/ingest-handler';

/**
 * Seam: the endpoint the scheduled GitHub Actions workflow calls. Only a
 * request carrying the shared secret may start an ingestion.
 */
const REPORT = { fetched: 451, inserted: 1, updated: 0, skipped: [], alerted: 1 };
const SECRET = 'a-long-random-secret-from-github-actions';

const request = (authorization?: string) =>
  new Request('https://stanzy.example/api/cron/draws', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  });

describe('ingest endpoint', () => {
  it.each([
    ['no header', undefined],
    ['a wrong secret', 'Bearer not-the-secret'],
    ['the secret without Bearer', SECRET],
    ['an empty bearer', 'Bearer '],
  ])('refuses %s with 401 and ingests nothing', async (_, authorization) => {
    const run = vi.fn();
    const response = await createIngestHandler({ secret: SECRET, run })(request(authorization));

    expect(response.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('ingests and answers the report for the right secret', async () => {
    const run = vi.fn().mockResolvedValue(REPORT);
    const response = await createIngestHandler({ secret: SECRET, run })(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(REPORT);
    expect(run).toHaveBeenCalledOnce();
  });

  it('answers 500 when ingestion fails, so the workflow run goes red', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const run = vi.fn().mockRejectedValue(new Error('IRCC feed answered 503'));
    const response = await createIngestHandler({ secret: SECRET, run })(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'IRCC feed answered 503' });
  });

  it('stays shut when no secret is configured', async () => {
    const run = vi.fn();
    const response = await createIngestHandler({ secret: undefined, run })(request('Bearer undefined'));

    expect(response.status).toBe(503);
    expect(run).not.toHaveBeenCalled();
  });
});
