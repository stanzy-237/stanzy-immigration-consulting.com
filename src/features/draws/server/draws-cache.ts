import { revalidateTag, unstable_cache } from 'next/cache';

import { prisma } from '@/server/db/client';

/** Every public read of the Tirages is cached under this tag, until IRCC's feed is read again. */
export const DRAWS_CACHE_TAG = 'draws';

/**
 * The longest a cached read can live, in seconds: a safety net for a change
 * made outside `ingestNow` (a database edit). The feed is read once a day.
 */
const DRAWS_CACHE_SECONDS = 24 * 60 * 60;

type Db = typeof prisma;

/**
 * `read` on the app's database, kept in Next's data cache until the next
 * refresh (`invalidateDraws`): the home page and the Tirages tools re-render
 * every few minutes, and each used to read the whole table. Any other
 * database (a test's stand-in) is read directly, uncached.
 */
export function cachedDraws<T>(db: unknown, key: string, read: (db: Db) => Promise<T>): Promise<T> {
  if (db !== prisma) return read(db as Db);
  return unstable_cache(() => read(prisma), ['draws', key], { tags: [DRAWS_CACHE_TAG], revalidate: DRAWS_CACHE_SECONDS })();
}

/** After each read of IRCC's feed: the next visitor gets the fresh Tirages. Outside a request, nothing to clear. */
export function invalidateDraws(): void {
  try {
    revalidateTag(DRAWS_CACHE_TAG, { expire: 0 });
  } catch (error) {
    if (!(error instanceof Error && error.message.includes('static generation store missing'))) throw error;
  }
}
