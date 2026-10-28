import { revalidateTag } from 'next/cache';

/** Every public Blog read is cached under this tag. */
export const BLOG_CACHE_TAG = 'blog';

/** After any change in the dashboard: the next visitor gets fresh pages, not a stale copy. */
export function invalidateBlog(): void {
  revalidateTag(BLOG_CACHE_TAG, { expire: 0 });
}
