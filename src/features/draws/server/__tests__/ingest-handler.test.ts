import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchIrccFeed } from '@/features/draws/server/ingest-draws';
import { createIngestHandler } from '@/features/draws/server/ingest-handler';

/**
 * Seam: the endpoint the scheduled GitHub Actions workflow calls. Only a
 * request carrying the shared secret may start an ingestion.
 */
const REPORT = { fetched: 451, inserted: 1, updated: 0, skipped: [], alerted: 1 };
const SECRET = 'a-long-random-secret-from-github-actions';

const request = (authorization?: string, body?: string) =>
  new Request('https://stanzy.example/api/cron/draws', {
    method: 'POST',
    headers: { ...(authorization ? { authorization } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body,
  });
const FEED = { rounds: [{ drawNumber: '452', drawDate: '2026-10-27' }] };

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

  it('ingests the feed the workflow sends, so the app need not reach canada.ca itself', async () => {
    const run = vi.fn().mockResolvedValue(REPORT);
    await createIngestHandler({ secret: SECRET, run })(request(`Bearer ${SECRET}`, JSON.stringify(FEED)));

    expect(run).toHaveBeenCalledWith(FEED);
  });

  it.each([
    ['no body', undefined],
    ['a body that is not JSON', '<html>Service Unavailable</html>'],
    ['JSON without rounds', JSON.stringify({ classes: 'wb-tables' })],
    ['an empty rounds list', JSON.stringify({ rounds: [] })],
  ])('reads the feed itself when the workflow sends %s', async (_, body) => {
    const run = vi.fn().mockResolvedValue(REPORT);
    const response = await createIngestHandler({ secret: SECRET, run })(request(`Bearer ${SECRET}`, body));

    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith(null);
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

/** Seam: the app's own read of IRCC's feed, with the network stubbed. */
describe('reading IRCC’s feed', () => {
  afterEach(() => vi.unstubAllGlobals());
  const timeout = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });

  it('tries a second time when canada.ca is too slow, and says who is asking', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(timeout()).mockResolvedValueOnce(Response.json(FEED));
    vi.stubGlobal('fetch', fetch);

    expect(await fetchIrccFeed()).toEqual(FEED);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]![1].headers['user-agent']).toMatch(/^StanzyImmigration\/1\.0 \(\+https:\/\/stanzy-immigration-consulting\.com\)$/);
  });

  it('gives up after two slow tries with an error that says so', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout()));

    await expect(fetchIrccFeed()).rejects.toThrow('IRCC feed did not answer within 25 s, twice');
  });

  it('does not retry an error answer', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('down', { status: 503 }));
    vi.stubGlobal('fetch', fetch);

    await expect(fetchIrccFeed()).rejects.toThrow('IRCC feed answered 503');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
