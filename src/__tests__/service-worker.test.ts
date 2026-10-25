import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

/**
 * Seam: `public/sw.js` as the browser runs it. The script is loaded into a
 * stand-in service worker global, and the test fires the events the browser
 * would and watches what the worker answers.
 */
const SCRIPT = readFileSync('public/sw.js', 'utf8');

function workerOn(origin: string) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const stores = new Map<string, Map<string, Response>>();
  const caches = {
    open: vi.fn(async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        match: async (request: Request) => store.get(request.url),
        put: async (request: Request, response: Response) => void store.set(request.url, response),
        addAll: async () => undefined,
      };
    }),
    keys: async () => [...stores.keys()],
    delete: vi.fn(async (name: string) => stores.delete(name)),
  };
  const self = {
    location: new URL(origin),
    addEventListener: (type: string, handler: (event: unknown) => void) => (handlers[type] = handler),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
    registration: {},
  };
  const fetch = vi.fn(async () => new Response('fresh'));
  runInNewContext(SCRIPT, { self, caches, fetch, URL, Response, Promise, decodeURIComponent });

  /** Fires a fetch event; returns the worker's answer, or null when it let the browser fetch. */
  const request = async (path: string, mode: RequestMode = 'no-cors') => {
    let answer = null as Promise<Response> | null;
    handlers.fetch!({
      request: { method: 'GET', url: new URL(path, origin).href, mode },
      respondWith: (response: Promise<Response>) => (answer = response),
    });
    return answer;
  };
  /** Fires `activate` and waits for it to finish. */
  const activate = async () => {
    let done: Promise<unknown> = Promise.resolve();
    handlers.activate!({ waitUntil: (work: Promise<unknown>) => (done = work) });
    await done;
  };
  return { request, activate, caches, stores, fetch };
}

describe('service worker', () => {
  it('serves build assets cache-first in production', async () => {
    const worker = workerOn('https://stanzy-immigration-consulting.com');

    expect(await (await worker.request('/_next/static/chunks/app.js'))!.text()).toBe('fresh');
    await worker.request('/_next/static/chunks/app.js');
    expect(worker.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(['http://localhost:3000', 'http://127.0.0.1:3000'])(
    'leaves every request to the network on %s, so `next dev` code is never stale',
    async (origin) => {
      const worker = workerOn(origin);

      expect(await worker.request('/_next/static/chunks/app.js')).toBeNull();
      expect(await worker.request('/fr/outils/timeline', 'navigate')).toBeNull();
      expect(await worker.request('/api/trpc/draws.list')).toBeNull();
      expect(worker.caches.open).not.toHaveBeenCalled();
    },
  );

  it('clears what an older worker cached on localhost when it activates', async () => {
    const worker = workerOn('http://localhost:3000');
    worker.stores.set('stanzy-assets-v5', new Map());
    worker.stores.set('stanzy-shell-v5', new Map());

    await worker.activate();

    expect([...worker.stores.keys()]).toEqual([]);
  });
});
