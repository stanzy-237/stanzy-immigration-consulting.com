import { revalidateTag } from 'next/cache';

/** Every public Blog read is cached under this tag. */
export const BLOG_CACHE_TAG = 'blog';

/**
 * The longest a public Blog page can lag behind the database, in seconds: a
 * safety net for changes made outside the Tableau de bord (a script, a
 * database edit), which can't clear the cache themselves.
 */
export const BLOG_CACHE_SECONDS = 300;

/**
 * After any change in the dashboard: the next visitor gets fresh pages, not a
 * stale copy. Outside a request (a script), there is no cache to clear here;
 * the pages catch up within BLOG_CACHE_SECONDS.
 */
export function invalidateBlog(): void {
  try {
    revalidateTag(BLOG_CACHE_TAG, { expire: 0 });
  } catch (error) {
    if (!(error instanceof Error && error.message.includes('static generation store missing'))) throw error;
  }
}
